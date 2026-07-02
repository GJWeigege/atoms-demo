import json
import re

import httpx

from config import get_settings
from shared_config import (
    get_agent_by_name,
    get_chat_agent,
)


def parse_mention(text: str) -> tuple[str | None, str]:
    match = re.match(r"^@(\w+)\s*", text)
    if not match:
        return None, text.strip()
    agent = get_agent_by_name(match.group(1))
    if not agent:
        return None, text.strip()
    clean = text[len(match.group(0)) :].strip() or text.strip()
    return agent["id"], clean


def suggest_conversation_title(first_message: str) -> str:
    cleaned = re.sub(r"^@\w+\s*", "", first_message).strip()
    if len(cleaned) <= 30:
        return cleaned
    return cleaned[:27] + "..."


def build_prompt_from_conversation(messages: list[dict]) -> str:
    user_messages = [m["content"] for m in messages if m.get("role") == "user"]
    if not user_messages:
        return "构建一个 Web 应用"
    combined = "\n".join(user_messages)
    if len(combined) <= 500:
        return combined
    return f"{user_messages[0]}\n\n补充需求：{user_messages[-1]}"


async def _call_openai_chat(system: str, messages: list[dict]) -> str | None:
    settings = get_settings()
    if not settings.openai_api_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            res = await client.post(
                f"{settings.openai_base_url}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {settings.openai_api_key}",
                },
                json={
                    "model": settings.openai_model,
                    "messages": [{"role": "system", "content": system}, *messages],
                    "temperature": 0.7,
                    "max_tokens": 1500,
                },
            )
            if res.is_success:
                return res.json()["choices"][0]["message"]["content"]
    except httpx.HTTPError:
        pass
    return None


def _mock_response(agent: dict, user_message: str, history: list[dict]) -> str:
    lower = user_message.lower()
    is_first = len([m for m in history if m.get("role") == "user"]) <= 1

    if agent["id"] == "mike":
        if is_first:
            return (
                f"你好！我是 Mike，你的团队负责人。\n\n我理解了你的想法：「{user_message[:80]}」\n\n"
                "建议这样推进：\n1. @Emma 梳理产品需求\n2. @Bob 设计技术架构\n3. @Alex 实现代码\n\n"
                "准备好后点击下方「开始构建」按钮开始生成项目。"
            )
        if any(k in lower for k in ["构建", "开始", "生成"]):
            return "好的，点击下方的「构建」按钮，我会协调团队为你生成完整应用。"
        return "收到。建议你 @Emma 细化产品需求，或 @Bob 讨论技术方案。准备好后点击「构建」即可。"

    if agent["id"] == "emma":
        return f"我是 Emma，产品经理。针对「{user_message[:60]}...」，建议优先实现核心用户路径，MVP 聚焦主流程。"

    if agent["id"] == "bob":
        return "我是 Bob，架构师。推荐 HTML/CSS/JS 单页 + localStorage + Mobile-first 响应式架构。"

    if agent["id"] == "alex":
        return "我是 Alex，工程师。准备好后点击「构建」，我会生成完整代码。"

    return f"我是 {agent['name']}（{agent['roleZh']}）。{agent['descriptionZh']}\n\n请告诉我你需要什么帮助。"


async def generate_agent_chat_response(
    history: list[dict], user_message: str, target_agent_id: str | None
) -> dict:
    agent = get_chat_agent(target_agent_id)

    ai_messages = []
    for m in history[-10:]:
        content = m["content"]
        if m.get("role") == "assistant" and m.get("agentName"):
            content = f"[{m['agentName']}]: {content}"
        ai_messages.append({"role": m["role"], "content": content})
    ai_messages.append({"role": "user", "content": user_message})

    ai_content = await _call_openai_chat(agent["systemPrompt"], ai_messages)
    if ai_content:
        return {
            "content": ai_content,
            "agentId": agent["id"],
            "agentName": agent["name"],
            "mode": "ai",
        }

    return {
        "content": _mock_response(agent, user_message, history),
        "agentId": agent["id"],
        "agentName": agent["name"],
        "mode": "mock",
    }


async def refine_app_with_chat(
    current_app: dict[str, str], refinement_prompt: str
) -> dict:
    system = (
        'You refine web apps. Return JSON: {"html":"...","css":"...","js":"...","response":"message"}. '
        "HTML is inner content only."
    )
    user = (
        f"Current HTML:\n{current_app['html']}\n\nCSS:\n{current_app['css']}\n\n"
        f"JS:\n{current_app['js']}\n\nUser request: {refinement_prompt}"
    )
    result = await _call_openai_chat(system, [{"role": "user", "content": user}])
    if result:
        try:
            match = re.search(r"\{[\s\S]*\}", result)
            if match:
                parsed = json.loads(match.group(0))
                if parsed.get("html"):
                    return {
                        "app": {
                            "html": parsed["html"],
                            "css": parsed.get("css", current_app["css"]),
                            "js": parsed.get("js", current_app["js"]),
                        },
                        "response": parsed.get("response", "App updated."),
                        "mode": "ai",
                    }
        except json.JSONDecodeError:
            pass

    lower = refinement_prompt.lower()
    app = dict(current_app)
    response = "我已记录你的反馈。"

    if "dark" in lower or "深色" in lower:
        app["css"] = app["css"].replace("background: #ffffff", "background: #0f172a;")
        app["css"] += "\nbody { color: #f1f5f9; }"
        response = "已切换为深色主题。"
    elif "light" in lower or "浅色" in lower:
        app["css"] = app["css"].replace("background: #0f172a", "background: #ffffff")
        response = "已切换为浅色主题。"
    elif "blue" in lower or "蓝色" in lower:
        app["css"] = app["css"].replace("#6366f1", "#3b82f6")
        response = "已将主色调更新为蓝色。"
    else:
        app["html"] += f"\n<!-- Refinement: {refinement_prompt[:80]} -->"
        response = f"已应用调整：「{refinement_prompt[:100]}」。"

    return {"app": app, "response": response, "mode": "mock"}
