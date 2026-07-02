import json
from abc import ABC, abstractmethod

import httpx

from agents.definitions import WorkflowStep, get_agent_definition
from agents.template_renderer import render_template
from config import get_settings


class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, step: WorkflowStep, context: dict) -> str:
        ...


class MockProvider(LLMProvider):
    async def generate(self, step: WorkflowStep, context: dict) -> str:
        vars_ = {**context.get("vars", {}), **context.get("artifacts", {})}
        return render_template(step.template, vars_)


class OpenAIProvider(LLMProvider):
    async def generate(self, step: WorkflowStep, context: dict) -> str:
        settings = get_settings()
        if not settings.openai_api_key:
            return await MockProvider().generate(step, context)

        agent_id = context.get("vars", {}).get("agentId", "")
        agent = get_agent_definition(agent_id)
        role_name = agent.name_zh if agent else agent_id
        role_zh = agent.role_zh if agent else ""
        system = (
            f"你是 {role_name}，{role_zh}。当前任务：{step.name_zh}（{step.name}）。"
            "输出格式与模板一致，使用中文。"
        )

        parts = [f"用户需求：\n{context.get('prompt', '')}"]
        for key in step.input_keys:
            val = context.get("artifacts", {}).get(key) or context.get("vars", {}).get(key)
            if val:
                parts.append(f"\n【{key}】\n{val[:3000]}")
        user = "\n".join(parts)

        max_tokens = 4000 if step.output_type == "code" else 2500
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                res = await client.post(
                    f"{settings.openai_base_url}/chat/completions",
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {settings.openai_api_key}",
                    },
                    json={
                        "model": settings.openai_model,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                        "temperature": 0.7,
                        "max_tokens": max_tokens,
                    },
                )
                if res.is_success:
                    data = res.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content")
                    if content:
                        return content
        except httpx.HTTPError:
            pass

        return await MockProvider().generate(step, context)


def get_provider() -> LLMProvider:
    settings = get_settings()
    if settings.openai_api_key:
        return OpenAIProvider()
    return MockProvider()
