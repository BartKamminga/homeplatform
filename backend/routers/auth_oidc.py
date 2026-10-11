"""Inloggen met Google en Microsoft via OpenID Connect (item 1271).

Generiek: een provider toevoegen = 1 regel in PROVIDERS + client-id/secret
in de env. Authorization code flow met PKCE + nonce; de state (provider,
nonce, code_verifier, intent, user, next) staat ondertekend in een kortlevende
httponly-cookie, de state-parameter aan de provider is alleen een random id
dat met die cookie moet kloppen (geen sessie-middleware nodig).

Koppelen gaat alleen bewust: ingelogd (wachtwoord) -> "Koppel Google" in het
account. Inloggen met een niet-gekoppelde identiteit geeft een nette melding,
nooit automatisch koppelen op e-mail (Microsoft-privéaccounts geven geen
email_verified). Na afloop gaat de browser terug naar de frontend met het
eigen JWT in het URL-fragment (komt niet in serverlogs)."""

import base64
import hashlib
import secrets
import time
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlmodel import Session, select

from core.auth import create_access_token, get_current_user, public_jwks
from core.database import get_session
from core.logging import log_action
from core.settings import settings
from models.core import User, UserIdentity

router = APIRouter(prefix="/api/auth/oidc", tags=["auth"])
identities_router = APIRouter(prefix="/api/auth/identities", tags=["auth"])
wellknown_router = APIRouter(tags=["auth"])

PROVIDERS = {
    "google": {
        "label": "Google",
        "discovery": "https://accounts.google.com/.well-known/openid-configuration",
        "client_id": lambda: settings.OIDC_GOOGLE_CLIENT_ID,
        "client_secret": lambda: settings.OIDC_GOOGLE_CLIENT_SECRET,
    },
    "microsoft": {
        "label": "Microsoft",
        # common = persoonlijke (Hotmail/Outlook) en werk/school-accounts
        "discovery": "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
        "client_id": lambda: settings.OIDC_MICROSOFT_CLIENT_ID,
        "client_secret": lambda: settings.OIDC_MICROSOFT_CLIENT_SECRET,
    },
}

STATE_COOKIE = "hp_oidc_state"
STATE_TTL_SECONDS = 600
LOGIN_PAGE = "/admin/login"
LINK_PAGE = "/account/profile"
_CACHE_TTL_SECONDS = 3600
_cache: dict[str, tuple[float, dict]] = {}


def _enabled(provider: str) -> bool:
    cfg = PROVIDERS.get(provider)
    return bool(cfg and cfg["client_id"]() and cfg["client_secret"]())


def _provider_or_404(provider: str) -> dict:
    if not _enabled(provider):
        raise HTTPException(status_code=404, detail="This sign-in method is not available")
    return PROVIDERS[provider]


def _fetch_json(url: str) -> dict:
    hit = _cache.get(url)
    if hit and hit[0] > time.time():
        return hit[1]
    data = httpx.get(url, timeout=10).raise_for_status().json()
    _cache[url] = (time.time() + _CACHE_TTL_SECONDS, data)
    return data


def _redirect_base() -> str:
    return (settings.OIDC_REDIRECT_BASE or settings.EXTERNAL_URL or "http://localhost:5172").rstrip("/")


def _redirect_uri(provider: str) -> str:
    return f"{_redirect_base()}/api/auth/oidc/{provider}/callback"


def _safe_next(next_path: Optional[str], default: str) -> str:
    """Alleen relatieve paden binnen de eigen site (geen open redirect)."""
    if next_path and next_path.startswith("/") and not next_path.startswith("//") and "\\" not in next_path:
        return next_path
    return default


def _authorize_url(provider: str, intent: str, next_path: str, user_id: Optional[str]) -> tuple[str, str]:
    """(url naar de provider, ondertekende state-cookie)."""
    cfg = _provider_or_404(provider)
    meta = _fetch_json(cfg["discovery"])
    sid, nonce, verifier = secrets.token_urlsafe(24), secrets.token_urlsafe(24), secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    cookie = jwt.encode({
        "sid": sid, "provider": provider, "nonce": nonce, "verifier": verifier, "intent": intent,
        "user_id": user_id, "next": next_path, "aud": "hp-oidc-state",
        "exp": datetime.utcnow() + timedelta(seconds=STATE_TTL_SECONDS),
    }, settings.SECRET_KEY, algorithm="HS256")
    query = urlencode({
        "client_id": cfg["client_id"](), "response_type": "code", "scope": "openid email profile",
        "redirect_uri": _redirect_uri(provider), "state": sid, "nonce": nonce,
        "code_challenge": challenge, "code_challenge_method": "S256", "prompt": "select_account",
    })
    return f"{meta['authorization_endpoint']}?{query}", cookie


def _with_state_cookie(response, cookie: str):
    response.set_cookie(STATE_COOKIE, cookie, max_age=STATE_TTL_SECONDS, httponly=True, samesite="lax",
                        secure=_redirect_base().startswith("https://"), path="/api/auth/oidc")
    return response


def _verify_id_token(provider: str, id_token: str, nonce: str) -> dict:
    cfg = PROVIDERS[provider]
    meta = _fetch_json(cfg["discovery"])
    jwks = _fetch_json(meta["jwks_uri"])
    claims = jwt.decode(id_token, jwks, algorithms=["RS256"], audience=cfg["client_id"](),
                        options={"verify_iss": False, "verify_at_hash": False})
    # Microsoft common: issuer bevat de tenant van de gebruiker ({tenantid} in discovery)
    expected_iss = meta["issuer"].replace("{tenantid}", claims.get("tid", ""))
    if claims.get("iss") != expected_iss:
        raise JWTError("Onverwachte issuer")
    if claims.get("nonce") != nonce:
        raise JWTError("Nonce klopt niet")
    return claims


