"""In-memory SSE event bus for project streaming (dev/demo)."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any


class ProjectEventBus:
    _buffers: dict[str, list[tuple[str, dict[str, Any]]]] = defaultdict(list)
    _queues: dict[str, list[asyncio.Queue[tuple[str, dict[str, Any]] | None]]] = defaultdict(list)
    _done: set[str] = set()

    @classmethod
    def emit(cls, project_id: str, event_type: str, data: dict[str, Any]) -> None:
        event = (event_type, data)
        cls._buffers[project_id].append(event)
        for queue in cls._queues.get(project_id, []):
            queue.put_nowait(event)

    @classmethod
    def mark_done(cls, project_id: str) -> None:
        cls._done.add(project_id)
        cls.emit(project_id, "done", {})
        for queue in cls._queues.get(project_id, []):
            queue.put_nowait(None)

    @classmethod
    def is_done(cls, project_id: str) -> bool:
        return project_id in cls._done

    @classmethod
    def buffer_size(cls, project_id: str) -> int:
        return len(cls._buffers.get(project_id, []))

    @classmethod
    def trim_buffer(cls, project_id: str) -> None:
        """Drop replay buffer after a subscriber finishes (demo memory hygiene)."""
        cls._buffers.pop(project_id, None)

    @classmethod
    def clear(cls, project_id: str) -> None:
        cls._buffers.pop(project_id, None)
        cls._done.discard(project_id)

    @classmethod
    async def subscribe(cls, project_id: str):
        queue: asyncio.Queue[tuple[str, dict[str, Any]] | None] = asyncio.Queue()
        cls._queues[project_id].append(queue)
        for event in cls._buffers.get(project_id, []):
            await queue.put(event)
        if cls.is_done(project_id):
            await queue.put(None)
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield item
        finally:
            cls._queues[project_id].remove(queue)
