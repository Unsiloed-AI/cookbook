# Unsiloed Skill — Portable Agent Skill

A drop-in `SKILL.md` that teaches any skill-capable agent runtime to call [Unsiloed's](https://docs.unsiloed.ai) document AI API instead of relying on the model's own vision.

The body is curl + jq only — no Python, no extra runtimes — so it works anywhere the agent can shell out.

## Why use it

Vision LLMs hallucinate on hard documents (prescriptions, dense forms, handwritten scans) with no confidence signal. Routing the read through Unsiloed gives the agent structured output with per-field confidence scores, so the reply can flag what to verify.

## What it covers

The skill teaches the agent four Unsiloed operations and how to pick between them:

- **Parse** — read everything on the page, return Markdown of each layout region. Default for "what does this say".
- **Extract** — pull named fields out as JSON with a confidence score per field.
- **Classify** — label a document as one of several candidate categories.
- **Split** — break a single PDF containing several documents into separate files by category.

Full instructions, polling loops, and example schemas live in [`SKILL.md`](./SKILL.md).

## Compatible runtimes

The skill uses the common `SKILL.md` convention (YAML frontmatter with `name`, `description`, optional `metadata`; instructions in the body). It works with any runtime that loads skills in this format, including:

- **[Claude Code skills](https://docs.claude.com/en/docs/claude-code/skills)** — drop into `~/.claude/skills/unsiloed/SKILL.md` (or a project's `.claude/skills/unsiloed/SKILL.md`).
- **[Claude.ai Skills](https://www.anthropic.com/news/skills)** — upload via the Skills UI.
- **OpenClaw** — `openclaw skills install` from a Git URL or local path.
- **Custom agents** — load `SKILL.md` as a system prompt fragment when document tasks come in.

The frontmatter includes an `openclaw` metadata block declaring required env vars and binaries. Other runtimes ignore unknown metadata, so the file stays portable.

## Install

### Claude Code

```bash
mkdir -p ~/.claude/skills/unsiloed
curl -fsSL https://raw.githubusercontent.com/Unsiloed-AI/cookbook/main/skills/unsiloed/SKILL.md \
  -o ~/.claude/skills/unsiloed/SKILL.md
```

Or clone the cookbook and symlink the directory into your skills folder.

### OpenClaw

```bash
openclaw skills install git:https://github.com/Unsiloed-AI/cookbook --subpath skills/unsiloed
```

### Manual / custom agents

Copy [`SKILL.md`](./SKILL.md) wherever your agent loads skill files. The body is the full instruction set — no additional config needed beyond the API key.

## Configure the API key

The skill expects `UNSILOED_API_KEY` in the agent's environment. Get a key from [unsiloed.ai](https://www.unsiloed.ai), then export it for the agent process:

```bash
export UNSILOED_API_KEY=us_...
```

For Claude Code, add it to your shell profile or a project `.env`. For OpenClaw:

```bash
echo 'UNSILOED_API_KEY=us_...' >> ~/.openclaw/.env
chmod 600 ~/.openclaw/.env
openclaw gateway restart
```

## Verify

Send the agent a document and ask a question about its contents:

> **You:** [attached prescription.jpg] What medicines are listed here?
>
> **Agent:** Three medicines: Tab Azee 500mg, Tab Montair FX, Tab Dolo 650. All extracted with confidence above 0.95.

If the agent reads the document with its own vision instead of calling the curl block in `SKILL.md`, the skill isn't loaded — check that the runtime sees it.

## Links

- [Unsiloed API reference](https://docs.unsiloed.ai)
- [Get an Unsiloed API key](https://www.unsiloed.ai)
- [Claude Code skills format](https://docs.claude.com/en/docs/claude-code/skills)
