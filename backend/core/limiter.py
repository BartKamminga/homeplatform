import os
import time
from slowapi import Limiter
from slowapi.util import get_remote_address


def _key_func(request):
    # Geef elke request een unieke key in testmodus zodat limieten nooit worden geraakt
    if os.getenv("TESTING"):
        return f"test_{time.time_ns()}"
    return get_remote_address(request)


limiter = Limiter(key_func=_key_func)
