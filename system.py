"""LogForge System Health API"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
import platform
import os

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.log_entry import LogEntry
from app.models.alert import Alert
from app.services.log_processor import log_processor_service
from app.core.websocket_manager import manager

router = APIRouter()


@router.get("/health")
async def system_health(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get comprehensive system health status."""
    # Database stats
    total_logs = await db.scalar(select(func.count(LogEntry.id)))
    active_alerts = await db.scalar(
        select(func.count(Alert.id)).where(Alert.is_resolved == False)
    )

    # Recent ingestion rate (logs in last 5 min)
    five_min_ago = datetime.utcnow() - timedelta(minutes=5)
    recent_logs = await db.scalar(
        select(func.count(LogEntry.id)).where(LogEntry.timestamp >= five_min_ago)
    )
    ingestion_rate = (recent_logs or 0) / 5  # logs per minute

    processor_stats = log_processor_service.stats

    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "platform": {
            "python": platform.python_version(),
            "os": platform.system(),
        },
        "database": {
            "total_logs": total_logs or 0,
            "active_alerts": active_alerts or 0,
        },
        "processor": processor_stats,
        "websocket": {
            "active_connections": manager.connection_count,
        },
        "ingestion": {
            "rate_per_minute": round(ingestion_rate, 1),
            "queue_size": processor_stats.get("queue_size", 0),
        },
    }


@router.get("/sources")
async def list_sources(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List all log sources seen in the last 24 hours."""
    since = datetime.utcnow() - timedelta(hours=24)
    result = await db.execute(
        select(
            LogEntry.source,
            LogEntry.source_type,
            LogEntry.source_host,
            func.count(LogEntry.id).label("count"),
            func.max(LogEntry.timestamp).label("last_seen"),
        )
        .where(LogEntry.timestamp >= since)
        .group_by(LogEntry.source, LogEntry.source_type, LogEntry.source_host)
        .order_by(func.count(LogEntry.id).desc())
    )
    return [
        {
            "source": r.source,
            "type": r.source_type,
            "host": r.source_host,
            "count": r.count,
            "last_seen": r.last_seen.isoformat() if r.last_seen else None,
        }
        for r in result
    ]
