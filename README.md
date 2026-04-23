# Unsiloed Cookbook

Recipes and examples for building with the [Unsiloed API](https://docs.unsiloed.ai) — AI-powered document processing including parsing, extraction, classification, and splitting.

## Prerequisites

- **Unsiloed API key** — [sign up at unsiloed.ai](https://www.unsiloed.ai)
- **Python 3.13+**

## Getting Started

```bash
git clone https://github.com/Unsiloed-AI/cookbook.git
cd cookbook

# Create your .env file
cp .env.example .env
# Edit .env and add your API keys

# Install dependencies
pip install -e .
```

## Examples

| Example | Description |
|---------|-------------|
| [Claude + Unsiloed Tool Use](./claude-tool-use/) | Give Claude structured access to Unsiloed's document processing API using Anthropic tool-use |

## Contributing

We welcome contributions! To add a new example:

1. Create a new directory with a descriptive name (e.g., `langchain-extraction/`)
2. Include a `README.md` explaining what the example does and how to run it
3. Use `.env` and `python-dotenv` for API keys — never hardcode them
4. Clear notebook outputs before committing
5. Open a PR with a description of what the example demonstrates

## Links

- [Unsiloed Documentation](https://docs.unsiloed.ai)
- [API Reference](https://docs.unsiloed.ai/api-reference/extraction/extract-data)
- [Claude Integration Guide](https://docs.unsiloed.ai/document-processing/claude-integration)
- [Support](mailto:hello@unsiloed-ai.com)

## License

[MIT](./LICENSE)
