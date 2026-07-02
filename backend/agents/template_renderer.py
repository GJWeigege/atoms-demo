import html
import json
import re
from pathlib import Path

from config import get_settings

THEME_OPTIONS = {
    "modern": {"label": "现代", "description": "渐变与圆角，科技感"},
    "minimal": {"label": "极简", "description": "留白、细线、克制配色"},
    "dark": {"label": "深色", "description": "暗色背景与高对比"},
    "playful": {"label": "活泼", "description": "明亮色彩与趣味动效"},
}


def detect_app_type(prompt: str) -> str:
    lower = prompt.lower()
    rules = [
        (["todo", "待办", "task"], "todo"),
        (["landing", "marketing", "落地"], "landing"),
        (["dashboard", "analytics", "面板"], "dashboard"),
        (["calculator", "calc", "计算"], "calculator"),
        (["weather", "天气"], "weather"),
        (["chat", "messaging"], "chat"),
        (["portfolio", "作品集"], "portfolio"),
        (["blog", "日记", "journal"], "blog"),
        (["store", "shop", "电商"], "store"),
        (["inventory", "库存"], "inventory"),
    ]
    for keywords, app_type in rules:
        if any(k in lower for k in keywords):
            return app_type
    return "generic"


def detect_optional_agent_ids(prompt: str) -> list[str]:
    lower = prompt.lower()
    optional: list[str] = []
    if any(k in lower for k in ["调研", "research", "竞品", "market"]):
        optional.append("iris")
    if any(k in lower for k in ["seo", "搜索", "关键词"]):
        optional.append("sarah")
    if any(k in lower for k in ["广告", "ads", "投放", "campaign"]):
        optional.append("adrian")
    return optional


def extract_title(prompt: str) -> str:
    cleaned = prompt.strip()
    if len(cleaned) <= 48:
        return cleaned
    return cleaned[:45] + "..."


def escape_html(text: str) -> str:
    return html.escape(text)


def _inject_theme(css: str, theme_vars: str) -> str:
    if not theme_vars.strip():
        return css
    return f"{theme_vars}\n{css}"


