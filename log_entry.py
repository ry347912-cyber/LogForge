"""
LogForge Log Entry Model
Core data model for storing parsed log entries.
"""

from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Boolean, JSON
from sqlalchemy.sql import func
from app.core.database import Base
from datetime import datetime


class LogEntry(Base):
    """Represents a single normalized log entry from any source."""

    __tablename__ = "log_entries"

    id = Column(Integer, primary_key=True, index=True)

    # Source identification
    source = Column(String(100), index=True, nullable=False)  # nginx, auth, docker, etc.
    source_host = Column(String(255), default="localhost")
    source_type = Column(String(50), default="application")  # system, docker, nginx, auth, app

    # Log content
    raw_message = Column(Text, nullable=False)
    parsed_message = Column(Text)
    log_level = Column(String(20), index=True, default="INFO")  # DEBUG/INFO/WARNING/ERROR/CRITICAL

    # Extracted metadata
    timestamp = Column(DateTime, index=True, default=datetime.utcnow)
    ingested_at = Column(DateTime, server_default=func.now())
    ip_address = Column(String(50), index=True)
    user_agent = Column(String(500))
    username = Column(String(100), index=True)
    request_path = Column(String(500))
    http_status = Column(Integer)
    response_time = Column(Float)

    # AI/ML fields
    anomaly_score = Column(Float, default=0.0)     # 0-1, higher = more anomalous
    is_anomaly = Column(Boolean, default=False)
    incident_type = Column(String(100))             # brute_force, port_scan, etc.
    severity_score = Column(Float, default=0.0)    # Computed severity 0-10

    # Full parsed data as JSON (named log_metadata to avoid SQLAlchemy reserved name)
    log_metadata = Column("metadata", JSON, default={})

    def to_dict(self):
        return {
            "id": self.id,
            "source": self.source,
            "source_host": self.source_host,
            "source_type": self.source_type,
            "raw_message": self.raw_message,
            "parsed_message": self.parsed_message,
            "log_level": self.log_level,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "ingested_at": self.ingested_at.isoformat() if self.ingested_at else None,
            "ip_address": self.ip_address,
            "username": self.username,
            "http_status": self.http_status,
            "response_time": self.response_time,
            "anomaly_score": self.anomaly_score,
            "is_anomaly": self.is_anomaly,
            "incident_type": self.incident_type,
            "severity_score": self.severity_score,
            "metadata": self.log_metadata or {},
        }
