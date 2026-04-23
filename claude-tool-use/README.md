# Claude + Unsiloed: Document Processing with Tool Use

This example shows how to give [Claude](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview) structured access to [Unsiloed's](https://docs.unsiloed.ai) document processing API using Anthropic's tool-use feature.

## What you'll learn

- How to define Unsiloed API endpoints as Anthropic tool-use schemas
- How to build a tool executor that dispatches Claude's tool calls to the Unsiloed API
- How to run an agentic loop where Claude autonomously processes documents
- Three practical examples: data extraction, document classification, and document parsing

## Prerequisites

- [Unsiloed API key](https://www.unsiloed.ai)
- [Anthropic API key](https://console.anthropic.com)

## Quick start

```bash
# From the repo root
cp .env.example .env
# Edit .env with your API keys

pip install -e .

cd claude-tool-use
jupyter notebook claude_unsiloed_extraction.ipynb
```

## Related

- [Claude Integration Guide](https://docs.unsiloed.ai/document-processing/claude-integration) — Drop-in tool schemas and full API reference
- [Anthropic Tool Use Docs](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview)
