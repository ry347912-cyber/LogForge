"""
LogForge - AI-Powered Log Aggregation Platform
Main FastAPI Application Entry Point
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import asyncio
import json
import logging
from contextlib import asynccontextmanager

from app.core.database import init_db
from app.core.config import settings
from app.core.websocket_manager import manager
from app.api import logs, auth, alerts, analytics, ingestion, system
from app.services.log_processor import log_processor_service
from app.services.alert_service import alert_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("🚀 Starting LogForge Platform...")
    await init_db()
    await log_processor_service.start()
    await alert_service.start()
    logger.info("✅ LogForge Platform ready!")
    yield
    logger.info("🛑 Shutting down LogForge Platform...")
    await log_processor_service.stop()
    await alert_service.stop()


app = FastAPI(
    title="LogForge API",
    description="AI-Powered Self-Managed Log Aggregation Platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(logs.router, prefix="/api/logs", tags=["Logs"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(ingestion.router, prefix="/api/ingest", tags=["Log Ingestion"])
app.include_router(system.router, prefix="/api/system", tags=["System Health"])


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time log streaming."""
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            # Handle subscription requests
            if message.get("type") == "subscribe":
                await manager.subscribe(client_id, message.get("channel", "logs"))
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected")


@app.get("/api/health")
async def health_check():
    """Platform health check endpoint."""
    return {
        "status": "healthy",
        "platform": "LogForge",
        "version": "1.0.0",
    }
