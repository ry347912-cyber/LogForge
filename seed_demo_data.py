#!/usr/bin/env python3
"""
LogForge Demo Data Seeder
Seeds the database with realistic sample logs for demonstration.
Run: python scripts/seed_demo_data.py
"""

import asyncio
import sys
import os
import random
from datetime import datetime, timedelta

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.core.database import init_db, AsyncSessionLocal
from app.models.log_entry import LogEntry
from app.models.alert import Alert

# Sample data templates
NGINX_LOGS = [
    '192.168.1.{ip} - - [{ts}] "GET /api/users HTTP/1.1" 200 1234 "-" "Mozilla/5.0"',
    '10.0.0.{ip} - admin [{ts}] "POST /api/auth/login HTTP/1.1" 401 89 "-" "curl/7.68"',
    '203.0.113.{ip} - - [{ts}] "GET /admin/ HTTP/1.1" 403 45 "-" "Python/3.9"',
    '172.16.0.{ip} - - [{ts}] "GET /health HTTP/1.1" 200 12 "-" "healthcheck/1.0"',
    '10.0.0.{ip} - - [{ts}] "GET /api/dashboard HTTP/1.1" 500 234 "-" "axios/1.0"',
    '198.51.100.{ip} - - [{ts}] "GET /../etc/passwd HTTP/1.1" 400 0 "-" "scanner/1.0"',
]

AUTH_LOGS = [
    'Jan 15 {time} webserver sshd[1234]: Failed password for invalid user admin from 203.0.113.{ip} port {port} ssh2',
    'Jan 15 {time} webserver sshd[1234]: Failed password for root from 198.51.100.{ip} port {port} ssh2',
    'Jan 15 {time} webserver sshd[1234]: Accepted password for deploy from 10.0.0.{ip} port {port} ssh2',
    'Jan 15 {time} webserver sshd[1234]: Invalid user webmaster from 203.0.113.{ip} port {port}',
    'Jan 15 {time} webserver sudo[5678]: admin : TTY=pts/0 ; USER=root ; COMMAND=/bin/systemctl restart nginx',
]

APP_LOGS = [
    '{{"timestamp":"{ts}Z","level":"INFO","message":"Request processed","service":"api","duration_ms":{dur},"ip":"10.0.0.{ip}"}}',
    '{{"timestamp":"{ts}Z","level":"ERROR","message":"Database connection failed","service":"api","host":"app-01"}}',
    '{{"timestamp":"{ts}Z","level":"WARNING","message":"High memory usage: {mem}%","service":"worker","host":"worker-01"}}',
    '{{"timestamp":"{ts}Z","level":"CRITICAL","message":"Disk space low: {disk}%","service":"monitor","host":"storage-01"}}',
    '{{"timestamp":"{ts}Z","level":"INFO","message":"User login","service":"auth","user":"user{uid}","ip":"192.168.1.{ip}"}}',
    '{{"timestamp":"{ts}Z","level":"ERROR","message":"Payment failed","service":"payments","amount":{amount}}}',
]

SAMPLE_ALERTS = [
    {
        "title": "Brute Force Attack Detected",
        "description": "203.0.113.45 made 47 failed login attempts in 5 minutes",
        "severity": "HIGH",
        "alert_type": "brute_force",
        "ip_address": "203.0.113.45",
        "event_count": 47,
        "confidence_score": 0.92,
        "ai_analysis": "IP 203.0.113.45 is conducting automated brute-force attacks against SSH. The pattern shows sequential port numbers and common username enumeration (admin, root, ubuntu).",
        "remediation": "iptables -A INPUT -s 203.0.113.45 -j DROP\nInstall fail2ban: apt-get install fail2ban\nEnable MFA for all accounts\nConsider moving SSH to non-standard port",
    },
    {
        "title": "Anomaly Spike: 89 Anomalous Events",
        "description": "Unusual spike in anomalous log activity detected in the last 10 minutes",
        "severity": "MEDIUM",
        "alert_type": "anomaly_spike",
        "event_count": 89,
        "confidence_score": 0.75,
        "ai_analysis": "An anomalous spike was detected correlating with increased 500 errors and failed authentication attempts. This may indicate a coordinated attack or service degradation.",
        "remediation": "Review anomalous logs in the dashboard\nCheck application server CPU and memory\nVerify database connectivity\nInspect upstream load balancer logs",
    },
    {
        "title": "Disk Space Critical: storage-01 at 97%",
        "description": "Primary storage node is critically low on disk space",
        "severity": "CRITICAL",
        "alert_type": "disk_critical",
        "event_count": 1,
        "confidence_score": 1.0,
        "ai_analysis": "Storage node storage-01 has only 3% disk space remaining. This will cause service failures if not addressed immediately.",
        "remediation": "1. Identify large files: du -sh /* | sort -rh | head -20\n2. Clean log rotation: logrotate -f /etc/logrotate.conf\n3. Remove old Docker images: docker system prune -af\n4. Consider expanding volume or adding storage",
    },
]


