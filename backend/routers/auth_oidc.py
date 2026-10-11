"""Inloggen met Google en Microsoft via OpenID Connect (item 1271).

Generiek: een provider toevoegen = 1 regel in PROVIDERS + client-id/secret
in de env. Authorization code flow met PKCE + nonce; de state (provider,
nonce, code_verifier, intent, user, next) staat ondertekend in een kortlevende
httponly-cookie, de state-parameter aan de provider is alleen een random id
dat met die cookie moet kloppen (geen sessie-middleware nodig).

Koppelen gaat alleen bewust: ingelogd (wachtwoord) -> "Koppel Google" in het
account. Inloggen met een niet-gekoppelde identiteit geeft een nette melding,
nooit automatisch koppelen op e-mail (Microsoft-privéaccounts geven geen
email_verified). Nieuwe gebruikers alleen via een uitnodiging: /signup maakt
het account aan zonder HP-wachtwoord en koppelt de login meteen. Na afloop gaat de browser terug naar de frontend met het
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

from core.auth import create_access_token, get_current_user, hash_password
from core.database import get_session
from core.invites import create_invited_user, open_invite, unique_username
from core.logging import log_action
from core.settings import settings
from models.core import User, UserIdentity

router = APIRouter(prefix="/api/auth/oidc", tags=["auth"])

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
INVITE_PAGE = "/account/invite"
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


def _authorize_url(provider: str, intent: str, next_path: str, **extra) -> tuple[str, str]:
    """(url naar de provider, ondertekende state-cookie). extra = user_id
    (koppelen) of invite + display_name (aanmelden via uitnodiging)."""
    cfg = _provider_or_404(provider)
    meta = _fetch_json(cfg["discovery"])
    sid, nonce, verifier = secrets.token_urlsafe(24), secrets.token_urlsafe(24), secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    cookie = jwt.encode({
        "sid": sid, "provider": provider, "nonce": nonce, "verifier": verifier, "intent": intent,
        "next": next_path, "aud": "hp-oidc-state", **extra,
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
    url, cookie = _authorize_url(provider, "login", _safe_next(next, "/admin/dashboard"))
    return _with_state_cookie(RedirectResponse(url, status_code=302), cookie)


class LinkIn(BaseModel):
    next: Optional[str] = None


@router.post("/{provider}/link")
def start_link(provider: str, body: LinkIn, current_user: User = Depends(get_current_user)):
    """Ingelogd - geeft de URL terug waar de frontend naartoe navigeert (een
    navigatie kan geen Authorization-header meesturen, deze fetch wel)."""
    url, cookie = _authorize_url(provider, "link", _safe_next(body.next, LINK_PAGE), user_id=current_user.id)
    return _with_state_cookie(JSONResponse({"url": url}), cookie)


@router.get("/{provider}/signup")
def start_signup(provider: str, invite: str, name: Optional[str] = None,
                 session: Session = Depends(get_session)):
    """Publiek - nieuw account via een uitnodiging, zonder HP-wachtwoord.
    name = optionele weergavenaam (anders de naam van Google/Microsoft)."""
    if not open_invite(session, invite):
        return _back(f"{INVITE_PAGE}/{invite}", oidc_error="This invitation is no longer valid.")
    url, cookie = _authorize_url(provider, "invite", "/landing/", invite=invite,
                                 display_name=(name or "").strip()[:80] or None)
    return _with_state_cookie(RedirectResponse(url, status_code=302), cookie)


def _accept_invite(session: Session, st: dict, provider: str, subject: str, email: Optional[str],
                   claimed_name: Optional[str], fail_page: str) -> RedirectResponse:
    invite = open_invite(session, st["invite"])
    if not invite:
        return _back(fail_page, oidc_error="This invitation is no longer valid.")
    if session.exec(select(UserIdentity).where(UserIdentity.provider == provider,
                                               UserIdentity.subject == subject)).first():
        return _back(LOGIN_PAGE, oidc_error=f"This {PROVIDERS[provider]['label']} account already has an account here. "
                                            "Sign in with it instead.")
    if email and session.exec(select(User).where(User.email == email)).first():
        return _back(fail_page, oidc_error="You already have an account with this email address. "
                                           "Sign in and link it in your account.")
    username = unique_username(session, email)
    user = create_invited_user(
        session, invite, username=username, email=email or f"{username}@homeplatform.local",
        # Geen bruikbaar wachtwoord: inloggen alleen via de gekoppelde login.
        password_hash=hash_password(secrets.token_urlsafe(32)),
        display_name=st.get("display_name") or claimed_name,
    )
    session.add(UserIdentity(user_id=user.id, provider=provider, subject=subject, email=email,
                             last_login_at=datetime.utcnow()))
    session.commit()
    log_action(session, "user.invite_accept", user_id=user.id, payload={"username": username, "provider": provider})
    return _back(LOGIN_PAGE, oidc_token=create_access_token({"sub": user.id}), next=st["next"])


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
    fail_page = {"link": LINK_PAGE, "invite": f"{INVITE_PAGE}/{st.get('invite')}"}.get(st["intent"], LOGIN_PAGE)
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

    if st["intent"] == "invite":
        return _accept_invite(session, st, provider, subject, email, claims.get("name"), fail_page)

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
