"""
LogForge Analytics API
Provides aggregated data for dashboard charts and metrics.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
from datetime import datetime, timedelta
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.log_entry import LogEntry
from app.models.alert import Alert

router = APIRouter()


@router.get("/overview")
async def get_overview(
    hours: int = Query(default=24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get dashboard overview statistics."""
    since = datetime.utcnow() - timedelta(hours=hours)

    # Total logs
    total_logs = await db.scalar(
        select(func.count(LogEntry.id)).where(LogEntry.timestamp >= since)
    )

    # By level
    level_result = await db.execute(
        select(LogEntry.log_level, func.count(LogEntry.id).label("count"))
        .where(LogEntry.timestamp >= since)
        .group_by(LogEntry.log_level)
    )
    by_level = {row.log_level: row.count for row in level_result}

    # Anomaly count
    anomaly_count = await db.scalar(
        select(func.count(LogEntry.id)).where(
            LogEntry.timestamp >= since,
            LogEntry.is_anomaly == True,
        )
    )

    # Active alerts
    active_alerts = await db.scalar(
        select(func.count(Alert.id)).where(Alert.is_resolved == False)
    )

    # Critical alerts (last 24h)
    critical_alerts = await db.scalar(
        select(func.count(Alert.id)).where(
            Alert.triggered_at >= since,
            Alert.severity.in_(["HIGH", "CRITICAL"]),
        )
    )

    # Unique IPs
    unique_ips = await db.scalar(
        select(func.count(func.distinct(LogEntry.ip_address)))
        .where(LogEntry.timestamp >= since, LogEntry.ip_address.isnot(None))
    )

    # Top sources
    top_sources_result = await db.execute(
        select(LogEntry.source, func.count(LogEntry.id).label("count"))
        .where(LogEntry.timestamp >= since)
        .group_by(LogEntry.source)
        .order_by(desc("count"))
        .limit(5)
    )
    top_sources = [{"source": r.source, "count": r.count} for r in top_sources_result]

    return {
        "total_logs": total_logs or 0,
        "anomaly_count": anomaly_count or 0,
        "active_alerts": active_alerts or 0,
        "critical_alerts": critical_alerts or 0,
        "unique_ips": unique_ips or 0,
        "by_level": by_level,
        "top_sources": top_sources,
        "error_count": by_level.get("ERROR", 0) + by_level.get("CRITICAL", 0),
        "warning_count": by_level.get("WARNING", 0),
    }


@router.get("/timeline")
async def get_timeline(
    hours: int = Query(default=24, ge=1, le=168),
    interval_minutes: int = Query(default=60, ge=5, le=1440),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get log volume over time for timeline chart."""
    since = datetime.utcnow() - timedelta(hours=hours)
    result = await db.execute(
        select(LogEntry.timestamp, LogEntry.log_level, LogEntry.is_anomaly)
        .where(LogEntry.timestamp >= since)
        .order_by(LogEntry.timestamp)
    )
    rows = result.all()

    # Bucket into time intervals
    buckets: dict = {}
    interval = timedelta(minutes=interval_minutes)

    for row in rows:
        ts = row.timestamp
        if not ts:
            continue
        bucket_time = ts.replace(
            minute=(ts.minute // interval_minutes) * interval_minutes,
            second=0, microsecond=0
        )
        key = bucket_time.isoformat()
        if key not in buckets:
            buckets[key] = {"time": key, "total": 0, "errors": 0, "warnings": 0, "anomalies": 0}
        buckets[key]["total"] += 1
        if row.log_level in ("ERROR", "CRITICAL"):
            buckets[key]["errors"] += 1
        elif row.log_level == "WARNING":
            buckets[key]["warnings"] += 1
        if row.is_anomaly:
            buckets[key]["anomalies"] += 1

    return sorted(buckets.values(), key=lambda x: x["time"])


@router.get("/top-ips")
async def get_top_ips(
    hours: int = Query(default=24),
    limit: int = Query(default=10),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get top IP addresses by request count and failure rate."""
    since = datetime.utcnow() - timedelta(hours=hours)
    result = await db.execute(
        select(
            LogEntry.ip_address,
            func.count(LogEntry.id).label("total"),
            func.sum(
                func.cast(LogEntry.log_level.in_(["ERROR", "CRITICAL"]), int)
            ).label("errors"),
        )
        .where(LogEntry.timestamp >= since, LogEntry.ip_address.isnot(None))
        .group_by(LogEntry.ip_address)
        .order_by(desc("total"))
        .limit(limit)
    )
    return [
        {
            "ip": r.ip_address,
            "total": r.total,
            "errors": r.errors or 0,
            "error_rate": round((r.errors or 0) / max(r.total, 1) * 100, 1),
        }
        for r in result
    ]


@router.get("/severity-distribution")
async def get_severity_distribution(
    hours: int = Query(default=24),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get log severity distribution for pie chart."""
    since = datetime.utcnow() - timedelta(hours=hours)
    result = await db.execute(
        select(LogEntry.log_level, func.count(LogEntry.id).label("count"))
        .where(LogEntry.timestamp >= since)
        .group_by(LogEntry.log_level)
        .order_by(desc("count"))
    )
    levels = [{"name": r.log_level, "value": r.count} for r in result]
    total = sum(l["value"] for l in levels)
    for l in levels:
        l["percentage"] = round(l["value"] / max(total, 1) * 100, 1)
    return levels


@router.get("/sources")
async def get_source_breakdown(
    hours: int = Query(default=24),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get log breakdown by source."""
    since = datetime.utcnow() - timedelta(hours=hours)
    result = await db.execute(
        select(
            LogEntry.source,
            LogEntry.source_type,
            func.count(LogEntry.id).label("count"),
        )
        .where(LogEntry.timestamp >= since)
        .group_by(LogEntry.source, LogEntry.source_type)
        .order_by(desc("count"))
        .limit(20)
    )
    return [{"source": r.source, "type": r.source_type, "count": r.count} for r in result]


@router.get("/ip-check/{ip_address}")
async def check_ip_reputation(
    ip_address: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Check IP address reputation and activity summary."""
    since = datetime.utcnow() - timedelta(hours=24)
    result = await db.execute(
        select(
            func.count(LogEntry.id).label("total"),
            LogEntry.log_level,
        )
        .where(LogEntry.ip_address == ip_address, LogEntry.timestamp >= since)
        .group_by(LogEntry.log_level)
    )
    rows = result.all()
    by_level = {r.log_level: r.total for r in rows}
    total = sum(by_level.values())
    errors = by_level.get("ERROR", 0) + by_level.get("CRITICAL", 0)
    warnings = by_level.get("WARNING", 0)

    risk_score = min(10, (errors * 2 + warnings) / max(total, 1) * 10)
    risk_level = "LOW" if risk_score < 3 else "MEDIUM" if risk_score < 6 else "HIGH"

    # Get recent activity
    recent = await db.execute(
        select(LogEntry)
        .where(LogEntry.ip_address == ip_address, LogEntry.timestamp >= since)
        .order_by(desc(LogEntry.timestamp))
        .limit(10)
    )

    return {
        "ip": ip_address,
        "total_requests": total,
        "error_count": errors,
        "warning_count": warnings,
        "risk_score": round(risk_score, 1),
        "risk_level": risk_level,
        "by_level": by_level,
        "recent_activity": [l.to_dict() for l in recent.scalars().all()],
        "is_suspicious": risk_score >= 6,
    }
