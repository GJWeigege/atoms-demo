# Atoms Demo

受 [Atoms](https://atoms.dev/) 启发的交互式 Web 应用——通过**真实多智能体编排流水线**驱动应用生成，并以沙箱 iframe 实时预览展示结果。

## 架构（双服务）

```
┌─────────────────┐   clientFetch (CORS)   ┌──────────────────────────┐
│  Next.js :3000  │ ◄────────────────────► │  Python FastAPI :8000    │
│  React 前端 UI  │   NEXT_PUBLIC_BACKEND  │  LangGraph + LangChain   │
│  RSC backendFetch│  (Cookie 镜像)        │  SQLAlchemy + PostgreSQL │
└─────────────────┘                        └──────────────────────────┘
         │                                           │
         │  /api/auth/session（JWT 镜像）             │  config/ + templates/
         └───────────────────────────────────────────┘
```

- **前端**：Next.js 16 App Router（`src/`）— UI；浏览器通过 `clientFetch` 直连 Python API（SSE 不经 Next 代理）
- **后端**：`backend/` — FastAPI + LangGraph 流水线，详见 [backend/README.md](./backend/README.md)
- **共享配置**：根目录 `config/`（Agent、模板、Discover 示例）与 `templates/`（步骤模板、主题 CSS）由后端读取，经 `GET /api/config` 下发给前端

## 快速开始

### 前置条件

- Node.js 20+
- Python 3.11+
- PostgreSQL 16+（推荐使用 Docker Compose 本地启动）

### 本地开发

```bash
# 安装前端依赖
pnpm install

# 复制环境变量（JWT_SECRET 前后端需一致 — 根目录 .env 会被 backend 自动读取）
cp .env.example .env

# 启动 PostgreSQL（Docker）
pnpm db:up

# 终端 1 — Python 后端（启动时自动 create_all 建表）
cd backend
pip install -e .    # 或 pip install -r requirements.txt
cp .env.example .env   # 配置 DATABASE_URL、JWT_SECRET
python -m uvicorn main:app --reload --port 8000

# 终端 2 — Next.js 前端
pnpm dev
```

或使用根目录脚本：

```bash
pnpm dev:all        # 同时启动 Python :8000 + Next.js :3000
pnpm dev:backend    # 仅 Python :8000
pnpm dev            # 仅 Next.js :3000
```

打开 [http://localhost:3000](http://localhost:3000)。已登录用户访问 `/` 会自动跳转到 `/dashboard` 首页对话工作区。

### Docker Compose（可选）

```bash
pnpm db:up                              # 仅 PostgreSQL（默认）
docker compose --profile full up -d     # PostgreSQL + 后端容器
```

## 路由与页面

| 路径 | 说明 |
|------|------|
| `/` | 营销落地页（未登录）；已登录重定向 `/dashboard` |
| `/login` · `/register` | 认证表单 |
| `/dashboard` | 首页工作区：对话、发现、我的项目、模板 |
| `/project/[id]` | 独立项目页（模板克隆等场景）；布局与 Dashboard 构建后一致 |

Dashboard 支持 URL 参数：`?conversation=`、`?project=`、`?tab=discover|projects|templates`。

## 环境变量

### 前端（根目录 `.env`）

| 变量 | 必填 | 说明 |
|------|------|------|
| `JWT_SECRET` | 是 | 会话 JWT 签名密钥（与后端必须相同） |
| `NEXT_PUBLIC_BACKEND_URL` | 否 | 浏览器直连后端地址，默认 `http://localhost:8000` |
| `BACKEND_URL` | 否 | Next.js 服务端组件请求后端，默认 `http://localhost:8000` |
| `OPENAI_API_KEY` | 否 | 启用真实 AI 生成；未设置时使用结构化模板生成 |
| `OPENAI_BASE_URL` | 否 | OpenAI 兼容 API 地址 |
| `OPENAI_MODEL` | 否 | 模型名称（默认 `gpt-4o-mini`） |
| `GITHUB_TOKEN` | 否 | GitHub Personal Access Token（全局 fallback） |
| `GITHUB_API_URL` | 否 | GitHub API 地址（默认 `https://api.github.com`） |

### 后端（`backend/.env`）

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | `postgresql+asyncpg://atoms:atoms@localhost:5432/atoms_demo` |
| `JWT_SECRET` | 与根目录 `.env` 一致 |
| `TEMPLATES_ROOT` | 模板目录，默认 `../templates` |
| `CONFIG_ROOT` | 配置目录，默认 `../config` |
| `CORS_ORIGINS` | 逗号分隔的前端 origin，默认 `http://localhost:3000` |
| `ENV` | `development` 或 `production`（生产启用 `SameSite=None` cookie） |

其余 OpenAI / GitHub 变量与根目录 `.env.example` 相同。

### 会话 Cookie（双域）

1. 登录/注册时，浏览器向 Python API（`:8000`）发起请求，后端 `Set-Cookie` 写入 `atoms_session`
2. 前端 `AuthForm` 收到响应中的 `token` 后，调用 Next.js `POST /api/auth/session` 将 JWT **镜像**到 `:3000` 域，供 RSC 通过 `backendFetch` 预取数据
3. 退出登录时同时调用后端 `POST /api/auth/logout` 与 `DELETE /api/auth/session`，清除两侧 cookie

### GitHub 配置

1. 在 GitHub → Settings → Developer settings → Personal access tokens 创建 Token
2. 勾选 `repo` 权限（创建/推送仓库）
3. 方式一：在 `.env` 中设置 `GITHUB_TOKEN=ghp_...`
4. 方式二：调用 `POST /api/projects/{id}/export/github` 时在请求体传入 `githubToken`（会保存到用户账户）

## 智能体团队

`config/agents.json` 定义 **9 位智能体**。其中 **5 位**参与默认流水线（`inPipeline: true`），其余用于首页 @ 提及对话或可选流水线阶段。

| Agent | ID | 角色 | 流水线 |
|-------|-----|------|--------|
| Mike | `mike` | 团队负责人 | 核心（4 步） |
| Emma | `emma` | 产品经理 | 核心（5 步） |
| Luna | `designer` | 设计师 | 核心（4 步） |
| Bob | `bob` | 架构师 | 核心（4 步） |
| Alex | `alex` | 工程师 | 核心（6 步） |
| David | `david` | 数据分析师 | 仅对话 |
| Iris | `iris` | 深度研究员 | 可选（关键词触发） |
| Sarah | `sarah` | SEO 专家 | 可选（关键词触发） |
| Adrian | `adrian` | 广告专家 | 可选（关键词触发） |

首页通过 `AgentAvatarRow` 展示全员；`ChatInput` 支持 `@Agent名` 将消息路由到对应 `systemPrompt`。

## 智能体编排架构

采用**声明式 Agent Schema（`config/agents.json`）+ 模板驱动 + 可插拔 LLM Provider** 的分层架构：

```
用户 Prompt + Theme（Conversation）
        │
        ▼
POST /api/conversations/{id}/build  →  创建 Project + AgentRun 记录
        │
        ▼
run_project_generation（后台任务）
        │
        ▼
┌───────────────────┐
│  pipeline_config  │  config/agents.json（核心阶段）+ default-pipeline.json（可选阶段）
└─────────┬─────────┘
          │ compile_pipeline_graph → LangGraph StateGraph（23 步线性图）
          ▼
┌───────────────────┐
│  execute_pipeline │  单步 ReAct + 模板/LLM → 写入 Artifact
│  _step (node)     │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
MockProvider  OpenAIProvider   ← getProvider() 按 OPENAI_API_KEY 切换
    │           │
    └─────┬─────┘
          ▼
┌───────────────────┐
│ template-renderer │  templates/agents/{agent}/{step}.md（assemble 为 .json.hbs）
└─────────┬─────────┘
          ▼
Artifact → GeneratedApp / ProjectFile → iframe 预览
```

### 默认流水线（23 步）

```
Mike (4步)
  intake-analysis → task-decomposition → risk-assessment → plan
Emma (5步)
  stakeholder-analysis → requirements-analysis → user-journey
  → feature-prioritization → prd-writing
Luna / designer (4步)
  design-research → wireframe → visual-system → design-package
Bob (4步)
  requirements-review → system-design → data-model → architecture
Alex (6步)
  tech-stack-selection → frontend → backend-schema
  → api-implementation → integration → assemble
→ iframe 沙箱预览
```

智能体交接（SSE `handoff` 事件）：Mike → Emma → Luna → Bob → Alex。

**可选智能体**（Prompt 含关键词时，在 Emma 之后插入，配置见 `templates/orchestration/default-pipeline.json`）：

| Agent | 触发词 | 步骤 (4步) |
|-------|--------|------------|
| **Iris** | 调研、竞品、research、market | research-scope → source-collection → analysis → research-report |
| **Sarah** | SEO、搜索、关键词 | keyword-research → content-strategy → seo-audit → seo-plan |
| **Adrian** | 广告、投放、campaign、ads | audience-analysis → campaign-strategy → ad-creatives → ads-plan |

### 各 Agent 步骤一览

| Agent | 步骤 ID | 中文名 | 产物类型 |
|-------|---------|--------|----------|
| Mike | intake-analysis | 需求 intake 分析 | intake |
| Mike | task-decomposition | 任务拆解与分配 | task_decomposition |
| Mike | risk-assessment | 风险评估与优先级 | risk_assessment |
| Mike | plan | 项目计划 | plan |
| Emma | stakeholder-analysis | 利益相关者分析 | stakeholders |
| Emma | requirements-analysis | 需求分析 | requirements |
| Emma | user-journey | 用户旅程地图 | user_journey |
| Emma | feature-prioritization | 功能优先级 (MoSCoW) | feature_priority |
| Emma | prd-writing | PRD 编写 | prd |
| Luna | design-research | 设计调研与参考 | design_research |
| Luna | wireframe | 线框设计 | wireframe |
| Luna | visual-system | 视觉系统 | visual_system |
| Luna | design-package | 设计交付包 | design |
| Bob | requirements-review | PRD/设计审阅 | requirements_review |
| Bob | system-design | 系统架构设计 | system_design |
| Bob | data-model | 数据模型设计 | data_model |
| Bob | architecture | 完整架构文档 | architecture |
| Alex | tech-stack-selection | 技术栈选型 | tech_stack |
| Alex | frontend | 前端实现 | frontend |
| Alex | backend-schema | 后端 Schema | backend |
| Alex | api-implementation | API 接口实现 | api |
| Alex | integration | 前后端集成 | integration |
| Alex | assemble | 代码组装 | code |

### Agent Schema（`config/agents.json`）

每个 Agent 声明：

- `workflow[]` — 有序步骤（id、template、inputKeys、outputType、dependsOn）
- `inputs[]` / `outputs[]` — 上下游产物类型
- `inPipeline` + `pipelineOrder` — 是否进入核心流水线及顺序
- `systemPrompt` — 首页对话用的角色提示词

`backend/agents/definitions.py` 从该 JSON 解析为运行时 `AgentDefinition`；`backend/agents/pipeline_config.py` 根据 `inPipeline` 自动生成核心 `stages`。`templates/orchestration/default-pipeline.json` 仅保留可选阶段（`optionalStages`）配置。

### 模板目录（`templates/`）

```
templates/
├── agents/
│   ├── mike/          # intake, task-decomposition, risk-assessment, plan
│   ├── emma/          # stakeholder, requirements, user-journey, prioritization, prd
│   ├── designer/      # design-research, wireframe, visual-system, design-package
│   ├── bob/           # requirements-review, system-design, data-model, architecture
│   ├── alex/          # tech-stack, frontend, backend, api, integration, assemble.json.hbs
│   ├── iris/          # research-scope → research-report (optional)
│   ├── sarah/         # keyword-research → seo-plan (optional)
│   └── adrian/        # audience-analysis → ads-plan (optional)
├── themes/
│   ├── modern|minimal|dark|playful/tokens.css
└── orchestration/
    └── default-pipeline.json
```

模板使用 `{{variable}}` 占位符，上下文来自上游 Artifact + 用户 Prompt + Theme。

### 执行引擎（`backend/agents/`）

| 模块 | 职责 |
|------|------|
| `graph.py` | LangGraph `StateGraph` 编译 23 步流水线、`execute_pipeline_step` 单步节点 |
| `pipeline_config.py` | 从 `agents.json` 构建核心 stages，校验可选阶段 |
| `definitions.py` | 解析 `agents.json` 为 Agent / WorkflowStep schema |
| `react_runner.py` | 将单步包装为 ReAct thought/action/observation |
| `providers.py` | Mock / OpenAI LLM Provider |
| `template_renderer.py` | 模板渲染与代码解析 |

### Mock → LLM 切换

```python
# backend/agents/providers.py
def get_provider() -> LLMProvider:
    if get_settings().openai_api_key:
        return OpenAIProvider()
    return MockProvider()
```

无需改业务代码：配置 `OPENAI_API_KEY` 后自动使用 OpenAI；未配置时使用模板 Mock。

### 主题系统

- 对话创建/构建时选择主题（`modern` / `minimal` / `dark` / `playful`），持久化在 `Conversation.theme`
- `templates/themes/{theme}/tokens.css` 注入 CSS 变量
- Alex `assemble` 步骤将 `themeVars` 合并进最终 CSS

### 如何添加新 Agent / 步骤

1. 在 `config/agents.json` 添加 Agent 定义（含 `workflow[]`、`inPipeline`、`pipelineOrder`）
2. 在 `templates/agents/{id}/` 创建对应模板文件
3. 可选 Agent：在 `templates/orchestration/default-pipeline.json` 的 `optionalStages` 注册触发关键词
4. 运行 `pnpm validate:config && pnpm typecheck && pnpm test:backend`

### 数据模型（`backend/db/models.py`）

| 模型 | 说明 |
|------|------|
| `User` | 用户账户；`githubToken` 可选保存 PAT |
| `Conversation` | 首页对话线程；关联 `projectId`、`theme` |
| `ConversationMessage` | 对话消息；含 `agentId`、`reactSteps`、`messageType`、`status` |
| `Project` | 构建项目；`status`: `draft` / `generating` / `ready` / `failed` |
| `AgentRun` | 每**步骤**一条记录（含 `stepId`、`stepNameZh`），状态 `pending` → `running` → `completed` / `failed` |
| `Artifact` | 产物（plan / prd / wireframe / design / architecture / code / …） |
| `Message` | 项目级消息（构建 prompt、迭代优化回复）；与 `ConversationMessage` 并存，前端会合并展示 |
| `GeneratedApp` | 最终 HTML/CSS/JS，供预览与导出 |
| `ProjectFile` | 多文件项目树（path / content / size），供编辑器与文件面板 |

### AI vs 模板模式

- **有 `OPENAI_API_KEY`**：每步调用 LLM，以上游产物为上下文
- **无 API Key**：MockProvider 渲染 `templates/` 模板，仍产出各步骤独立产物

## 功能说明

### 已实现（真实功能）

- **认证** — 注册/登录/登出，JWT Cookie 会话 + Next.js 域镜像
- **首页对话** — 9 人智能体 @ 提及路由；`Conversation` / `ConversationMessage` 持久化
- **Dashboard 工作区** — 左侧栏：首页 / 资源 / 我的项目 + 对话列表；底部面板：发现 / 我的项目 / 模板
- **发现（Discover）** — `config/discover-projects.json` 示例卡片，一键填入 remix Prompt
- **构建** — 点击「构建」→ `POST /api/conversations/{id}/build` → 同页展开 `UnifiedWorkspace`（左对话 + 右应用查看器），不跳转
- **模板克隆** — `POST /api/projects/clone-template` → 跳转 `/project/{id}`，预置 `GeneratedApp` 即时预览
- **统一工作区** — `UnifiedWorkspace`：构建前仅左侧 `ChatMessageList`；关联项目后左侧 `StreamingChatPanel` + 右侧 `ProjectWorkspace`
- **ReAct + SSE 流式** — 流水线与项目内对话均通过 SSE 推送；消息气泡可展开 ReAct 步骤，智能体交接显示 `HandoffBadge`
- **应用查看器** — 预览 / 设计 / 编辑器 / 文件；设备切换、刷新、新标签、控制台（演示）
- **视觉设计模式** — 预览中点击选择元素，`POST /api/projects/{id}/design/styles` 持久化 CSS
- **文件目录 + 代码编辑器** — `ProjectFile` 多文件结构；`GET/PUT /api/projects/{id}/files/{path}`
- **iframe 预览** — `GET /api/projects/{id}/preview` 由后端组装完整 HTML 文档（含设计模式脚本）
- **对话迭代** — 项目内 `POST /api/projects/{id}/chat/stream` 流式优化代码，刷新预览并递增 `GeneratedApp.version`
- **产物 API** — `GET /api/projects/{id}/artifacts` 及按类型查询
- **应用配置 API** — `GET /api/config` 聚合 agents、templates、categories、discoverProjects
- **HTML / GitHub 导出（API）** — `POST /api/projects/{id}/preview` 返回打包 HTML；`POST .../export/github` 创建仓库并推送文件（组件 `PreviewPanel` / `GitHubExportModal` 已实现，主工作区工具栏暂未挂载入口）

### 仍为简化 / 演示

- Figma / Notion / Slack 等集成栏（`IntegrationBar` 仅 UI 展示）
- 语音输入、Stripe 支付
- Atoms Cloud 等价部署/托管
- 分享 / 发布按钮（UI 已展示，功能为演示占位）
- 预览控制台日志
- 可选智能体的 LLM 调用质量取决于 Prompt 复杂度

## API 参考

所有业务 API 由 **Python 后端**（`:8000`）提供。Next.js 仅提供 `POST/DELETE /api/auth/session` 用于 JWT 镜像。

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册（返回 `token`） |
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 当前用户 |

### 对话

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/conversations` | 对话列表 |
| POST | `/api/conversations` | 创建对话（可选 `theme`） |
| GET | `/api/conversations/{id}` | 对话详情（含消息） |
| PATCH | `/api/conversations/{id}` | 更新标题 / 主题 |
| DELETE | `/api/conversations/{id}` | 删除对话 |
| POST | `/api/conversations/{id}/messages` | 发送消息（`agentId` 可选，@ 提及路由） |
| POST | `/api/conversations/{id}/build` | 从对话创建项目并启动流水线 |

### 项目

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 项目列表 |
| POST | `/api/projects` | 直接创建项目 |
| POST | `/api/projects/clone-template` | 克隆模板（`templateId`） |
| GET | `/api/projects/{id}` | 项目详情（含 agentRuns、messages） |
| DELETE | `/api/projects/{id}` | 删除项目 |
| GET | `/api/projects/{id}/artifacts` | 产物列表 |
| GET | `/api/projects/{id}/artifacts/{type}` | 按类型取产物 |
| GET | `/api/projects/{id}/preview` | iframe 预览 HTML |
| POST | `/api/projects/{id}/preview` | 返回打包 HTML/CSS/JS（HTML 导出） |
| POST | `/api/projects/{id}/chat` | 非流式对话优化 |
| POST | `/api/projects/{id}/export/github` | GitHub 导出 |

### SSE 流式

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/projects/{id}/generate/stream` | 订阅流水线事件（回放缓冲 + 实时） |
| POST | `/api/projects/{id}/chat/stream` | 项目内对话流式（ReAct + message 分块） |
| POST | `/api/projects/{id}/design/styles` | 视觉编辑器应用 CSS |

**流水线 SSE 事件类型**：`agent_start`、`thought`、`action`、`observation`、`react_step`、`run_status`、`step_complete`、`handoff`、`gate_prompt`、`gate_rollback`、`message_delta`、`agent_complete`、`done`、`error`

每个 Agent 阶段结束后触发 `gate_prompt`，用户通过 `POST /api/projects/{id}/generate/gate` 提交 `proceed`（继续下一阶段）或 `rollback`（回退并重新执行当前阶段）。

### 文件与其它

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/{id}/files` | 文件列表 |
| GET/PUT | `/api/projects/{id}/files/{path}` | 读取/保存单文件 |
| GET | `/api/config` | 前端应用配置 |
| GET/PATCH | `/api/user/settings` | 用户设置（含 GitHub Token 状态） |
| GET | `/api/health` | 健康检查 |
| GET | `/api/mcp/tools` | MCP 工具规格列表 |

## 测试指南

### 1. 首页构建 + iframe 预览

1. 登录后在 Dashboard 输入「构建一个待办清单应用」
2. 点击「构建」→ 页面展开左右分栏，右侧出现应用查看器
3. 左侧对话流中 Mike → Emma → Luna → Bob → Alex 消息逐条出现
4. 流水线完成后预览 iframe 渲染应用
5. 验证 `GET http://localhost:8000/api/projects/{id}/preview`（需 Cookie）

### 2. 模板克隆

1. 进入 Dashboard 底部「模板」标签（或侧栏「资源」）
2. 点击任意模板卡片的「克隆模板」
3. 应跳转到 `/project/{id}` 且状态为「已完成」，预览立即可见

### 3. 多智能体流水线（含主题）

1. 构建前在输入区选择主题（如「深色」）后点击「构建」
2. 观察左侧智能体消息与 ReAct 步骤、移交徽章
3. 预览页验证深色主题 CSS 变量已注入

### 4. 项目内对话迭代

1. 构建完成后，在左侧 `StreamingChatPanel` 发送「改成深色主题」
2. 预览应刷新，`GeneratedApp.version` 递增

### 5. 视觉设计模式

1. 右侧切换到「设计」模式，在预览中点击元素
2. 修改 CSS 属性并应用 → 刷新预览验证持久化

### 6. ReAct + SSE 流式（curl）

```bash
curl -N -b "atoms_session=YOUR_JWT_COOKIE" \
  -X POST http://localhost:8000/api/projects/PROJECT_ID/generate/stream
```

### 7. 配置校验

```bash
pnpm validate:config   # 校验 agents.json 与 pipeline 引用
pnpm test:backend      # Python pytest
pnpm test              # 前端 vitest
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动 Next.js 开发服务器 |
| `pnpm dev:backend` | 启动 Python 后端 |
| `pnpm dev:all` | 同时启动前后端 |
| `pnpm build` | 构建生产版本 |
| `pnpm start` | 启动生产 Next.js |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | 前端单元测试（Vitest） |
| `pnpm test:watch` | Vitest 监听模式 |
| `pnpm test:backend` | 后端 pytest |
| `pnpm validate:config` | 校验 `config/agents.json` 与流水线配置 |
| `pnpm db:up` | Docker 启动 PostgreSQL |
| `pnpm db:down` | 停止 PostgreSQL 容器 |
| `pnpm db:reset` | 清空数据库卷并重新启动 PostgreSQL（开发用） |

## 项目结构

仓库分为三个区域：

| 区域 | 路径 | 职责 |
|------|------|------|
| **前端 UI** | `src/` | Next.js 16 App Router、React 组件、客户端/服务端 API 封装 |
| **后端 API** | `backend/` | FastAPI、LangGraph 流水线、SQLAlchemy、鉴权 |
| **共享资产** | `config/` + `templates/` | Agent 配置、项目模板、Discover 示例、步骤模板、主题 |

```
config/
├── agents.json                 # Agent 定义（单一 schema 源）
├── project-templates.json      # 可克隆模板
├── template-categories.json    # 模板分类
└── discover-projects.json      # 发现页示例

src/
├── app/
│   ├── page.tsx                # 营销落地页
│   ├── login/ · register/
│   ├── dashboard/page.tsx      # 首页对话工作区（RSC 预取）
│   ├── project/[id]/           # 项目页（RSC + ProjectPageClient）
│   └── api/auth/session/       # JWT 镜像到 Next.js 域
├── components/
│   ├── HomepageChat.tsx        # Dashboard 主逻辑：对话、构建、模板
│   ├── DashboardLayout.tsx     # 侧栏 + 底部分栏布局
│   ├── HomeSidebar.tsx         # 导航与对话/项目列表
│   ├── UnifiedWorkspace.tsx    # 左对话 + 右应用查看器
│   ├── StreamingChatPanel.tsx  # 项目 SSE 对话（构建后）
│   ├── ChatMessageList.tsx     # 统一消息列表（用户 + 智能体 + 移交）
│   ├── AgentMessageBubble.tsx  # 智能体消息（可折叠 ReAct 步骤）
│   ├── HandoffBadge.tsx        # 智能体移交徽章
│   ├── ProjectWorkspace.tsx    # 应用查看器（预览/设计/编辑器/文件）
│   ├── PreviewFrame.tsx        # iframe 预览
│   ├── DiscoverPanel.tsx       # 发现页
│   ├── TemplatesPanel.tsx      # 模板克隆
│   └── AppConfigProvider.tsx   # GET /api/config 上下文
├── hooks/
│   └── useProjectStream.ts     # SSE 消费（generate + chat stream）
└── lib/
    ├── client-api.ts           # 浏览器直连 Python（clientFetch）
    ├── server-api.ts           # RSC backendFetch（转发 session cookie）
    ├── session-mirror.ts       # 登录后 JWT 镜像
    ├── conversation-types.ts   # 消息合并、时间线、ReAct 类型
    └── config/                 # 前端配置类型与派生工具

backend/
├── main.py                     # FastAPI 入口、CORS、路由挂载
├── api/
│   ├── auth.py · conversations.py · projects.py
│   ├── streaming.py            # SSE（generate/chat/design）
│   ├── files.py                # ProjectFile CRUD
│   └── config.py               # GET /api/config
├── agents/
│   ├── graph.py · pipeline_config.py · definitions.py
│   ├── react_runner.py · providers.py · template_renderer.py
├── services/
│   ├── generation.py           # 流水线编排与 ConversationMessage 写入
│   ├── event_bus.py            # SSE 事件总线与回放缓冲
│   ├── chat.py                 # 对话与 @ 提及路由
│   └── project_files.py        # 文件同步
├── db/models.py                # SQLAlchemy 模型
└── shared_config.py            # 读取 config/*.json

templates/
├── agents/                     # 各 Agent 步骤模板
├── themes/                     # 主题 CSS 变量
└── orchestration/              # 可选流水线阶段配置
```

---

仅供演示用途，与 [atoms.dev](https://atoms.dev/) 无关联。
