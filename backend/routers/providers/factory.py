"""BeatCrades — factory: retourneert de juiste DownloadProvider op basis van source."""

from core.settings import settings
from .base import DownloadProvider

_BEATPORT_SOURCES = frozenset(["beatport", "beatsource"])

# Runtime override — verloren na herstart (env var blijft de productie-default).
_provider_override: str | None = None


def get_active_beatport_provider() -> str:
    """Actieve Beatport-provider: runtime override heeft voorrang op env var."""
    return _provider_override or settings.BEATPORT_PROVIDER


def set_beatport_provider(value: str) -> None:
    """Stel de Beatport-provider in voor de huidige serverinstantie."""
    global _provider_override
    _provider_override = value


def get_provider(source: str) -> DownloadProvider:
    """Retourneert de correcte provider voor de opgegeven bron."""
    if source in _BEATPORT_SOURCES:
        if get_active_beatport_provider() == "native":
            from .beatport.native.provider import NativeBeatportProvider
            return NativeBeatportProvider()
        from .beatport.binary import BinaryBeatportProvider
        return BinaryBeatportProvider()

    from .ytdlp.provider import YtdlpProvider
    return YtdlpProvider()
