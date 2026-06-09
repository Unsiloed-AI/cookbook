# Unsiloed Cookbook

Recipes for wiring [Unsiloed](https://docs.unsiloed.ai)'s document AI — parse, extract, classify, split — into the AI provider, agent framework, or runtime of your choice.

The cookbook stays agnostic by design: each recipe is scoped to a single provider or skill family, so adding a new model, SDK, or agent runtime is a self-contained drop-in.

## Prerequisites

- **Unsiloed API key** — [sign up at unsiloed.ai](https://www.unsiloed.ai)
- **Python 3.13+** for the notebook-based recipes (skill recipes need only `curl` and `jq`)

## Getting Started

```bash
git clone https://github.com/Unsiloed-AI/cookbook.git
cd cookbook

# Create your .env file
cp .env.example .env
# Edit .env and add your API keys

# For Python recipes
pip install -e .
```

## Recipes

### By AI provider

Recipes built around a specific model, SDK, or agent framework.

| Provider | Recipe | Description |
|----------|--------|-------------|
| Claude | [Tool Use](./claude/tool-use/) | Give Claude structured access to Unsiloed via Anthropic's tool-use API |
| OpenAI | [Agentic CLI](./openai/cli/) | LangChain ReAct agent in a terminal REPL — plain-English document processing via Unsiloed |

### Portable agent skills

Runtime-agnostic `SKILL.md` files — YAML frontmatter plus bash instructions — that plug into any skill-capable agent: Claude Code, Claude.ai, OpenClaw, custom runtimes.

| Skill | Description |
|-------|-------------|
| [Unsiloed](./skills/unsiloed/) | Routes document reads through Unsiloed with confidence-scored output. Covers parse, extract, classify, split |

## Repository layout

```
cookbook/
├── claude/         # Claude-specific recipes (tool use, agents, etc.)
├── openai/         # OpenAI-specific recipes (CLI, agents, etc.)
├── skills/         # Portable SKILL.md files for skill-capable runtimes
└── <provider>/     # Add new provider folders as siblings (gemini/, langchain/, ...)
```

## Contributing

We welcome contributions! Pick the directory that matches what you're adding:

- **Provider-specific recipe** (uses a particular SDK or API) → `<provider>/<recipe-name>/`.
   Example: `openai/responses-api/`, `gemini/function-calling/`, `langchain/extraction/`.
- **Portable agent skill** (a `SKILL.md` that works across runtimes) → `skills/<skill-name>/`.
- **General guide** that isn't tied to one provider → top-level directory with a clear name.

For every recipe:

1. Include a `README.md` explaining what it does, prerequisites, and how to run it.
2. Use `.env` and `python-dotenv` (or shell `export` for skill recipes) for API keys — never hardcode them.
3. Clear notebook outputs before committing.
4. Open a PR with a description of what the example demonstrates and add it to the relevant table above.

## Links

- [Unsiloed Documentation](https://docs.unsiloed.ai)
- [API Reference](https://docs.unsiloed.ai/api-reference/extraction/extract-data)
- [Claude Integration Guide](https://docs.unsiloed.ai/document-processing/claude-integration)
- [Support](mailto:hello@unsiloed-ai.com)

## License

[MIT](./LICENSE)
