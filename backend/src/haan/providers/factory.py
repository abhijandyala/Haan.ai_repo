"""
LLM provider factory for the Haan.ai backend.

Creates LangChain LLM instances for different providers (Anthropic, OpenAI, Google).
Used by the pipeline engine and agents to interact with language models.

Usage:
    from haan.providers.factory import create_llm

    llm = create_llm("anthropic", "claude-sonnet-4-20250514")
    llm = create_llm()  # Uses default provider/model from config
"""

from __future__ import annotations

from typing import Any

from haan.config import settings
from haan.utils.logger import logger


# Known models per provider for validation and display
PROVIDER_MODELS: dict[str, list[str]] = {
    "anthropic": [
        "claude-sonnet-4-20250514",
        "claude-opus-4-20250514",
        "claude-haiku-3-20250306",
    ],
    "openai": [
        "gpt-4o",
        "gpt-4o-mini",
        "o3-mini",
    ],
    "google": [
        "gemini-2.5-pro",
        "gemini-2.5-flash",
    ],
}


def create_llm(
    provider: str | None = None,
    model: str | None = None,
    temperature: float = 0.1,
    max_tokens: int = 4096,
) -> Any:
    """
    Create a LangChain LLM instance for the specified provider and model.

    Args:
        provider: Provider name ("anthropic", "openai", "google").
                  Defaults to settings.default_provider.
        model: Model identifier (e.g., "claude-sonnet-4-20250514").
               Defaults to settings.default_model.
        temperature: Sampling temperature (default 0.1 for deterministic output).
        max_tokens: Maximum tokens to generate (default 4096).

    Returns:
        A LangChain BaseLLM or BaseChatModel instance.

    Raises:
        ValueError: If the provider is unknown or API key is missing.
    """
    provider = provider or settings.default_provider
    model = model or settings.default_model

    logger.info("providers", f"Creating LLM: {provider}/{model}")

    if provider == "anthropic":
        return _create_anthropic(model, temperature, max_tokens)
    elif provider == "openai":
        return _create_openai(model, temperature, max_tokens)
    elif provider == "google":
        return _create_google(model, temperature, max_tokens)
    else:
        raise ValueError(
            f"Unknown provider: '{provider}'. "
            f"Supported: {list(PROVIDER_MODELS.keys())}"
        )


def _create_anthropic(model: str, temperature: float, max_tokens: int) -> Any:
    """Create an Anthropic LLM via LangChain."""
    if not settings.anthropic_api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY is not set. "
            "Set it in your .env file or environment variables."
        )

    from langchain_anthropic import ChatAnthropic

    return ChatAnthropic(
        model=model,
        anthropic_api_key=settings.anthropic_api_key,
        temperature=temperature,
        max_tokens=max_tokens,
    )


def _create_openai(model: str, temperature: float, max_tokens: int) -> Any:
    """Create an OpenAI LLM via LangChain."""
    if not settings.openai_api_key:
        raise ValueError(
            "OPENAI_API_KEY is not set. "
            "Set it in your .env file or environment variables."
        )

    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=model,
        openai_api_key=settings.openai_api_key,
        temperature=temperature,
        max_tokens=max_tokens,
    )


def _create_google(model: str, temperature: float, max_tokens: int) -> Any:
    """Create a Google LLM via LangChain."""
    if not settings.google_api_key:
        raise ValueError(
            "GOOGLE_API_KEY is not set. "
            "Set it in your .env file or environment variables."
        )

    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model=model,
        google_api_key=settings.google_api_key,
        temperature=temperature,
        max_output_tokens=max_tokens,
    )


def list_available_models() -> list[dict[str, Any]]:
    """
    List all models that have valid API keys configured.

    Returns:
        List of dicts with 'provider', 'model', and 'available' keys.
    """
    models: list[dict[str, Any]] = []

    provider_keys = {
        "anthropic": bool(settings.anthropic_api_key),
        "openai": bool(settings.openai_api_key),
        "google": bool(settings.google_api_key),
    }

    for provider, model_list in PROVIDER_MODELS.items():
        available = provider_keys.get(provider, False)
        for model in model_list:
            models.append({
                "provider": provider,
                "model": model,
                "available": available,
            })

    return models
