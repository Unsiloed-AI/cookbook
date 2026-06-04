# Unsiloed Cookbook

Recipes for integrating [Unsiloed](https://docs.unsiloed.ai)'s document AI — parsing, extraction, classification, and splitting — into agentic systems and AI runtimes.

The cookbook is organized to stay agnostic across AI providers and runtimes. Each recipe lives under the provider or skill family it targets, so adding support for a new model or a new agent framework is a self-contained drop-in.

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

Recipes built around a specific model or SDK.

| Provider | Recipe | Description |
|----------|--------|-------------|
| Claude | [Tool Use](./claude/tool-use/) | Give Claude structured access to Unsiloed via Anthropic's tool-use API |

### Portable agent skills

Runtime-agnostic `SKILL.md` files that plug into any skill-capable agent (Claude Code, Claude.ai, OpenClaw, custom agents).

| Skill | Description |
|-------|-------------|
| [Unsiloed](./skills/unsiloed/) | Routes document reads through Unsiloed with confidence-scored output. Covers parse, extract, classify, split |

## Repository layout

```
cookbook/
├── claude/         # Claude-specific recipes (tool use, agents, etc.)
├── skills/         # Portable SKILL.md files for skill-capable runtimes
└── <provider>/     # Add new provider folders as siblings (openai/, gemini/, ...)
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
