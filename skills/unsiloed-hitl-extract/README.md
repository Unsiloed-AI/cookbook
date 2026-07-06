# Unsiloed HITL Extract — Portable Agent Skill

A drop-in `SKILL.md` that walks an agent through guided document extraction with human-in-the-loop (HITL) review: the user picks the fields, the agent extracts them through [Unsiloed's](https://docs.unsiloed.ai) document AI API, and any value scoring below a confidence threshold comes back for human sign-off with a box drawn on an annotated copy of the document.

The body is curl + jq plus whatever image tooling the machine already has — no bundled scripts.

Use the sibling [`unsiloed`](../unsiloed/) skill when the agent should read, classify, or split documents on its own. Use this one when a human owns the output and needs to verify it: claims intake, compliance records, medical documents, anything where a silently wrong value costs more than a minute of review.

## The flow

1. **Fields** — the user describes the fields they want in plain language, or asks for suggestions derived from the document.
2. **Format** — CSV, JSON, Markdown table, or YAML; to chat, a file, or both.
3. **HITL** — the user chooses whether to review low-confidence values, and at what threshold (default 0.97).
4. **Extract** — the agent builds a JSON Schema and calls Unsiloed's `/v2/extract` with citations enabled.
5. **Review** — every below-threshold value appears in a numbered table and as a numbered box on an annotated image of the document. Values the model could not read arrive as `null`, never as a guess, with a dashed box at their inferred location. The user accepts or amends each one.
6. **Deliver** — the agent writes the output in the agreed format, stating which values were human-verified.

## Compatible runtimes

The skill uses the common `SKILL.md` convention (YAML frontmatter, instructions in the body) and passes the Hermes skill security scan. It works with any runtime that loads skills in this format, including:

- **[Hermes Agent](https://hermes-agent.nousresearch.com/)** — install from this repo with one command (below).
- **[Claude Code skills](https://docs.claude.com/en/docs/claude-code/skills)** — drop into `~/.claude/skills/unsiloed-hitl-extract/SKILL.md`.
- **[Claude.ai Skills](https://www.anthropic.com/news/skills)** — upload via the Skills UI.
- **Custom agents** — load `SKILL.md` as a system prompt fragment. The interactive steps need a human in the conversation; in non-interactive contexts the skill falls back to fields-from-invocation with HITL off.

## Install

### Hermes

```bash
hermes skills install Unsiloed-AI/cookbook/skills/unsiloed-hitl-extract
```

Or inside a chat session:

```
/skills install Unsiloed-AI/cookbook/skills/unsiloed-hitl-extract
```

### Claude Code

```bash
mkdir -p ~/.claude/skills/unsiloed-hitl-extract
curl -fsSL https://raw.githubusercontent.com/Unsiloed-AI/cookbook/main/skills/unsiloed-hitl-extract/SKILL.md \
  -o ~/.claude/skills/unsiloed-hitl-extract/SKILL.md
```

## Configure the API key

The skill expects `UNSILOED_API_KEY` in the agent's environment. Get a key from [unsiloed.ai](https://www.unsiloed.ai), then export it for the agent process:

```bash
export UNSILOED_API_KEY=us_...
```

On Hermes, run `hermes setup` to store the key in the agent's secrets store instead; it passes through to the terminal sandbox automatically.

## Verify

Point the agent at a scanned document and ask for an extraction:

> **You:** use the unsiloed-hitl-extract skill to extract data from immunization_record.jpg
>
> **Agent:** Here's the flow: Fields → Output format → HITL → Extract → Review. Step 1 — which fields do you want pulled out of the immunization record? I can suggest a set if you'd like.

A real run asks the questions before extracting, quotes a job ID, and saves the raw API response next to the source document. If the agent skips the questions or reports results instantly, the skill isn't loaded — check that the runtime sees it.

## Links

- [Unsiloed API reference](https://docs.unsiloed.ai)
- [Get an Unsiloed API key](https://www.unsiloed.ai)
- [Hermes Agent skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills)
- [Claude Code skills format](https://docs.claude.com/en/docs/claude-code/skills)
