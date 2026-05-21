"""
LogForge Log Ingestion API
Accepts logs via API, file upload, and bulk ingestion.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from typing import Optional, List
import io

from app.core.security import get_current_user
from app.services.log_processor import log_processor_service

router = APIRouter()


class SingleLogRequest(BaseModel):
    message: str
    source: str = "api"
    source_type: str = "application"
    source_host: str = "localhost"


class BulkLogRequest(BaseModel):
    logs: List[str]
    source: str = "api"
    source_type: str = "application"
    source_host: str = "localhost"


@router.post("/single")
async def ingest_single_log(
    request: SingleLogRequest,
    current_user=Depends(get_current_user),
):
    """Ingest a single log entry via API."""
    success = await log_processor_service.ingest(
        request.message,
        source=request.source,
        source_type=request.source_type,
        source_host=request.source_host,
    )
    if not success:
        raise HTTPException(status_code=503, detail="Log queue is full, try again later")
    return {"status": "accepted", "queued": True}


@router.post("/bulk")
async def ingest_bulk_logs(
    request: BulkLogRequest,
    current_user=Depends(get_current_user),
):
    """Ingest multiple log entries at once."""
    count = await log_processor_service.ingest_batch(
        request.logs,
        source=request.source,
        source_type=request.source_type,
    )
    return {"status": "accepted", "ingested": count, "total": len(request.logs)}


@router.post("/upload")
async def upload_log_file(
    file: UploadFile = File(...),
    source: str = Query(default="upload"),
    source_type: str = Query(default="application"),
    current_user=Depends(get_current_user),
):
    """
    Upload a log file (TXT or JSON) for batch ingestion.
    Supports: auth.log, syslog, nginx access logs, JSON logs.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Validate file type
    allowed_extensions = {".log", ".txt", ".json", ".gz"}
    ext = "." + file.filename.split(".")[-1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {allowed_extensions}"
        )

    # Read and decode file
    content = await file.read()
    try:
        text = content.decode("utf-8", errors="replace")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode file as UTF-8")

    # Auto-detect source type from filename
    filename_lower = file.filename.lower()
    if "nginx" in filename_lower or "access" in filename_lower:
        source_type = "nginx"
    elif "auth" in filename_lower or "sshd" in filename_lower:
        source_type = "auth"
    elif "docker" in filename_lower:
        source_type = "docker"
    elif filename_lower.endswith(".json"):
        source_type = "json"

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    count = await log_processor_service.ingest_batch(
        lines,
        source=source or file.filename,
        source_type=source_type,
    )

    return {
        "status": "accepted",
        "filename": file.filename,
        "total_lines": len(lines),
        "ingested": count,
        "source_type": source_type,
    }


@router.get("/stats")
async def get_ingestion_stats(current_user=Depends(get_current_user)):
    """Get log ingestion pipeline statistics."""
    return log_processor_service.stats