async def seed():
    print("🌱 Seeding LogForge with demo data...")
    await init_db()

    async with AsyncSessionLocal() as session:
        now = datetime.utcnow()
        entries = []

        # Generate 300 log entries spread over last 24 hours
        for i in range(300):
            hours_ago = random.uniform(0, 24)
            ts = now - timedelta(hours=hours_ago)

            # Pick random log type
            log_type = random.choice(['nginx', 'auth', 'app'])
            ip_last = random.randint(1, 254)
            port = random.randint(40000, 65000)
            ts_str = ts.strftime('%Y-%m-%dT%H:%M:%S')
            nginx_ts = ts.strftime('%d/%b/%Y:%H:%M:%S +0000')
            auth_time = ts.strftime('%H:%M:%S')

            if log_type == 'nginx':
                tmpl = random.choice(NGINX_LOGS)
                raw = tmpl.format(ip=ip_last, ts=nginx_ts)
                source, source_type = 'nginx-access', 'nginx'
            elif log_type == 'auth':
                tmpl = random.choice(AUTH_LOGS)
                raw = tmpl.format(ip=ip_last, port=port, time=auth_time)
                source, source_type = 'sshd', 'auth'
            else:
                tmpl = random.choice(APP_LOGS)
                raw = tmpl.format(
                    ts=ts_str, ip=ip_last,
                    dur=random.randint(10, 5000),
                    mem=random.randint(60, 99),
                    disk=random.randint(80, 99),
                    uid=random.randint(1, 100),
                    amount=round(random.uniform(10, 999), 2),
                )
                source, source_type = 'app-api', 'json'

            # Determine level
            level = 'INFO'
            if 'error' in raw.lower() or '500' in raw or 'critical' in raw.lower():
                level = 'ERROR' if 'critical' not in raw.lower() else 'CRITICAL'
            elif 'warning' in raw.lower() or '401' in raw or '403' in raw or 'failed' in raw.lower():
                level = 'WARNING'

            # Anomaly for suspicious entries
            is_anomaly = any(x in raw.lower() for x in ['failed password', 'invalid user', 'etc/passwd', '403', '500', 'critical'])
            anomaly_score = round(random.uniform(0.6, 0.95), 3) if is_anomaly else round(random.uniform(0, 0.3), 3)

            entry = LogEntry(
                raw_message=raw[:500],
                parsed_message=raw[:300],
                source=source,
                source_type=source_type,
                source_host='demo-server-01',
                log_level=level,
                timestamp=ts,
                ip_address=f'192.168.1.{ip_last}' if log_type == 'nginx' else (
                    f'203.0.113.{ip_last}' if 'failed' in raw.lower() else f'10.0.0.{ip_last}'
                ),
                anomaly_score=anomaly_score,
                is_anomaly=is_anomaly,
                severity_score=round(random.uniform(0, 10) if is_anomaly else random.uniform(0, 4), 1),
            )
            entries.append(entry)

        session.add_all(entries)

        # Add sample alerts
        for a in SAMPLE_ALERTS:
            alert = Alert(
                triggered_at=now - timedelta(minutes=random.randint(5, 120)),
                **a,
            )
            session.add(alert)

        await session.commit()
        print(f"✅ Seeded {len(entries)} log entries and {len(SAMPLE_ALERTS)} alerts")
        print("🎯 Log in at http://localhost:3000 with admin/admin123")


if __name__ == '__main__':
    asyncio.run(seed())
