import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException, Request

from .config import get_settings


class SlidingWindow:
    """In-process sliding-window limiter. Fine for one instance; use a shared store behind several."""

    def __init__(self) -> None:
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int, window: float = 60.0) -> int | None:
        """Returns None when allowed, otherwise the seconds until a slot frees up."""
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            return max(1, int(window - (now - q[0])) + 1)
        q.append(now)
        return None

    def reset(self) -> None:
        self.hits.clear()


limiter = SlidingWindow()


def client_ip(request: Request) -> str:
    # Behind a trusted proxy, configure it to set X-Forwarded-For and run uvicorn with --proxy-headers.
    return request.client.host if request.client else "unknown"


def limit(bucket: str) -> Callable[[Request], None]:
    """FastAPI dependency: `bucket` is one of auth, submit, write, read."""

    def dep(request: Request) -> None:
        s = get_settings()
        per_min = {
            "auth": s.rate_limit_auth_per_min,
            "submit": s.rate_limit_submit_per_min,
            "write": s.rate_limit_write_per_min,
            "read": s.rate_limit_read_per_min,
        }[bucket]
        retry = limiter.check(f"{bucket}:{client_ip(request)}", per_min)
        if retry is not None:
            raise HTTPException(status_code=429, detail="Too many requests. Please slow down.", headers={"Retry-After": str(retry)})

    return dep
