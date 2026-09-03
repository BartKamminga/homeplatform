from fastapi import APIRouter, Depends
from sqlmodel import Session

from core.auth import get_current_user
from core.database import get_session
from core.logging import log_action
from models.core import User
from routers.mindbox import MindboxItemOut
import services.mindbox_links as svc

# Los router-bestand (i.p.v. toevoegen aan het al 440+ regels tellende
# routers/mindbox.py) - zie CLAUDE.md bestandsgrens-afspraak, item 1058.
router = APIRouter(prefix="/api/mindbox", tags=["mindbox"])


@router.post("/items/{item_id}/cases/{case_id}", response_model=MindboxItemOut)
def link_item_case(
    item_id: str,
    case_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    item = svc.link_item_to_case(session, user, item_id, case_id)
    log_action(session, "mindbox.item.case_link", site="mindbox", user_id=user.id,
               payload={"item_id": item_id, "case_ids": item["case_ids"]})
    return item


@router.delete("/items/{item_id}/cases/{case_id}", response_model=MindboxItemOut)
def unlink_item_case(
    item_id: str,
    case_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    item = svc.unlink_item_from_case(session, user, item_id, case_id)
    log_action(session, "mindbox.item.case_unlink", site="mindbox", user_id=user.id,
               payload={"item_id": item_id, "case_id": case_id})
    return item