def _exchange_code(provider: str, code: str, verifier: str) -> dict:
    cfg = PROVIDERS[provider]
    meta = _fetch_json(cfg["discovery"])
    res = httpx.post(meta["token_endpoint"], timeout=10, data={
        "grant_type": "authorization_code", "code": code, "redirect_uri": _redirect_uri(provider),
        "client_id": cfg["client_id"](), "client_secret": cfg["client_secret"](), "code_verifier": verifier,
    })
    if res.status_code != 200:
        raise JWTError(f"Token-uitwisseling mislukt ({res.status_code})")
    return res.json()


def _back(path: str, **fragment: str) -> RedirectResponse:
    response = RedirectResponse(f"{path}#{urlencode(fragment)}", status_code=302)
    response.delete_cookie(STATE_COOKIE, path="/api/auth/oidc")
    return response


@router.get("/providers")
def list_providers():
    """Publiek - welke knoppen de frontend toont."""
    return [{"id": key, "label": cfg["label"]} for key, cfg in PROVIDERS.items() if _enabled(key)]


@router.get("/{provider}/login")
def start_login(provider: str, next: Optional[str] = None):
    url, cookie = _authorize_url(provider, "login", _safe_next(next, "/admin/dashboard"), None)
    return _with_state_cookie(RedirectResponse(url, status_code=302), cookie)


class LinkIn(BaseModel):
    next: Optional[str] = None


@router.post("/{provider}/link")
def start_link(provider: str, body: LinkIn, current_user: User = Depends(get_current_user)):
    """Ingelogd - geeft de URL terug waar de frontend naartoe navigeert (een
    navigatie kan geen Authorization-header meesturen, deze fetch wel)."""
    url, cookie = _authorize_url(provider, "link", _safe_next(body.next, LINK_PAGE), current_user.id)
    return _with_state_cookie(JSONResponse({"url": url}), cookie)


@router.get("/{provider}/callback")
def callback(
    provider: str,
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    session: Session = Depends(get_session),
):
    try:
        st = jwt.decode(request.cookies.get(STATE_COOKIE, ""), settings.SECRET_KEY,
                        algorithms=["HS256"], audience="hp-oidc-state")
    except JWTError:
        return _back(LOGIN_PAGE, oidc_error="Sign-in took too long or was started in another browser. Please try again.")
    fail_page = LINK_PAGE if st["intent"] == "link" else LOGIN_PAGE
    if error or not code:
        return _back(fail_page, oidc_error="Sign-in was cancelled.")
    if state != st["sid"] or provider != st["provider"] or provider not in PROVIDERS:
        return _back(fail_page, oidc_error="Invalid sign-in attempt. Please try again.")

    try:
        tokens = _exchange_code(provider, code, st["verifier"])
        claims = _verify_id_token(provider, tokens["id_token"], st["nonce"])
    except (JWTError, KeyError, httpx.HTTPError):
        return _back(fail_page, oidc_error="Could not verify the sign-in. Please try again.")

    subject = claims["sub"]
    email = claims.get("email") or claims.get("preferred_username")
    identity = session.exec(
        select(UserIdentity).where(UserIdentity.provider == provider, UserIdentity.subject == subject)
    ).first()

    if st["intent"] == "link":
        if identity and identity.user_id != st["user_id"]:
            return _back(LINK_PAGE, oidc_error="This account is already linked to another user.")
        if not identity:
            identity = UserIdentity(user_id=st["user_id"], provider=provider, subject=subject, email=email)
            session.add(identity)
            session.commit()
            log_action(session, "user.identity_link", user_id=st["user_id"], payload={"provider": provider})
        return _back(st["next"], oidc_linked=provider)

    user = session.get(User, identity.user_id) if identity else None
    if not user or not user.is_active:
        return _back(LOGIN_PAGE, oidc_error=f"This {PROVIDERS[provider]['label']} account is not linked yet. "
                                            "Sign in with your password first and link it in your account.")
    identity.last_login_at = datetime.utcnow()
    if email:
        identity.email = email
    session.add(identity)
    session.commit()
    log_action(session, "login", user_id=user.id, payload={"provider": provider})
    return _back(LOGIN_PAGE, oidc_token=create_access_token({"sub": user.id}), next=st["next"])


@identities_router.get("")
def list_identities(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    rows = session.exec(select(UserIdentity).where(UserIdentity.user_id == current_user.id)).all()
    return [{"id": r.id, "provider": r.provider, "email": r.email, "linked_at": r.linked_at,
             "last_login_at": r.last_login_at} for r in rows]


@identities_router.delete("/{identity_id}", status_code=204)
def unlink_identity(identity_id: str, current_user: User = Depends(get_current_user),
                    session: Session = Depends(get_session)):
    identity = session.get(UserIdentity, identity_id)
    if not identity or identity.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Linked sign-in not found")
    session.delete(identity)
    session.commit()
    log_action(session, "user.identity_unlink", user_id=current_user.id, payload={"provider": identity.provider})


@wellknown_router.get("/.well-known/jwks.json")
@wellknown_router.get("/api/auth/jwks.json")
def jwks_endpoint():
    """Publieke sleutel(s) waarmee onze eigen tokens (RS256) te controleren zijn."""
    return public_jwks()
