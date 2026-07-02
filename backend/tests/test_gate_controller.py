"""Tests for stage gate controller."""

import asyncio

from services.gate_controller import GateController


def test_gate_decision_roundtrip():
    async def scenario():
        waiter = asyncio.create_task(GateController.wait_decision("proj-1"))
        await asyncio.sleep(0.01)
        assert GateController.is_waiting("proj-1")
        assert GateController.submit_decision("proj-1", "proceed")
        decision = await waiter
        assert decision == "proceed"
        assert not GateController.is_waiting("proj-1")

    asyncio.run(scenario())
