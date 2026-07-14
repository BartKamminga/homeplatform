import hashlib
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
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


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
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
