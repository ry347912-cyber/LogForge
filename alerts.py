"""LogForge Alerts API"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.alert import Alert, Incident
from app.services.ai_analyst import ai_analyst
from app.models.log_entry import LogEntry

router = APIRouter()


class CreateAlertRequest(BaseModel):
    title: str
    description: str
    severity: str = "MEDIUM"
    alert_type: str = "manual"


@router.get("/")
async def list_alerts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    severity: Optional[str] = None,
    is_resolved: Optional[bool] = None,
    alert_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List alerts with filtering."""
    from sqlalchemy import func
    query = select(Alert).order_by(desc(Alert.triggered_at))

    if severity:
        query = query.where(Alert.severity == severity.upper())
    if is_resolved is not None:
        query = query.where(Alert.is_resolved == is_resolved)
    if alert_type:
        query = query.where(Alert.alert_type == alert_type)

    count_q = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_q)

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    alerts = result.scalars().all()

    return {
        "total": total,
        "alerts": [a.to_dict() for a in alerts],
    }


@router.get("/active")
async def get_active_alerts(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get unresolved alerts for the dashboard."""
    result = await db.execute(
        select(Alert)
        .where(Alert.is_resolved == False)
        .order_by(desc(Alert.triggered_at))
        .limit(20)
    )
    return [a.to_dict() for a in result.scalars().all()]


@router.get("/{alert_id}")
async def get_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get alert details with AI analysis."""
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert.to_dict()


@router.post("/{alert_id}/analyze")
async def analyze_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Generate AI root cause analysis for an alert."""
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Get related logs
    from datetime import timedelta
    since = alert.triggered_at - timedelta(minutes=5) if alert.triggered_at else datetime.utcnow() - timedelta(hours=1)
    result = await db.execute(
        select(LogEntry)
        .where(LogEntry.timestamp >= since)
        .order_by(desc(LogEntry.timestamp))
        .limit(30)
    )
    related_logs = [log.to_dict() for log in result.scalars().all()]

    analysis = await ai_analyst.analyze_incident(alert, related_logs)

    # Update alert with AI analysis
    await db.execute(
        update(Alert)
        .where(Alert.id == alert_id)
        .values(
            ai_analysis=analysis.get("root_cause", ""),
            remediation="\n".join(analysis.get("remediation_steps", [])),
        )
    )
    await db.commit()

    return {
        "alert_id": alert_id,
        "analysis": analysis,
    }


@router.post("/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Mark an alert as resolved."""
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    await db.execute(
        update(Alert)
        .where(Alert.id == alert_id)
        .values(
            is_resolved=True,
            resolved_at=datetime.utcnow(),
            acknowledged_by=current_user.username,
        )
    )
    await db.commit()
    return {"status": "resolved", "alert_id": alert_id}


@router.post("/")
async def create_alert(
    request: CreateAlertRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Manually create an alert."""
    alert = Alert(
        title=request.title,
        description=request.description,
        severity=request.severity.upper(),
        alert_type=request.alert_type,
        ai_analysis="Manual alert created by " + current_user.username,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert.to_dict()
