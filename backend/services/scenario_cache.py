"""Cache voor poule-simulaties (kansberekening, items 963/1232).

De sleutel bevat een vingerafdruk van precies de invoer van de berekening:
de stand (punten, doelpunten, gespeeld per team) en de nog niet gespeelde
wedstrijden. Komen er nieuwe standen of uitslagen binnen (scan), dan
verandert de vingerafdruk en wordt er vanzelf opnieuw gerekend - de oude
regel valt niet meer te raken en verdwijnt via LRU. Zo hoeft de scanner niets
van deze cache te weten en kan een vergeten "cache legen" nooit verouderde
kansen opleveren.

In-memory per proces (een herstart leegt hem ook). Monte-Carlo-uitkomsten
zijn daardoor binnen dezelfde stand ook stabiel i.p.v. per verzoek iets
anders.
"""

import hashlib
import threading
from collections import OrderedDict
from typing import Any, Callable, Hashable

MAX_ENTRIES = 512

_lock = threading.Lock()
_cache: "OrderedDict[tuple, Any]" = OrderedDict()
_stats = {"hits": 0, "misses": 0}


def inputs_fingerprint(standings, remaining) -> str:
    """Vingerafdruk van de simulatie-invoer, onafhankelijk van de volgorde
    waarin de database de rijen teruggeeft."""
    parts = sorted(repr(s) for s in standings) + ["|"] + sorted(repr(m) for m in remaining)
    return hashlib.sha1("\n".join(parts).encode()).hexdigest()


def cached(key: Hashable, compute: Callable[[], Any]) -> Any:
    with _lock:
        if key in _cache:
            _cache.move_to_end(key)
            _stats["hits"] += 1
            return _cache[key]
    value = compute()  # buiten de lock: een simulatie kan even duren
    with _lock:
        _stats["misses"] += 1
        _cache[key] = value
        _cache.move_to_end(key)
        while len(_cache) > MAX_ENTRIES:
            _cache.popitem(last=False)
    return value


def clear() -> None:
    with _lock:
        _cache.clear()


def stats() -> dict:
    with _lock:
        return {**_stats, "entries": len(_cache)}
