"""Pluggable text embeddings for the semantic half of ``document_search``.

Unsiloed does not return vector embeddings (its chunk ``embed`` field is
Markdown text, not a vector), so the plugin computes its own. Backends:

* **Nous** (``nous``) — the Nous inference gateway's OpenAI-compatible
  ``/v1/embeddings``. Zero extra config: it reuses the Hermes Nous login via
  ``resolve_nous_access_token()`` (refresh-aware, host-managed). This is "use
  what Hermes already exposes."
* **OpenRouter** (``openrouter``) — OpenRouter's ``/v1/embeddings`` using
  ``OPENROUTER_API_KEY``.
* **Custom OpenAI-compatible** (``openai``) — any endpoint via
  ``UNSILOED_EMBED_BASE_URL`` + ``UNSILOED_EMBED_API_KEY``.
* **Hash** (``hash``) — a pure-Python feature-hashing fallback (no deps, no
  network). Fuzzy/lexical-semantic only; used when nothing else is available.

The first three are the *same* HTTP shape (OpenAI ``/embeddings``); they differ
only in base URL and how the bearer token is obtained — so they share one
``HttpEmbedder`` with a pluggable ``token_provider``.

``auto`` (default) selects: explicit custom endpoint → Nous login → OpenRouter
key → hash, validating the chosen network backend with a one-time probe so a
stale login or offline box degrades cleanly instead of indexing garbage.

Every stored vector is tagged with the model id that produced it, so the search
layer never mixes vectors from two embedding spaces. Vectors are returned
L2-normalised, so a dot product is the cosine.
"""

from __future__ import annotations

import hashlib
import logging
import math
import re
import threading
from typing import Callable, List, Optional, Sequence

import requests

from . import config

logger = logging.getLogger(__name__)
_WORD_RE = re.compile(r"[a-z0-9]+")


# --------------------------------------------------------------------------
# base
# --------------------------------------------------------------------------


class Embedder:
    model_id: str = "none"
    dim: int = 0

    def embed(self, texts: Sequence[str]) -> List[List[float]]:
        raise NotImplementedError

    def embed_one(self, text: str) -> List[float]:
        return self.embed([text])[0]


def _normalize(vec: List[float]) -> List[float]:
    norm = math.sqrt(sum(v * v for v in vec))
    if norm <= 1e-12:
        return vec
    inv = 1.0 / norm
    return [v * inv for v in vec]


# --------------------------------------------------------------------------
# hashing (pure python, no deps, no network)
# --------------------------------------------------------------------------


class HashEmbedder(Embedder):
    """Feature-hashing vectorizer over words + character trigrams."""

    def __init__(self, dim: int):
        self.dim = dim
        self.model_id = f"hash-v1-{dim}"

    def _features(self, text: str) -> List[str]:
        words = _WORD_RE.findall(text.lower())
        feats: List[str] = []
        for w in words:
            feats.append("w:" + w)
            padded = f"#{w}#"
            for i in range(len(padded) - 2):
                feats.append("t:" + padded[i : i + 3])
        return feats

    @staticmethod
    def _hash(feat: str) -> int:
        return int.from_bytes(
            hashlib.blake2b(feat.encode("utf-8"), digest_size=8).digest(), "little"
        )

    def embed(self, texts: Sequence[str]) -> List[List[float]]:
        out: List[List[float]] = []
        for text in texts:
            vec = [0.0] * self.dim
            for feat in self._features(text or ""):
                hv = self._hash(feat)
                vec[hv % self.dim] += 1.0 if (hv >> 63) & 1 else -1.0
            out.append(_normalize(vec))
        return out


# --------------------------------------------------------------------------
# OpenAI-compatible HTTP embedder (Nous / OpenRouter / custom)
# --------------------------------------------------------------------------

TokenProvider = Callable[[], str]


