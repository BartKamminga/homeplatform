"""Permanente scan-totalen (item: 'zowel de vanger-queue als het archief zijn
te clearen, dus geen van beide is een betrouwbare historie') - bijgewerkt op
het moment dat een ECHT resultaat binnenkomt (post_cmd_result), onafhankelijk
van of de onderliggende VangerCmd/DataCapture-rij later wordt opgeruimd."""

from datetime import datetime
from typing import Optional

from sqlmodel import Session, select

from models.hockey_discovery import ScanHistoryDaily

UNKNOWN_REASON = "onbekend"


def record_scan_outcome(session: Session, reason: Optional[str], success: bool, when: Optional[datetime] = None) -> None:
    date_str = (when or datetime.utcnow()).date().isoformat()
    reason = reason or UNKNOWN_REASON
    outcome = "success" if success else "failed"

    row = session.exec(
        select(ScanHistoryDaily)
        .where(ScanHistoryDaily.date == date_str)
        .where(ScanHistoryDaily.reason == reason)
        .where(ScanHistoryDaily.outcome == outcome)
    ).first()
    if row:
        row.count += 1
        session.add(row)
    else:
        session.add(ScanHistoryDaily(date=date_str, reason=reason, outcome=outcome, count=1))
