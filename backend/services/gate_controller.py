"""Per-project gate decisions — blocks pipeline until user chooses proceed/rollback."""

from __future__ import annotations

import asyncio
from typing import Literal

GateDecision = Literal["proceed", "rollback"]


class GateController:
    _waiters: dict[str, asyncio.Future[GateDecision]] = {}

    @classmethod
    async def wait_decision(cls, project_id: str) -> GateDecision:
        loop = asyncio.get_running_loop()
        fut: asyncio.Future[GateDecision] = loop.create_future()
        cls._waiters[project_id] = fut
        try:
            return await fut
        finally:
            cls._waiters.pop(project_id, None)

    @classmethod
    def submit_decision(cls, project_id: str, decision: GateDecision) -> bool:
        fut = cls._waiters.get(project_id)
        if fut is None or fut.done():
            return False
        fut.set_result(decision)
        return True

    @classmethod
    def is_waiting(cls, project_id: str) -> bool:
        fut = cls._waiters.get(project_id)
        return fut is not None and not fut.done()

    @classmethod
    def cancel(cls, project_id: str) -> None:
        fut = cls._waiters.pop(project_id, None)
        if fut and not fut.done():
            fut.cancel()
