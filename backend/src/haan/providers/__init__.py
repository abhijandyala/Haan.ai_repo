"""
LLM provider abstraction for the Haan.ai backend.

Supports multiple LLM providers through LangChain:
- Anthropic (Claude models)
- OpenAI (GPT-4o, o3-mini, etc.)
- Google (Gemini models)

Includes failover support for automatic provider switching on errors.
"""
