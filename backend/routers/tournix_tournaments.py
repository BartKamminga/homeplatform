"""Tournix — publicatie CRUD en competitie-koppelingen."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from core.database import get_session
from core.auth import get_current_user, require_admin
from core.crud import get_or_404
from core.logging import log_action
from models.core import User
from models.tournix import (
    Tournament,
    TournixPool, TournixTeam, TournixField, TournixMatch,
    TournixPrediction, TournixSnapshot, TournixPhase,
    TournixPhaseTeam, TournixPhaseField,
    TournixTournamentCompetition, TournixTournamentFase, TournixFaseTag,
    TournixCompetitionFaseTag,
)
from models.hockey_discovery import HockeyCompetition, HockeyPoule

router = APIRouter(prefix="/api/tournix", tags=["tournix"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class TournamentCreate(BaseModel):
    name:        str
    season:      Optional[str] = None
    description: Optional[str] = None

class TournamentUpdate(BaseModel):
    name:        Optional[str]  = None
    season:      Optional[str]  = None
    description: Optional[str]  = None
    status:      Optional[str]  = None
    order:       Optional[int]  = None
    published:   Optional[bool] = None
    info:        Optional[str]  = None

class TournamentsReorder(BaseModel):
    ids: list


# ── Tournament endpoints ──────────────────────────────────────────────────────

@router.get("/tournaments")
def list_tournaments(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    tournaments = session.exec(
        select(Tournament).order_by(Tournament.order, Tournament.created_at.desc())
    ).all()
    result = []
    for t in tournaments:
        count = len(session.exec(
            select(TournixTournamentCompetition)
            .where(TournixTournamentCompetition.tournament_id == t.id)
        ).all())
        d = t.model_dump()
        d["competition_count"] = count
        result.append(d)
    return result


@router.get("/tournaments/{tid}")
def get_tournament(
    tid: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return get_or_404(session, Tournament, tid, "Publicatie")


@router.post("/tournaments", status_code=201)
def create_tournament(
    body: TournamentCreate,
    session: Session = Depends(get_session),
    user: User = Depends(require_admin),
):
    t = Tournament(**body.model_dump(exclude_none=True), created_by=user.id)
    session.add(t)
    session.commit()
    session.refresh(t)
    log_action(session, "tournix.tournament.create", user_id=user.id, payload={"name": t.name})
    return t


@router.patch("/tournaments/reorder")
def reorder_tournaments(
    body: TournamentsReorder,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    for i, tid in enumerate(body.ids):
        t = session.get(Tournament, tid)
        if t:
            t.order = i
            session.add(t)
    session.commit()
    return {"ok": True}


@router.patch("/tournaments/{tid}")
def update_tournament(
    tid: str,
    body: TournamentUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(require_admin),
):
    t = get_or_404(session, Tournament, tid, "Publicatie")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(t, k, v)
    session.add(t)
    session.commit()
    session.refresh(t)
    return t


@router.delete("/tournaments/{tid}", status_code=204)
def delete_tournament(tid: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    t = get_or_404(session, Tournament, tid, "Publicatie")
    # Cascade: verwijder gekoppelde competities en fases
    for lnk in session.exec(select(TournixTournamentCompetition).where(TournixTournamentCompetition.tournament_id == tid)).all():
        session.delete(lnk)
    for fase in session.exec(select(TournixTournamentFase).where(TournixTournamentFase.tournament_id == tid)).all():
        session.delete(fase)
    # Oud materiaal dat nog in de DB kan zitten
    matches = session.exec(select(TournixMatch).where(TournixMatch.tournament_id == tid)).all()
    for m in matches:
        for p in session.exec(select(TournixPrediction).where(TournixPrediction.match_id == m.id)).all():
            session.delete(p)
        session.delete(m)
    for snap in session.exec(select(TournixSnapshot).where(TournixSnapshot.tournament_id == tid)).all():
        session.delete(snap)
    for phase in session.exec(select(TournixPhase).where(TournixPhase.tournament_id == tid)).all():
        for pt in session.exec(select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == phase.id)).all():
            session.delete(pt)
        for pf in session.exec(select(TournixPhaseField).where(TournixPhaseField.phase_id == phase.id)).all():
            session.delete(pf)
        session.delete(phase)
    for team in session.exec(select(TournixTeam).where(TournixTeam.tournament_id == tid)).all():
        session.delete(team)
    for field in session.exec(select(TournixField).where(TournixField.tournament_id == tid)).all():
        session.delete(field)
    for pool in session.exec(select(TournixPool).where(TournixPool.tournament_id == tid)).all():
        session.delete(pool)
    session.delete(t)
    session.commit()


# ── Eigen fase-lijst per publicatie ───────────────────────────────────────────

class TournamentFaseCreate(BaseModel):
    name:  str
    order: int = 0


@router.get("/tournaments/{tid}/fases")
def list_tournament_fases(
    tid: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    get_or_404(session, Tournament, tid, "Publicatie")
    return session.exec(
        select(TournixTournamentFase)
        .where(TournixTournamentFase.tournament_id == tid)
        .order_by(TournixTournamentFase.order, TournixTournamentFase.name)
    ).all()


@router.post("/tournaments/{tid}/fases", status_code=201)
def add_tournament_fase(
    tid: str,
    body: TournamentFaseCreate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    get_or_404(session, Tournament, tid, "Publicatie")
    fase = TournixTournamentFase(tournament_id=tid, name=body.name.strip(), order=body.order)
    session.add(fase)
    session.commit()
    session.refresh(fase)
    return fase


@router.delete("/tournaments/{tid}/fases/{fase_id}", status_code=204)
def remove_tournament_fase(
    tid: str,
    fase_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    fase = session.get(TournixTournamentFase, fase_id)
    if not fase or fase.tournament_id != tid:
        raise HTTPException(404, "Fase niet gevonden")
    session.delete(fase)
    session.commit()


# ── Tournament-competitie koppelingen ─────────────────────────────────────────

class CompetitionLinkCreate(BaseModel):
    competition_id: int
    order:          int = 0
    label:          Optional[str] = None


@router.get("/tournaments/{tid}/competitions")
def list_tournament_competitions(
    tid: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    get_or_404(session, Tournament, tid, "Publicatie")
    links = session.exec(
        select(TournixTournamentCompetition)
        .where(TournixTournamentCompetition.tournament_id == tid)
        .order_by(TournixTournamentCompetition.order)
    ).all()
    result = []
    for lnk in links:
        comp = session.get(HockeyCompetition, lnk.competition_id)
        poules = session.exec(
            select(HockeyPoule)
            .where(HockeyPoule.competition_id == lnk.competition_id)
            .order_by(HockeyPoule.name)
        ).all()
        assigned_tags = session.exec(
            select(TournixCompetitionFaseTag, TournixFaseTag)
            .join(TournixFaseTag, TournixCompetitionFaseTag.fase_tag_id == TournixFaseTag.id)
            .where(TournixCompetitionFaseTag.competition_link_id == lnk.id)
            .order_by(TournixFaseTag.order, TournixFaseTag.name)
        ).all()
        result.append({
            "id":             lnk.id,
            "tournament_id":  lnk.tournament_id,
            "competition_id": lnk.competition_id,
            "order":          lnk.order,
            "label":          lnk.label,
            "visible":        lnk.visible,
            "fase_tags":      [{"id": ft.id, "name": ft.name} for _, ft in assigned_tags],
            "competition":    {
                "id":          comp.id,
                "name":        comp.name,
                "class_name":  comp.class_name,
                "hockey_type": comp.hockey_type,
                "season":      comp.season,
            } if comp else None,
            "poules": [
                {"id": p.id, "name": p.name, "poule_id": p.poule_id}
                for p in poules
            ],
        })
    return result


class CompetitionLinkUpdate(BaseModel):
    fase:    Optional[str]  = None
    label:   Optional[str]  = None
    order:   Optional[int]  = None
    visible: Optional[bool] = None


@router.patch("/tournaments/{tid}/competitions/{link_id}")
def update_tournament_competition(
    tid: str,
    link_id: str,
    body: CompetitionLinkUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    lnk = session.get(TournixTournamentCompetition, link_id)
    if not lnk or lnk.tournament_id != tid:
        raise HTTPException(404, "Koppeling niet gevonden")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(lnk, k, v)
    session.add(lnk)
    session.commit()
    session.refresh(lnk)
    return lnk


@router.post("/tournaments/{tid}/competitions", status_code=201)
def add_tournament_competition(
    tid: str,
    body: CompetitionLinkCreate,
    session: Session = Depends(get_session),
    user: User = Depends(require_admin),
):
    get_or_404(session, Tournament, tid, "Publicatie")
    comp = session.get(HockeyCompetition, body.competition_id)
    if not comp:
        raise HTTPException(404, "Competitie niet gevonden")
    existing = session.exec(
        select(TournixTournamentCompetition)
        .where(TournixTournamentCompetition.tournament_id == tid)
        .where(TournixTournamentCompetition.competition_id == body.competition_id)
    ).first()
    if existing:
        raise HTTPException(409, "Competitie al gekoppeld aan deze publicatie")
    lnk = TournixTournamentCompetition(
        tournament_id=tid,
        competition_id=body.competition_id,
        order=body.order,
        label=body.label,
    )
    session.add(lnk)
    session.commit()
    session.refresh(lnk)

    # Auto-assign tags for class_name and district
    auto_tag_names = [v for v in [comp.class_name, comp.district] if v and v.strip()]
    for tag_name in auto_tag_names:
        tag = session.exec(select(TournixFaseTag).where(TournixFaseTag.name == tag_name)).first()
        if not tag:
            count = len(session.exec(select(TournixFaseTag)).all())
            tag = TournixFaseTag(name=tag_name, order=count)
            session.add(tag)
            session.flush()
        existing_ct = session.exec(
            select(TournixCompetitionFaseTag)
            .where(TournixCompetitionFaseTag.competition_link_id == lnk.id)
            .where(TournixCompetitionFaseTag.fase_tag_id == tag.id)
        ).first()
        if not existing_ct:
            session.add(TournixCompetitionFaseTag(competition_link_id=lnk.id, fase_tag_id=tag.id))
    session.commit()

    return lnk


@router.delete("/tournaments/{tid}/competitions/{link_id}", status_code=204)
def remove_tournament_competition(
    tid: str,
    link_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    lnk = session.get(TournixTournamentCompetition, link_id)
    if not lnk or lnk.tournament_id != tid:
        raise HTTPException(404, "Koppeling niet gevonden")
    for ct in session.exec(select(TournixCompetitionFaseTag).where(TournixCompetitionFaseTag.competition_link_id == link_id)).all():
        session.delete(ct)
    session.delete(lnk)
    session.commit()


class CompFaseTagAssign(BaseModel):
    fase_tag_id: str


@router.post("/tournaments/{tid}/competitions/{link_id}/fase-tags", status_code=201)
def assign_comp_fase_tag(
    tid: str,
    link_id: str,
    body: CompFaseTagAssign,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    lnk = session.get(TournixTournamentCompetition, link_id)
    if not lnk or lnk.tournament_id != tid:
        raise HTTPException(404, "Koppeling niet gevonden")
    tag = session.get(TournixFaseTag, body.fase_tag_id)
    if not tag:
        raise HTTPException(404, "Tag niet gevonden")
    existing = session.exec(
        select(TournixCompetitionFaseTag)
        .where(TournixCompetitionFaseTag.competition_link_id == link_id)
        .where(TournixCompetitionFaseTag.fase_tag_id == body.fase_tag_id)
    ).first()
    if existing:
        return {"id": existing.id, "fase_tag_id": tag.id, "name": tag.name}
    ct = TournixCompetitionFaseTag(competition_link_id=link_id, fase_tag_id=body.fase_tag_id)
    session.add(ct)
    session.commit()
    session.refresh(ct)
    return {"id": ct.id, "fase_tag_id": tag.id, "name": tag.name}


@router.delete("/tournaments/{tid}/competitions/{link_id}/fase-tags/{fase_tag_id}", status_code=204)
def remove_comp_fase_tag(
    tid: str,
    link_id: str,
    fase_tag_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    lnk = session.get(TournixTournamentCompetition, link_id)
    if not lnk or lnk.tournament_id != tid:
        raise HTTPException(404, "Koppeling niet gevonden")
    ct = session.exec(
        select(TournixCompetitionFaseTag)
        .where(TournixCompetitionFaseTag.competition_link_id == link_id)
        .where(TournixCompetitionFaseTag.fase_tag_id == fase_tag_id)
    ).first()
    if ct:
        session.delete(ct)
        session.commit()


# ── Globale fase-tags ─────────────────────────────────────────────────────────

class FaseTagCreate(BaseModel):
    name: str


@router.get("/fase-tags")
def list_fase_tags(session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return session.exec(select(TournixFaseTag).order_by(TournixFaseTag.order, TournixFaseTag.name)).all()


@router.post("/fase-tags", status_code=201)
def create_fase_tag(body: FaseTagCreate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Naam is verplicht")
    existing = session.exec(select(TournixFaseTag).where(TournixFaseTag.name == name)).first()
    if existing:
        return existing
    count = len(session.exec(select(TournixFaseTag)).all())
    tag = TournixFaseTag(name=name, order=count)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


@router.delete("/fase-tags/{tag_id}", status_code=204)
def delete_fase_tag(tag_id: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    tag = session.get(TournixFaseTag, tag_id)
    if not tag:
        raise HTTPException(404, "Tag niet gevonden")
    session.delete(tag)
    session.commit()