class HttpEmbedder(Embedder):
    """Any OpenAI-compatible ``POST {base}/embeddings`` endpoint.

    ``token_provider`` is called per request batch so refresh-aware sources
    (Nous) always get a current token; static keys just return themselves.
    """

    def __init__(
        self,
        *,
        model: str,
        base_url: str,
        token_provider: TokenProvider,
        provider_label: str,
        batch_size: int = 128,
        timeout: float = 60.0,
        extra_headers: Optional[dict] = None,
    ):
        self._model = model
        self._base = base_url.rstrip("/")
        self._token_provider = token_provider
        self._batch = batch_size
        self._timeout = timeout
        self._extra_headers = extra_headers or {}
        self.model_id = f"{provider_label}:{model}"
        self.dim = 0  # discovered on first successful call
        self._session = requests.Session()

    def embed(self, texts: Sequence[str]) -> List[List[float]]:
        cleaned = [(t or " ")[:8000] for t in texts]
        out: List[List[float]] = []
        for i in range(0, len(cleaned), self._batch):
            out.extend(self._embed_batch(cleaned[i : i + self._batch]))
        return out

    def _embed_batch(self, batch: Sequence[str]) -> List[List[float]]:
        token = self._token_provider()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        headers.update(self._extra_headers)
        resp = self._session.post(
            f"{self._base}/embeddings",
            headers=headers,
            json={"model": self._model, "input": list(batch)},
            timeout=self._timeout,
        )
        if resp.status_code >= 400:
            raise RuntimeError(
                f"Embeddings HTTP {resp.status_code} from {self.model_id}: {resp.text[:300]}"
            )
        data = resp.json().get("data") or []
        # keep API order (defensive: sort by index if present)
        if data and isinstance(data[0], dict) and "index" in data[0]:
            data = sorted(data, key=lambda d: d.get("index", 0))
        out: List[List[float]] = []
        for row in data:
            vec = list(row["embedding"])
            self.dim = len(vec)
            out.append(_normalize(vec))
        return out


# --------------------------------------------------------------------------
# token providers
# --------------------------------------------------------------------------


def _nous_token_provider() -> TokenProvider:
    """Refresh-aware Nous token via the host auth store. Raises if unavailable."""
    from hermes_cli.auth import resolve_nous_access_token  # host-managed refresh

    def provider() -> str:
        return resolve_nous_access_token()

    return provider


def _static_token_provider(token: str) -> TokenProvider:
    return lambda: token


# --------------------------------------------------------------------------
# backend builders (return None when prerequisites are absent)
# --------------------------------------------------------------------------


def _build_nous() -> Optional[HttpEmbedder]:
    if not config.nous_logged_in():
        return None
    try:
        provider = _nous_token_provider()
    except Exception:
        return None
    return HttpEmbedder(
        model=config.embed_model(),
        base_url=config.nous_base_url(),
        token_provider=provider,
        provider_label="nous",
    )


def _build_openrouter() -> Optional[HttpEmbedder]:
    key = config.openrouter_api_key()
    if not key:
        return None
    return HttpEmbedder(
        model=config.embed_model(),
        base_url=config.openrouter_base_url(),
        token_provider=_static_token_provider(key),
        provider_label="openrouter",
        extra_headers={"HTTP-Referer": "https://unsiloed.ai", "X-Title": "hermes-unsiloed"},
    )


def _build_custom_openai() -> Optional[HttpEmbedder]:
    key = config.embed_api_key()
    if not key:
        return None
    return HttpEmbedder(
        model=config.embed_model(),
        base_url=config.embed_base_url(),
        token_provider=_static_token_provider(key),
        provider_label="openai",
    )


def _probe(emb: HttpEmbedder) -> bool:
    """One-time validation so auto-mode degrades cleanly on stale/offline auth."""
    try:
        vec = emb.embed_one("probe")
        return bool(vec)
    except Exception as exc:
        logger.debug("embedding backend %s failed probe: %s", emb.model_id, exc)
        return False


# --------------------------------------------------------------------------
# factory (cached singleton)
# --------------------------------------------------------------------------

_lock = threading.Lock()
_cached: Optional[Embedder] = None


def get_embedder(force: bool = False) -> Embedder:
    global _cached
    if _cached is not None and not force:
        return _cached
    with _lock:
        if _cached is not None and not force:
            return _cached
        _cached = _build()
        logger.debug("unsiloed embeddings backend: %s", _cached.model_id)
        return _cached


def _hash() -> Embedder:
    return HashEmbedder(dim=config.hash_embed_dim())


def _build() -> Embedder:
    provider = config.embed_provider()

    # Explicit selection — honor it, raise on misconfig rather than silently degrade.
    if provider == "hash":
        return _hash()
    if provider == "nous":
        emb = _build_nous()
        if emb is None:
            raise RuntimeError("UNSILOED_EMBED_PROVIDER=nous but not logged into Nous Portal.")
        return emb
    if provider == "openrouter":
        emb = _build_openrouter()
        if emb is None:
            raise RuntimeError("UNSILOED_EMBED_PROVIDER=openrouter but OPENROUTER_API_KEY is unset.")
        return emb
    if provider == "openai":
        emb = _build_custom_openai()
        if emb is None:
            raise RuntimeError(
                "UNSILOED_EMBED_PROVIDER=openai but no UNSILOED_EMBED_API_KEY/OPENAI_API_KEY."
            )
        return emb

    # auto: custom endpoint -> Nous login -> OpenRouter key -> hash, probing each.
    for builder in (_build_custom_openai, _build_nous, _build_openrouter):
        emb = builder()
        if emb is not None and _probe(emb):
            return emb
    return _hash()


def reset() -> None:
    global _cached
    with _lock:
        _cached = None