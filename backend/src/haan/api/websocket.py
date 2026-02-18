"""
WebSocket handler for the Haan.ai backend.

Manages real-time bidirectional communication between the Python backend
and the dashboard UI. Subscribes to all event bus events and broadcasts
them to connected WebSocket clients.

Protocol:
  Server -> Client (events):
    { "type": "event", "event": "<event_name>", "data": {...}, "timestamp": <ms> }

  Client -> Server (commands):
    { "type": "start_pipeline", "task": "...", "mode": "auto"|"human" }
    { "type": "approve", "stage": "...", "approved": true|false }
    { "type": "ping" }
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from haan.pipeline.engine import PipelineEngine
from haan.utils.event_bus import EventType, event_bus
from haan.utils.logger import logger

# Heartbeat interval in seconds
HEARTBEAT_INTERVAL = 30


class WebSocketManager:
    """
    Manages WebSocket connections and event broadcasting.

    Subscribes to all event bus events and forwards them to connected
    dashboard clients. Also handles incoming commands from clients
    (start_pipeline, approve, etc.).
    """

    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._pipeline: PipelineEngine | None = None
        self._subscribed = False

    @property
    def client_count(self) -> int:
        """Return the number of connected WebSocket clients."""
        return len(self._clients)

    def set_pipeline(self, pipeline: PipelineEngine) -> None:
        """Set the pipeline engine reference for handling commands."""
        self._pipeline = pipeline

    async def connect(self, websocket: WebSocket) -> None:
        """
        Accept a new WebSocket connection and start handling it.

        This method runs for the lifetime of the connection, handling
        incoming messages and heartbeats.
        """
        await websocket.accept()
        self._clients.add(websocket)
        logger.info("websocket", f"Client connected ({self.client_count} total)")

        # Subscribe to events on first connection
        if not self._subscribed:
            self._subscribe_to_events()
            self._subscribed = True

        try:
            # Handle incoming messages
            while True:
                try:
                    raw = await asyncio.wait_for(
                        websocket.receive_text(),
                        timeout=HEARTBEAT_INTERVAL * 2,
                    )
                    await self._handle_client_message(raw)
                except asyncio.TimeoutError:
                    # Send ping to keep connection alive
                    try:
                        await websocket.send_json({"type": "ping", "timestamp": int(time.time() * 1000)})
                    except Exception:
                        break  # Connection lost

        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.error("websocket", f"Client error: {e}")
        finally:
            self._clients.discard(websocket)
            logger.info("websocket", f"Client disconnected ({self.client_count} total)")

    async def broadcast(self, event: str, data: dict[str, Any]) -> None:
        """
        Broadcast an event to all connected WebSocket clients.

        Args:
            event: Event name (e.g., "agent:thinking").
            data: Event payload.
        """
        if not self._clients:
            return

        message = json.dumps({
            "type": "event",
            "event": event,
            "data": data,
            "timestamp": int(time.time() * 1000),
        })

        # Send to all clients, removing any that fail
        dead_clients: set[WebSocket] = set()
        for client in self._clients:
            try:
                await client.send_text(message)
            except Exception:
                dead_clients.add(client)

        # Clean up dead connections
        self._clients -= dead_clients

    def _subscribe_to_events(self) -> None:
        """Subscribe to all event bus events and broadcast to WebSocket clients."""
        for event_type in EventType:
            event_name = event_type.value

            async def handler(data: dict[str, Any], _name: str = event_name) -> None:
                # Strip non-serializable data (like approval resolve callbacks)
                safe_data = {
                    k: v for k, v in data.items()
                    if not callable(v)
                }
                await self.broadcast(_name, safe_data)

            event_bus.on(event_name, handler)

        logger.info("websocket", f"Subscribed to {len(EventType)} event types")

    async def _handle_client_message(self, raw: str) -> None:
        """
        Handle an incoming message from a WebSocket client.

        Supported message types:
        - start_pipeline: Start a new pipeline execution
        - approve: Approve or reject a stage in human-aided mode
        - ping: Respond with pong
        """
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            logger.warn("websocket", "Received invalid JSON from client")
            return

        msg_type = msg.get("type", "")

        if msg_type == "start_pipeline":
            task = msg.get("task", "")
            mode = msg.get("mode", "auto")
            if not task:
                logger.warn("websocket", "start_pipeline missing task field")
                return

            logger.info("websocket", f'Starting pipeline via WS: "{task}" mode={mode}')

            if self._pipeline:
                if mode == "auto":
                    asyncio.create_task(
                        self._pipeline.execute_autonomous(task=task)
                    )
                else:
                    asyncio.create_task(
                        self._pipeline.execute(task=task, mode=mode)
                    )

        elif msg_type == "cancel_pipeline":
            logger.info("websocket", "Pipeline cancel requested via WS")
            if self._pipeline:
                self._pipeline.cancel()

        elif msg_type == "approve":
            stage = msg.get("stage", "")
            approved = msg.get("approved", False)
            if not stage:
                logger.warn("websocket", "approve missing stage field")
                return

            if self._pipeline:
                self._pipeline.approve_stage(stage, approved)
                action = "approved" if approved else "rejected"
                logger.info("websocket", f'Stage "{stage}" {action} via WS')

        elif msg_type == "ping":
            # Respond with pong (handled by the connection loop)
            pass

        else:
            logger.warn("websocket", f"Unknown message type: {msg_type}")


# Module-level singleton
ws_manager = WebSocketManager()
