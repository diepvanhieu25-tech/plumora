"""Shared Redis ConnectionPool provider for Plumora backend and microservices."""

from __future__ import annotations

import threading
from typing import ClassVar

import redis

from app.config import settings


class RedisConnectionProvider:
    """Thread-safe singleton provider for pooled Redis clients."""

    _lock: ClassVar[threading.Lock] = threading.Lock()
    _pools: ClassVar[dict[tuple[str, bool, float], redis.ConnectionPool]] = {}

    @classmethod
    def get_redis_client(
        cls,
        url: str | None = None,
        *,
        decode_responses: bool = True,
        socket_timeout: float = 0.5,
        max_connections: int = 64,
    ) -> redis.Redis:
        """Return a Redis client backed by a shared ConnectionPool."""
        resolved_url = (url or settings.redis_url).strip()
        key = (resolved_url, decode_responses, socket_timeout)
        pool = cls._pools.get(key)
        if pool is None:
            with cls._lock:
                pool = cls._pools.get(key)
                if pool is None:
                    pool = redis.ConnectionPool.from_url(
                        resolved_url,
                        max_connections=max_connections,
                        socket_connect_timeout=socket_timeout,
                        socket_timeout=socket_timeout,
                        decode_responses=decode_responses,
                    )
                    cls._pools[key] = pool
        return redis.Redis(connection_pool=pool)

    @classmethod
    def close_all_pools(cls) -> None:
        """Disconnect all managed connection pools (for graceful shutdown or tests)."""
        with cls._lock:
            for pool in cls._pools.values():
                pool.disconnect()
            cls._pools.clear()


def get_redis_client(
    url: str | None = None,
    *,
    decode_responses: bool = True,
    socket_timeout: float = 0.5,
    max_connections: int = 64,
) -> redis.Redis:
    """Convenience wrapper around RedisConnectionProvider.get_redis_client."""
    return RedisConnectionProvider.get_redis_client(
        url,
        decode_responses=decode_responses,
        socket_timeout=socket_timeout,
        max_connections=max_connections,
    )
