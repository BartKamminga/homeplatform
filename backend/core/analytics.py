"""Shared analytics helpers — log page views and API calls for public sites."""

import hashlib
import logging
from datetime import datetime

from fastapi import Request
from sqlalchemy import text
from sqlmodel import Session

from core.database import engine

logger = logging.getLogger("homeplatform")

_IP_SALT = "homeplatform-analytics-v1"


def hash_ip(ip: str) -> str:
    return hashlib.sha256(f"{_IP_SALT}:{ip}".encode()).hexdigest()[:16]


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


def log_site_event(site: str, event_type: str, **kwargs):
    try:
        with Session(engine) as session:
            session.exec(
                text(
                    "INSERT INTO site_events "
                    "(site, event_type, ts, ip_hash, user_agent, endpoint, duration_ms, "
                    "status_code, result_count, source_url, cache_hit, token) "
                    "VALUES (:site, :event_type, :ts, :ip_hash, :user_agent, :endpoint, "
                    ":duration_ms, :status_code, :result_count, :source_url, :cache_hit, :token)"
                ),
                params={
                    "site": site,
                    "event_type": event_type,
                    "ts": datetime.utcnow().isoformat(sep=" "),
                    "ip_hash": kwargs.get("ip_hash"),
                    "user_agent": (kwargs.get("user_agent") or "")[:200],
                    "endpoint": kwargs.get("endpoint"),
                    "duration_ms": kwargs.get("duration_ms"),
                    "status_code": kwargs.get("status_code"),
                    "result_count": kwargs.get("result_count"),
                    "source_url": kwargs.get("source_url"),
                    "cache_hit": 1 if kwargs.get("cache_hit") else 0,
                    "token": kwargs.get("token"),
                },
            )
            session.commit()
    except Exception as exc:
        logger.warning("site_events: log failed for %s/%s — %s", site, event_type, exc)
