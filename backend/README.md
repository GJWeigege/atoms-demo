# Atoms Demo — Python 后端

FastAPI + LangGraph 多智能体流水线后端。浏览器通过 CORS 直连 FastAPI（`NEXT_PUBLIC_BACKEND_URL`），Next.js 服务端组件通过 `BACKEND_URL` 请求。

## 架构

```
Next.js (3000)  ──clientFetch/CORS──►  FastAPI (8000)  ──►  PostgreSQL
                                              │
                                        LangGraph 流水线
                                        LangChain Tools
```

## 环境要求

- Python 3.11+
- PostgreSQL（`backend/.env` 中的 `DATABASE_URL`）
- 可选：`OPENAI_API_KEY` 启用 AI 生成

## 快速启动

```bash
# 1. 启动数据库
pnpm db:up

# 2. 安装 Python 依赖
cd backend
pip install -e .

# 3. 配置环境变量
cp .env.example .env
# 编辑 DATABASE_URL、JWT_SECRET（需与前端 .env 一致）

# 4. 启动后端
python -m uvicorn main:app --reload --port 8000
```

另开终端启动前端：

```bash
pnpm dev
```

或根目录：

```bash
pnpm dev:backend   # 仅 Python
pnpm dev           # 仅 Next.js
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | `postgresql+asyncpg://atoms:atoms@localhost:5432/atoms_demo` |
| `JWT_SECRET` | 与前端 `.env` 中 `JWT_SECRET` 一致 |
| `OPENAI_API_KEY` | 可选，启用 OpenAI 驱动 |
| `OPENAI_MODEL` | 默认 `gpt-4o-mini` |
| `GITHUB_TOKEN` | 可选，全局 GitHub PAT |
| `TEMPLATES_ROOT` | 默认 `../templates` |
| `CORS_ORIGINS` | 逗号分隔的前端 origin，默认 `http://localhost:3000`；生产需设为实际前端域名 |
| `ENV` | `development` 或 `production`（生产启用 `SameSite=None` cookie） |

前端额外变量（根目录 `.env`）：

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_BACKEND_URL` | 浏览器直连后端，默认 `http://localhost:8000` |
| `BACKEND_URL` | Next.js 服务端组件请求后端，默认 `http://localhost:8000` |

## LangGraph 流水线

`agents/graph.py` 将 `resolve_pipeline_steps()` 解析出的步骤编译为线性 `StateGraph`（节点名 `{agentId}__{stepId}`），由 `generation.py` 通过 `graph.astream(stream_mode="updates")` 驱动执行，并在每步完成后持久化 Artifact / 推送 SSE。

核心 23 步顺序（每 Agent 阶段末有 `gate__{agentId}` 决策节点）：

```
mike_plan → emma_requirements → emma_prd → designer_wireframe →
designer_package → bob_architecture → alex_frontend →
alex_backend → alex_assemble
```

可选节点（根据 prompt 关键词）：`iris_research`、`sarah_seo`、`adrian_ads`

## API 端点

- `POST /api/auth/register|login|logout` · `GET /api/auth/me`
- `GET|POST /api/conversations` · `POST .../messages` · `POST .../build`
- `GET|POST /api/projects` · `DELETE /api/projects/{id}`
- `GET /api/projects/{id}/preview` · `POST .../chat` · `POST .../generate/gate` · `POST .../export/github`
- `GET /api/templates` · `PATCH /api/user/settings`
- `GET /api/health` · `GET /api/mcp/tools`

## MCP / RAG

- **MCP**：`mcp_tools/artifact_tools.py` 定义工具规格，`GET /api/mcp/tools` 可查询
- **RAG**：`rag/indexer.py` 关键词搜索 `templates/agents/`；安装 `[rag]` 可选依赖启用 Chroma 向量检索

## 验证

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/templates
```
