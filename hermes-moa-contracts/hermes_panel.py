"""Run the contract text through the Hermes Mixture-of-Agents panel.

`provider="moa", model="default"` selects the MoA preset (the SDK equivalent of
`/moa` in `hermes chat`): two reference models analyse the contract independently,
then an aggregator writes the consolidated memo. The agent needs no tools — the
contract text is already in the prompt.
"""

import os
import sys
import contextlib


def review_contract(contract_text: str, hermes_home: str, log=lambda _msg: None) -> str:
    """Return the panel's risk-memo text. `log` is an optional progress callback."""
    sys.path.append(hermes_home)                 # the Hermes SDK lives here
    os.environ.setdefault("HERMES_YOLO_MODE", "1")
    from run_agent import AIAgent

    chunks: list[str] = []
    agent = AIAgent(
        provider="moa",
        model="default",
        api_key="moa-virtual-provider",
        base_url="http://127.0.0.1/v1",
        api_mode="chat_completions",
        enabled_toolsets=[],                     # no tools — text is in the prompt
        platform="cli",
        max_iterations=4,
        quiet_mode=True,
        status_callback=lambda _kind, message: log(message),
        stream_delta_callback=lambda delta: chunks.append(delta) if delta else None,
    )
    log("panel running — reference models read the contract, then the aggregator writes…")
    final = agent.chat(_build_prompt(contract_text))
    with contextlib.suppress(Exception):
        agent.close()
    return "".join(chunks).strip() or (final or "").strip()


def _build_prompt(text: str) -> str:
    return f"""You are a contract-risk panel. Below is the FULL extracted text of a
Master Services Agreement (read by Unsiloed). First identify, from the document, which
party is the Customer and which is the Service Provider, then review from the Customer's
seat and produce a risk memo. Ground every point strictly in the wording below; if a
normal protection is absent, say so. Do not invent clauses.

OUTPUT FORMAT — return GitHub-flavoured **Markdown only** (no code fences around the whole
thing), following this exact structure so it renders as a clean memo:

# Contract Risk Memo — <agreement name>

**To:** <Customer> · **From:** Contract-Risk Panel · **Re:** <one line>

## Parties
- **Customer:** …
- **Service Provider:** …
- **Governing law:** …

## Summary
One short paragraph: overall posture and the headline risks.

## Clause-by-Clause Findings

For EACH flagged clause, a level-3 heading then the four labelled lines and the quote:

### N. <Short title> — Cl. <number>
> "<verbatim quote from the contract>"

- **Favours:** Service Provider | Customer
- **Severity:** High | Medium | Low
- **Why it matters:** …
- **Redline:** …

Cover at least: indemnity, limitation of liability, warranty disclaimers, termination &
auto-renewal, payment / one-off charges, IP ownership, order-of-precedence.

## Deal-Breakers
A numbered list of the 3 terms you would not sign without changing.

Rules: use `##`/`###` headings, `>` blockquotes for verbatim quotes, `**bold**` for the
field labels, and `-`/`1.` lists. Do NOT use `=====` underlines or plain-text separators.

=== CONTRACT TEXT ===
{text}
=== END CONTRACT TEXT ==="""