def get_app_type_template(
    app_type: str, title: str, safe_prompt: str, theme_vars: str = ""
) -> dict[str, str]:
    templates: dict[str, dict[str, str]] = {
        "todo": {
            "html": f"""<div class="app">
  <header><h1>{title}</h1><p class="subtitle">Built by Atoms Demo agents</p></header>
  <div class="input-row">
    <input id="todoInput" type="text" placeholder="Add a new task..." />
    <button id="addBtn">Add</button>
  </div>
  <ul id="todoList"></ul>
  <div class="stats"><span id="count">0 tasks</span></div>
</div>""",
            "css": _inject_theme(
                """* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: var(--bg, #0f172a); color: var(--text, #f1f5f9); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; }
.app { background: var(--card, #1e293b); border-radius: 16px; padding: 2rem; width: 100%; max-width: 480px; box-shadow: 0 25px 50px rgba(0,0,0,0.4); }
header h1 { font-size: 1.5rem; margin-bottom: 0.25rem; color: var(--text, #f1f5f9); }
.subtitle { color: var(--muted, #94a3b8); font-size: 0.875rem; margin-bottom: 1.5rem; }
.input-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
input { flex: 1; padding: 0.75rem 1rem; border: 1px solid var(--border, #334155); border-radius: 8px; background: var(--bg, #0f172a); color: var(--text, #f1f5f9); }
button { padding: 0.75rem 1.25rem; background: var(--primary, #6366f1); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
ul { list-style: none; }
li { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-bottom: 1px solid var(--border, #334155); }
.stats { margin-top: 1rem; color: var(--muted, #64748b); font-size: 0.875rem; }""",
                theme_vars,
            ),
            "js": """const input = document.getElementById('todoInput');
const list = document.getElementById('todoList');
const count = document.getElementById('count');
const addBtn = document.getElementById('addBtn');
let todos = JSON.parse(localStorage.getItem('todos') || '[]');
function render() {
  list.innerHTML = todos.map((t, i) => `<li><input type="checkbox" onchange="toggle(${i})" /><span>${t.text}</span></li>`).join('');
  count.textContent = todos.length + ' tasks';
  localStorage.setItem('todos', JSON.stringify(todos));
}
window.toggle = (i) => { todos[i].done = !todos[i].done; render(); };
addBtn.onclick = () => { const text = input.value.trim(); if (!text) return; todos.push({ text, done: false }); input.value = ''; render(); };
render();""",
        },
        "landing": {
            "html": f"""<nav><div class="logo">✦ {title}</div><button class="cta-sm">Get Started</button></nav>
<section class="hero"><h1>Transform your ideas into reality</h1><p>{safe_prompt[:120]}</p><button class="cta">Start Free Trial</button></section>
<section class="features"><div class="feature"><h3>⚡ Fast</h3><p>Launch in minutes</p></div><div class="feature"><h3>🎯 Smart</h3><p>AI-powered</p></div><div class="feature"><h3>🔒 Secure</h3><p>Enterprise-grade</p></div></section>
<footer>© 2026 {title}. Built with Atoms Demo.</footer>""",
            "css": _inject_theme(
                """* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; color: var(--text, #1e293b); background: var(--bg, #ffffff); }
nav { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 2rem; border-bottom: 1px solid var(--border, #e2e8f0); }
.logo { font-weight: 700; font-size: 1.25rem; color: var(--primary, #6366f1); }
.hero { text-align: center; padding: 5rem 2rem; background: var(--hero-bg, linear-gradient(135deg, #eef2ff, #faf5ff)); }
.cta { padding: 1rem 2rem; background: var(--primary, #6366f1); color: white; border: none; border-radius: 12px; cursor: pointer; }
.features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; padding: 4rem 2rem; max-width: 960px; margin: 0 auto; }""",
                theme_vars,
            ),
            "js": "document.querySelectorAll('button').forEach(btn => { btn.onclick = () => alert('Welcome!'); });",
        },
        "generic": {
            "html": f"""<div class="container"><header><h1>{title}</h1></header><main><p class="desc">{safe_prompt[:200]}</p><div class="card"><h2>Welcome</h2><p>Generated by Atoms Demo multi-agent team.</p><button id="actionBtn">Get Started</button></div></main></div>""",
            "css": _inject_theme(
                """* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; }
.container { background: white; border-radius: 20px; padding: 2.5rem; max-width: 520px; width: 100%; }
button { padding: 0.875rem 1.5rem; background: var(--primary, #6366f1); color: white; border: none; border-radius: 10px; cursor: pointer; }""",
                theme_vars,
            ),
            "js": "document.getElementById('actionBtn').onclick = () => alert('App generated by Atoms Demo!');",
        },
    }
    return templates.get(app_type, templates["generic"])


def load_theme_vars(theme_id: str) -> str:
    path = get_settings().templates_path / "themes" / theme_id / "tokens.css"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


def build_template_context(
    prompt: str, theme: str, artifacts: dict[str, str]
) -> dict[str, str]:
    app_type = detect_app_type(prompt)
    title = extract_title(prompt)
    theme_meta = THEME_OPTIONS.get(theme, {"label": theme, "description": ""})
    theme_vars = load_theme_vars(theme)
    app_template = get_app_type_template(app_type, title, escape_html(prompt), theme_vars)
    ctx = {
        "prompt": prompt,
        "title": title,
        "appType": app_type,
        "theme": theme,
        "themeLabel": theme_meta["label"],
        "themeDescription": theme_meta["description"],
        "themeVars": theme_vars,
        "appHtml": app_template["html"],
        "appCss": app_template["css"],
        "appJs": app_template["js"],
        **artifacts,
    }
    return ctx


