"""
Failover chain for LLM providers.

Wraps multiple LLM providers in a chain that automatically fails over
to the next provider if the current one returns an error (rate limit,
outage, etc.).

Usage:
    from haan.providers.failover import FailoverLLM

    llm = FailoverLLM([
        ("anthropic", "claude-sonnet-4-20250514"),
        ("openai", "gpt-4o"),
        ("google", "gemini-2.5-pro"),
    ])
    result = llm.invoke("Hello")
"""

from __future__ import annotations

import time
from typing import Any

from haan.providers.factory import create_llm
from haan.utils.event_bus import event_bus
from haan.utils.logger import logger


# Errors that should trigger failover (transient/provider issues)
FAILOVER_ERROR_PATTERNS = [
    "429",
    "rate limit",
    "rate_limit",
    "500",
    "502",
    "503",
    "529",
    "overloaded",
    "timeout",
    "connection",
    "network",
]


class FailoverLLM:
    """
    LLM wrapper that tries multiple providers in sequence.

    If the primary provider fails with a transient error, it automatically
    tries the next provider in the chain. Emits pipeline:failover events
    so the dashboard can show which provider is being used.
    """

    def __init__(
        self,
        chain: list[tuple[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> None:
        """
        Initialize the failover chain.

        Args:
            chain: List of (provider, model) tuples in priority order.
            temperature: Sampling temperature for all providers.
            max_tokens: Max tokens for all providers.
        """
        self._chain = chain
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._providers: list[Any] = []
        self._current_index = 0

        # Lazily create providers
        for provider, model in chain:
            try:
                llm = create_llm(provider, model, temperature, max_tokens)
                self._providers.append(llm)
            except ValueError as e:
                logger.warn("failover", f"Skipping {provider}/{model}: {e}")
                self._providers.append(None)

    @property
    def current_provider(self) -> str:
        """Return the currently active provider/model string."""
        if self._current_index < len(self._chain):
            provider, model = self._chain[self._current_index]
            return f"{provider}/{model}"
        return "none"

    def get_active_llm(self) -> Any:
        """
        Return the currently active LLM instance.

        Raises:
            RuntimeError: If no providers are available.
        """
        for i in range(len(self._providers)):
            idx = (self._current_index + i) % len(self._providers)
            if self._providers[idx] is not None:
                self._current_index = idx
                return self._providers[idx]

        raise RuntimeError("No LLM providers available. Check your API keys.")

    def invoke(self, prompt: str, **kwargs: Any) -> Any:
        """
        Invoke the LLM with automatic failover.

        Tries each provider in the chain until one succeeds or all fail.

        Args:
            prompt: The prompt to send to the LLM.
            **kwargs: Additional arguments passed to the LLM.

        Returns:
            LLM response.

        Raises:
            RuntimeError: If all providers in the chain fail.
        """
        last_error: Exception | None = None
        start_index = self._current_index

        for i in range(len(self._providers)):
            idx = (start_index + i) % len(self._providers)
            provider_llm = self._providers[idx]

            if provider_llm is None:
                continue

            provider_name, model_name = self._chain[idx]

            try:
                result = provider_llm.invoke(prompt, **kwargs)
                self._current_index = idx
                return result

            except Exception as e:
                error_msg = str(e).lower()
                last_error = e

                # Check if this is a failover-worthy error
                is_transient = any(
                    pattern in error_msg for pattern in FAILOVER_ERROR_PATTERNS
                )

                if is_transient and i < len(self._providers) - 1:
                    next_idx = (start_index + i + 1) % len(self._providers)
                    next_provider, next_model = self._chain[next_idx]

                    logger.warn(
                        "failover",
                        f"Provider {provider_name}/{model_name} failed: {e}. "
                        f"Failing over to {next_provider}/{next_model}",
                    )

                    event_bus.emit_sync("pipeline:failover", {
                        "from": f"{provider_name}/{model_name}",
                        "to": f"{next_provider}/{next_model}",
                        "reason": str(e)[:200],
                    })
                    continue
                else:
                    # Non-transient error or last provider — raise
                    raise

        raise RuntimeError(
            f"All {len(self._chain)} providers failed. Last error: {last_error}"
        )
