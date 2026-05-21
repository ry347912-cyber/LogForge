"""
LogForge WebSocket Manager
Manages real-time connections for live log streaming.
"""

from fastapi import WebSocket
from typing import Dict, Set
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and broadcasts."""

    def __init__(self):
        # Map client_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        # Map channel -> set of client_ids
        self.subscriptions: Dict[str, Set[str]] = {
            "logs": set(),
            "alerts": set(),
            "metrics": set(),
        }

    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        # Auto-subscribe to all channels
        for channel in self.subscriptions:
            self.subscriptions[channel].add(client_id)
        logger.info(f"Client {client_id} connected. Total: {len(self.active_connections)}")

    def disconnect(self, client_id: str):
        """Remove a disconnected client."""
        self.active_connections.pop(client_id, None)
        for channel in self.subscriptions.values():
            channel.discard(client_id)
        logger.info(f"Client {client_id} disconnected")

    async def subscribe(self, client_id: str, channel: str):
        """Subscribe client to a specific channel."""
        if channel in self.subscriptions:
            self.subscriptions[channel].add(client_id)

    async def broadcast(self, message: dict, channel: str = "logs"):
        """Broadcast a message to all subscribers of a channel."""
        if channel not in self.subscriptions:
            return

        disconnected = []
        for client_id in self.subscriptions[channel].copy():
            websocket = self.active_connections.get(client_id)
            if websocket:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception:
                    disconnected.append(client_id)

        # Clean up disconnected clients
        for client_id in disconnected:
            self.disconnect(client_id)

    async def send_personal(self, message: dict, client_id: str):
        """Send a message to a specific client."""
        websocket = self.active_connections.get(client_id)
        if websocket:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception:
                self.disconnect(client_id)

    @property
    def connection_count(self) -> int:
        return len(self.active_connections)


# Global singleton
manager = ConnectionManager()
