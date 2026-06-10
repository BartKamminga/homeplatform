from collections import defaultdict
from datetime import datetime

api_call_stats: dict[str, int] = defaultdict(int)
api_call_since: str = datetime.utcnow().isoformat()
