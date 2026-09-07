"""Permanente scan-totalen (item: 'zowel de vanger-queue als het archief zijn
te clearen, dus geen van beide is een betrouwbare historie') - bijgewerkt op
het moment dat een ECHT resultaat binnenkomt (post_cmd_result), onafhankelijk
van of de onderliggende VangerCmd/DataCapture-rij later wordt opgeruimd."""

from datetime import datetime
from typing import Optional

from sqlmodel import Session, select

from models.hockey_discovery import ScanHistoryDaily

UNKNOWN_REASON = "onbekend"


def record_scan_outcome(
    session: Session, reason: Optional[str], success: bool, when: Optional[datetime] = None,
    target_type: Optional[str] = None, target_id: Optional[int] = None,
) -> None:
    date_str = (when or datetime.utcnow()).date().isoformat()
    reason = reason or UNKNOWN_REASON
    outcome = "success" if success else "failed"

    row = session.exec(
        select(ScanHistoryDaily)
        .where(ScanHistoryDaily.date == date_str)
        .where(ScanHistoryDaily.reason == reason)
        .where(ScanHistoryDaily.outcome == outcome)
        .where(ScanHistoryDaily.target_type == target_type)
        .where(ScanHistoryDaily.target_id == target_id)
    ).first()
    if row:
        row.count += 1
        session.add(row)
    else:
        session.add(ScanHistoryDaily(
            date=date_str, reason=reason, outcome=outcome, count=1,
            target_type=target_type, target_id=target_id,
        ))
