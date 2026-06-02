from sqlmodel import Session, select
from models.core import Theme


def get_active_theme(session: Session) -> Theme | None:
    """Geeft het standaard thema terug."""
    return session.exec(
        select(Theme).where(Theme.is_default == True)
    ).first()


def get_theme_tokens(session: Session) -> dict:
    """Geeft de CSS tokens van het actieve thema als dict."""
    theme = get_active_theme(session)
    if theme and theme.tokens:
        return theme.tokens
    return {
        "--color-primary": "#534AB7",
        "--color-surface": "#F1EFE8",
        "--font-base": "'Inter', sans-serif",
        "--radius-md": "8px",
    }