def render_template(template_path: str, context: dict[str, str]) -> str:
    templates_root = get_settings().templates_path.resolve()
    full_path = (templates_root / template_path).resolve()
    if not full_path.is_relative_to(templates_root):
        return f"# 模板路径非法\n\n路径: {template_path}"
    if not full_path.exists():
        return f"# 模板缺失\n\n路径: {template_path}"

    content = full_path.read_text(encoding="utf-8")
    content = re.sub(
        r"\{\{(\w+)\}\}",
        lambda m: context.get(m.group(1), ""),
        content,
    )
    content = re.sub(
        r"\{\{#if (\w+)\}\}([\s\S]*?)\{\{/if\}\}",
        lambda m: m.group(2) if context.get(m.group(1)) else "",
        content,
    )
    return content.strip()


def _preview_parent_origin() -> str:
    origins = get_settings().cors_origin_list
    return origins[0] if origins else "http://localhost:3000"


def build_preview_document(app: dict[str, str], *, enable_selection: bool = True) -> str:
    parent_origin = json.dumps(_preview_parent_origin())
    selection_script = ""
    if enable_selection:
        selection_script = f"""
<script>
(function() {{
  var PARENT_ORIGIN = {parent_origin};
  let selected = null;
  function cssPath(el) {{
    if (!el || el === document.body) return 'body';
    if (el.id) return '#' + CSS.escape(el.id);
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {{
      var sel = el.tagName.toLowerCase();
      if (el.className && typeof el.className === 'string') {{
        var cls = el.className.trim().split(/\\s+/).filter(Boolean)[0];
        if (cls) sel += '.' + CSS.escape(cls);
      }}
      parts.unshift(sel);
      el = el.parentElement;
    }}
    return parts.join(' > ') || 'body';
  }}
  function stylesOf(el) {{
    var cs = window.getComputedStyle(el);
    return {{
      margin: cs.margin, padding: cs.padding, width: cs.width, height: cs.height,
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color,
      backgroundColor: cs.backgroundColor
    }};
  }}
  document.addEventListener('click', function(e) {{
    if (!window.__ATOMS_DESIGN_MODE__) return;
    e.preventDefault();
    e.stopPropagation();
    if (selected) selected.removeAttribute('data-atoms-selected');
    selected = e.target;
    selected.setAttribute('data-atoms-selected', 'true');
    window.parent.postMessage({{
      type: 'atoms-select',
      selector: cssPath(selected),
      tagName: selected.tagName,
      textContent: (selected.textContent || '').slice(0, 200),
      styles: stylesOf(selected)
    }}, PARENT_ORIGIN);
  }}, true);
  window.addEventListener('message', function(e) {{
    if (e.origin !== PARENT_ORIGIN) return;
    if (e.data && e.data.type === 'atoms-design-mode') {{
      window.__ATOMS_DESIGN_MODE__ = !!e.data.enabled;
      document.body.style.cursor = e.data.enabled ? 'crosshair' : '';
    }}
    if (e.data && e.data.type === 'atoms-apply-styles' && e.data.selector) {{
      try {{
        var el = document.querySelector(e.data.selector);
        if (el && e.data.styles) {{
          Object.keys(e.data.styles).forEach(function(k) {{
            el.style[k] = e.data.styles[k];
          }});
        }}
      }} catch (err) {{}}
    }}
  }});
}})();
</script>"""
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
[data-atoms-selected] {{ outline: 2px solid #6366f1 !important; outline-offset: 2px; }}
{app["css"]}
</style>
</head>
<body>
{app["html"]}
<script>{app["js"]}</script>
{selection_script}
</body>
</html>"""


def parse_code_output(content: str) -> dict[str, str] | None:
    try:
        match = re.search(r"\{[\s\S]*\}", content)
        if not match:
            return None
        parsed = json.loads(match.group(0))
        if parsed.get("html"):
            return {
                "html": parsed["html"],
                "css": parsed.get("css", ""),
                "js": parsed.get("js", ""),
            }
    except (json.JSONDecodeError, TypeError):
        pass
    return None
