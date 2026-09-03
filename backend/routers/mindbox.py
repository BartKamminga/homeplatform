from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlmodel import Session

from core.auth import get_current_user
from core.database import get_session
from core.logging import log_action
from models.core import User
import services.mindbox as svc

router = APIRouter(prefix="/api/mindbox", tags=["mindbox"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class MindboxCaseOut(BaseModel):
    id:          str
    name:        str
    status:      str
    description: Optional[str]
    context_id:  Optional[str]
    created_at:  datetime
    updated_at:  datetime


class MindboxCaseCreate(BaseModel):
    name:        str
    context_id:  Optional[str] = None


class MindboxCaseUpdate(BaseModel):
    name:           Optional[str] = None
    status:         Optional[str] = None
    description:    Optional[str] = None
    context_id:     Optional[str] = None
    clear_context:  bool = False


class MindboxCaseEventOut(BaseModel):
    id:           str
    event_type:   str
    description:  str
    created_at:   datetime


class MindboxCaseEventCreate(BaseModel):
    event_type:   str
    description:  str


class MindboxItemOut(BaseModel):
    id:                    str
    original_filename:     str
    content_type:          Optional[str]
    size_bytes:            int
    status:                str
    notes:                 Optional[str]
    parsed_text:           Optional[str]
    parent_item_id:        Optional[str]
    case_ids:              list[str]
    contact_ids:           list[str]
    created_at:            datetime
    updated_at:            datetime
    # Alleen gevuld direct na een upload zonder case_id, als suggestie (item
    # 1051) - nooit automatisch gekoppeld, altijd een voorstel.
    suggested_case_id:     Optional[str] = None
    suggested_case_name:   Optional[str] = None


class MindboxItemUpdate(BaseModel):
    status:         Optional[str] = None
    notes:          Optional[str] = None
    parsed_text:    Optional[str] = None


class MindboxContextOut(BaseModel):
    id:          str
    name:        str
    content:     str
    created_at:  datetime
    updated_at:  datetime


class MindboxContextCreate(BaseModel):
    name:     str
    content:  str


class MindboxContextUpdate(BaseModel):
    name:     Optional[str] = None
    content:  Optional[str] = None


class MindboxKnowledgeOut(BaseModel):
    id:          str
    name:        str
    content:     str
    created_at:  datetime
    updated_at:  datetime


class MindboxKnowledgeCreate(BaseModel):
    name:     str
    content:  str


class MindboxKnowledgeUpdate(BaseModel):
    name:     Optional[str] = None
    content:  Optional[str] = None


class MindboxResponseCreate(BaseModel):
    content:             str
    source_item_ids:     list[str] = []
    parent_response_id:  Optional[str] = None


class MindboxResponseUpdate(BaseModel):
    content: str


class MindboxResponseOut(BaseModel):
    id:                  str
    content:             str
    parent_response_id:  Optional[str]
    case_id:             str
    source_item_ids:     list[str]
    created_at:          datetime


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------

@router.get("/items", response_model=list[MindboxItemOut])
def list_items(
    case_id: Optional[str] = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return [svc.item_to_dict(session, i) for i in svc.get_items(session, user, case_id)]


@router.post("/items", response_model=MindboxItemOut)
async def upload_item(
    file: UploadFile = File(...),
    case_id: Optional[str] = None,
    force: bool = False,
    parent_item_id: Optional[str] = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    content = await file.read()
    item, suggested_case = svc.save_upload(
        session, user, file.filename, content, file.content_type, case_id, force, parent_item_id,
    )
    log_action(session, "mindbox.upload", site="mindbox", user_id=user.id,
               payload={"item_id": item.id, "filename": item.original_filename, "case_id": case_id, "parent_item_id": parent_item_id})
    return {
        **svc.item_to_dict(session, item),
        "suggested_case_id": suggested_case.id if suggested_case else None,
        "suggested_case_name": suggested_case.name if suggested_case else None,
    }


@router.get("/items/{item_id}/attachments", response_model=list[MindboxItemOut])
def list_attachments(
    item_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return [svc.item_to_dict(session, i) for i in svc.get_attachments(session, user, item_id)]


@router.patch("/items/{item_id}", response_model=MindboxItemOut)
def update_item(
    item_id: str,
    data: MindboxItemUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    item = svc.update_item(session, user, item_id, data.status, data.notes, data.parsed_text)
    log_action(session, "mindbox.update", site="mindbox", user_id=user.id,
               payload={"item_id": item.id, "fields": list(data.model_dump(exclude_unset=True))})
    return svc.item_to_dict(session, item)


@router.get("/items/{item_id}/download")
def download_item(
    item_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    abs_path, item = svc.get_item_file_path(session, user, item_id)
    return FileResponse(str(abs_path), filename=item.original_filename)


@router.delete("/items/{item_id}")
def delete_item(
    item_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    svc.delete_item(session, user, item_id)
    log_action(session, "mindbox.delete", site="mindbox", user_id=user.id, payload={"item_id": item_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Contexts (herbruikbare instructie-/persona-tekst, bv. "behandel als manager")
# ---------------------------------------------------------------------------

@router.get("/contexts", response_model=list[MindboxContextOut])
def list_contexts(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return svc.get_contexts(session, user)


@router.post("/contexts", response_model=MindboxContextOut)
def create_context(
    data: MindboxContextCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    context = svc.create_context(session, user, data.name, data.content)
    log_action(session, "mindbox.context.create", site="mindbox", user_id=user.id,
               payload={"context_id": context.id, "name": context.name})
    return context


@router.patch("/contexts/{context_id}", response_model=MindboxContextOut)
def update_context(
    context_id: str,
    data: MindboxContextUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    context = svc.update_context(session, user, context_id, data.name, data.content)
    log_action(session, "mindbox.context.update", site="mindbox", user_id=user.id,
               payload={"context_id": context.id, "fields": list(data.model_dump(exclude_unset=True))})
    return context


@router.delete("/contexts/{context_id}")
def delete_context(
    context_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    svc.delete_context(session, user, context_id)
    log_action(session, "mindbox.context.delete", site="mindbox", user_id=user.id, payload={"context_id": context_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Knowledge (generieke, cross-case kennis-/reference-info, bv. "NIPV-Info")
# ---------------------------------------------------------------------------

@router.get("/knowledge", response_model=list[MindboxKnowledgeOut])
def list_knowledge(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return svc.get_knowledge_list(session, user)


@router.post("/knowledge", response_model=MindboxKnowledgeOut)
def create_knowledge(
    data: MindboxKnowledgeCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    entry = svc.create_knowledge_entry(session, user, data.name, data.content)
    log_action(session, "mindbox.knowledge.create", site="mindbox", user_id=user.id,
               payload={"knowledge_id": entry.id, "name": entry.name})
    return entry


@router.patch("/knowledge/{knowledge_id}", response_model=MindboxKnowledgeOut)
def update_knowledge(
    knowledge_id: str,
    data: MindboxKnowledgeUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    entry = svc.update_knowledge_entry(session, user, knowledge_id, data.name, data.content)
    log_action(session, "mindbox.knowledge.update", site="mindbox", user_id=user.id,
               payload={"knowledge_id": entry.id, "fields": list(data.model_dump(exclude_unset=True))})
    return entry


@router.delete("/knowledge/{knowledge_id}")
def delete_knowledge(
    knowledge_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    svc.delete_knowledge_entry(session, user, knowledge_id)
    log_action(session, "mindbox.knowledge.delete", site="mindbox", user_id=user.id, payload={"knowledge_id": knowledge_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Cases (container die meerdere items/responses aan elkaar koppelt)
# ---------------------------------------------------------------------------

@router.get("/cases", response_model=list[MindboxCaseOut])
def list_cases(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return svc.get_cases(session, user)


@router.post("/cases", response_model=MindboxCaseOut)
def create_case(
    data: MindboxCaseCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    case = svc.create_case(session, user, data.name, data.context_id)
    log_action(session, "mindbox.case.create", site="mindbox", user_id=user.id, payload={"case_id": case.id, "name": case.name})
    return case


@router.patch("/cases/{case_id}", response_model=MindboxCaseOut)
def update_case(
    case_id: str,
    data: MindboxCaseUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    case = svc.update_case(
        session, user, case_id, data.name, data.status, data.description, data.context_id, data.clear_context,
    )
    log_action(session, "mindbox.case.update", site="mindbox", user_id=user.id, payload={"case_id": case.id})
    return case


@router.delete("/cases/{case_id}")
def delete_case(
    case_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    svc.delete_case(session, user, case_id)
    log_action(session, "mindbox.case.delete", site="mindbox", user_id=user.id, payload={"case_id": case_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Responses (VERPLICHT case-gescoped, item 1051: los bekijken is niet
# relevant - vandaar geen los /responses-endpoint meer maar altijd via
# /cases/{case_id}/responses, net als de events hieronder)
# ---------------------------------------------------------------------------

@router.get("/cases/{case_id}/responses", response_model=list[MindboxResponseOut])
def list_responses(
    case_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return svc.get_responses(session, user, case_id)


@router.post("/cases/{case_id}/responses", response_model=MindboxResponseOut)
def create_response(
    case_id: str,
    data: MindboxResponseCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    response = svc.create_response(
        session, user, case_id, data.content, data.source_item_ids, data.parent_response_id,
    )
    log_action(session, "mindbox.response.create", site="mindbox", user_id=user.id,
               payload={"response_id": response["id"], "case_id": case_id, "source_item_ids": data.source_item_ids})
    return response


@router.patch("/cases/{case_id}/responses/{response_id}", response_model=MindboxResponseOut)
def update_response(
    case_id: str,
    response_id: str,
    data: MindboxResponseUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    response = svc.update_response(session, user, case_id, response_id, data.content)
    log_action(session, "mindbox.response.update", site="mindbox", user_id=user.id,
               payload={"response_id": response_id, "case_id": case_id})
    return response


@router.get("/cases/{case_id}/responses/{response_id}/eml")
def download_response_eml(
    case_id: str,
    response_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    eml_bytes = svc.build_response_eml(session, user, case_id, response_id)
    return Response(
        content=eml_bytes,
        media_type="message/rfc822",
        headers={"Content-Disposition": f'attachment; filename="response-{response_id}.eml"'},
    )


# ---------------------------------------------------------------------------
# Case-events (tijdlijn - ook voor handmatige sessie-notities)
# ---------------------------------------------------------------------------

@router.get("/cases/{case_id}/events", response_model=list[MindboxCaseEventOut])
def list_case_events(
    case_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return svc.get_case_events(session, user, case_id)


@router.post("/cases/{case_id}/events", response_model=MindboxCaseEventOut)
def add_case_event(
    case_id: str,
    data: MindboxCaseEventCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    event = svc.add_case_event(session, user, case_id, data.event_type, data.description)
    log_action(session, "mindbox.case.event", site="mindbox", user_id=user.id,
               payload={"case_id": case_id, "event_type": data.event_type})
    return event
