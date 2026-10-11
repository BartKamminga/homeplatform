import base64
import hashlib
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Optional
from jose import JWTError, jwk, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

from core.settings import settings
from core.database import get_session
from models.core import User, UserGroup, Group, UserApiKey

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

ADMIN_GROUP = "admins"
GUEST_GROUP = "guest"
PROTECTED_GROUPS = frozenset({"admins", "members", "guest"})


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


@lru_cache
def _rsa_keys() -> Optional[tuple[str, dict]]:
    """(private PEM, public JWK) uit JWT_PRIVATE_KEY_B64, of None als er geen
    sleutel is ingesteld (dan blijft alles HS256)."""
    if not settings.JWT_PRIVATE_KEY_B64:
        return None
    private_pem = base64.b64decode(settings.JWT_PRIVATE_KEY_B64).decode()
    public_jwk = jwk.construct(private_pem, "RS256").public_key().to_dict()
    public_jwk.update({"kid": settings.JWT_KEY_ID, "use": "sig", "alg": "RS256"})
    return private_pem, public_jwk


def public_jwks() -> dict:
    keys = _rsa_keys()
    return {"keys": [keys[1]] if keys else []}


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    keys = _rsa_keys()
    if keys:
        return jwt.encode(to_encode, keys[0], algorithm="RS256", headers={"kid": settings.JWT_KEY_ID})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    """RS256 (eigen sleutel, op kid) of - tijdens de overgang - HS256 met SECRET_KEY."""
    try:
        header = jwt.get_unverified_header(token)
        keys = _rsa_keys()
        if header.get("alg") == "RS256":
            if not keys or header.get("kid") != settings.JWT_KEY_ID:
                raise JWTError("Onbekende sleutel")
            return jwt.decode(token, keys[1], algorithms=["RS256"])
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ongeldige of verlopen token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    # API key pad: tokens beginnen met "hp_"
    if token.startswith("hp_"):
        key_hash = hash_api_key(token)
        api_key = session.exec(
            select(UserApiKey)
            .where(UserApiKey.key_hash == key_hash)
            .where(UserApiKey.revoked_at.is_(None))
        ).first()
        if not api_key:
            raise HTTPException(status_code=401, detail="Ongeldige API key",
                                headers={"WWW-Authenticate": "Bearer"})
        user = session.get(User, api_key.user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Gebruiker niet gevonden of inactief")
        # last_used_at bijhouden (best-effort)
        api_key.last_used_at = datetime.utcnow()
        session.add(api_key)
        session.commit()
        return user

    # JWT pad
    payload = decode_token(token)
    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Ongeldige token")
    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Gebruiker niet gevonden of inactief")
    return user


def require_admin(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> User:
    groups = session.exec(
        select(Group)
        .join(UserGroup, UserGroup.group_id == Group.id)
        .where(UserGroup.user_id == current_user.id)
        .where(Group.slug == ADMIN_GROUP)
    ).first()

    if not groups:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Alleen admins hebben toegang",
        )
    return current_user
