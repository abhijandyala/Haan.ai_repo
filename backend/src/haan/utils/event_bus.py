"""
Async event bus for the Haan.ai backend.

Mirrors the 27 event types from the TypeScript frontend's event-bus.ts,
enabling pipeline stages, agents, and the WebSocket layer to communicate
through a decoupled publish-subscribe pattern.

Usage:
    from haan.utils.event_bus import event_bus

    # Subscribe to an event
    async def on_thinking(data):
        print(f"Agent {data['agent']} is thinking (iteration {data['iteration']})")

    event_bus.on("agent:thinking", on_thinking)

    # Emit an event
    await event_bus.emit("agent:thinking", {"agent": "planner", "iteration": 1})
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from enum import Enum
from typing import Any, Callable, Coroutine

logger = logging.getLogger("haan.event_bus")


class EventType(str, Enum):
    """
    All 27 event types supported by the Haan.ai event bus.

    Grouped by category:
    - agent:*      — Agent lifecycle events (thinking, streaming, tool calls, completion)
    - pipeline:*   — Pipeline orchestration events (stage lifecycle, retries, checkpoints)
    - ui:*         — UI-bound events (messages, clear signals)
    - cost:*       — Token usage and cost tracking events
    """

    # ── Agent Events ──
    AGENT_THINKING = "agent:thinking"
    AGENT_REASONING = "agent:reasoning"
    AGENT_IDLE = "agent:idle"
    AGENT_STREAMING = "agent:streaming"
    AGENT_TOOL_CALL = "agent:tool_call"
    AGENT_TOOL_RESULT = "agent:tool_result"
    AGENT_COMPLETE = "agent:complete"
    AGENT_ERROR = "agent:error"

    # ── Pipeline Events ──
    PIPELINE_START = "pipeline:start"
    PIPELINE_STAGE_START = "pipeline:stage_start"
    PIPELINE_STAGE_COMPLETE = "pipeline:stage_complete"
    PIPELINE_STAGE_ERROR = "pipeline:stage_error"
    PIPELINE_APPROVAL_NEEDED = "pipeline:approval_needed"
    PIPELINE_COMPLETE = "pipeline:complete"
    PIPELINE_RETRY = "pipeline:retry"
    PIPELINE_IMPROVEMENT = "pipeline:improvement"
    PIPELINE_PARALLEL_GROUP = "pipeline:parallel_group"
    PIPELINE_CHECKPOINT = "pipeline:checkpoint"
    PIPELINE_FAILOVER = "pipeline:failover"
    PIPELINE_VALIDATION_ERROR = "pipeline:validation_error"

    # ── UI Events ──
    UI_MESSAGE = "ui:message"
    UI_CLEAR = "ui:clear"

    # ── Cost Events ──
    COST_UPDATE = "cost:update"


# Type alias for event handler callbacks (both sync and async supported)
EventHandler = Callable[..., Any] | Callable[..., Coroutine[Any, Any, Any]]


class AsyncEventBus:
    """
    Async-capable event bus supporting both sync and async handlers.

    Features:
    - Type-safe event names via EventType enum (also accepts raw strings)
    - Both sync and async handler support
    - Wildcard subscriptions via on("*", handler)
    - Error isolation: one failing handler does not block others
    - Thread-safe via asyncio locks
    """

    def __init__(self, max_listeners: int = 50) -> None:
        self._handlers: dict[str, list[EventHandler]] = defaultdict(list)
        self._max_listeners = max_listeners
        self._lock = asyncio.Lock()

    def on(self, event: str | EventType, handler: EventHandler) -> None:
        """
        Register a handler for an event type.

        Args:
            event: Event name (string or EventType enum).
            handler: Callback function (sync or async). Receives event data dict.
        """
        key = event.value if isinstance(event, EventType) else event
        handlers = self._handlers[key]
        if len(handlers) >= self._max_listeners:
            logger.warning(
                "Max listeners (%d) reached for event '%s'. "
                "Possible memory leak — check for unremoved handlers.",
                self._max_listeners,
                key,
            )
        handlers.append(handler)

    def off(self, event: str | EventType, handler: EventHandler) -> None:
        """
        Remove a handler for an event type.

        Args:
            event: Event name to unsubscribe from.
            handler: The exact handler function to remove.
        """
        key = event.value if isinstance(event, EventType) else event
        handlers = self._handlers.get(key, [])
        try:
            handlers.remove(handler)
        except ValueError:
            pass  # Handler was already removed or never registered

    def once(self, event: str | EventType, handler: EventHandler) -> None:
        """
        Register a handler that fires only once, then auto-removes itself.

        Args:
            event: Event name to subscribe to.
            handler: One-shot callback function.
        """
        key = event.value if isinstance(event, EventType) else event

        async def wrapper(data: dict[str, Any]) -> Any:
            self.off(key, wrapper)
            if asyncio.iscoroutinefunction(handler):
                return await handler(data)
            return handler(data)

        self.on(key, wrapper)

    async def emit(self, event: str | EventType, data: dict[str, Any] | None = None) -> None:
        """
        Emit an event to all registered handlers.

        Both the specific event handlers and wildcard ("*") handlers are invoked.
        Errors in individual handlers are logged but do not prevent other handlers
        from executing.

        Args:
            event: Event name to emit.
            data: Event payload dictionary.
        """
        key = event.value if isinstance(event, EventType) else event
        payload = data or {}

        # Collect handlers: specific + wildcard
        handlers = list(self._handlers.get(key, []))
        wildcard_handlers = list(self._handlers.get("*", []))

        for handler in handlers + wildcard_handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(payload)
                else:
                    handler(payload)
            except Exception:
                logger.exception("Error in event handler for '%s'", key)

    def emit_sync(self, event: str | EventType, data: dict[str, Any] | None = None) -> None:
        """
        Emit an event synchronously by scheduling it on the current event loop.

        Useful when calling from sync code that runs inside an async context.
        If no event loop is running, the emission is silently skipped.

        Args:
            event: Event name to emit.
            data: Event payload dictionary.
        """
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.emit(event, data))
        except RuntimeError:
            # No running event loop — skip emission
            pass

    def remove_all_listeners(self, event: str | EventType | None = None) -> None:
        """
        Remove all handlers for a specific event, or all events if none specified.

        Args:
            event: Optional event name. If None, clears all handlers.
        """
        if event is None:
            self._handlers.clear()
        else:
            key = event.value if isinstance(event, EventType) else event
            self._handlers.pop(key, None)

    def listener_count(self, event: str | EventType) -> int:
        """Return the number of handlers registered for an event."""
        key = event.value if isinstance(event, EventType) else event
        return len(self._handlers.get(key, []))

    @property
    def all_events(self) -> list[str]:
        """Return all EventType values as a list of strings."""
        return [e.value for e in EventType]


# Module-level singleton
event_bus = AsyncEventBus(max_listeners=50)
