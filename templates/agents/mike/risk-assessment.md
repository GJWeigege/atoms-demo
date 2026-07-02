# 风险评估与优先级

## 项目：{{title}}（{{appType}}）

## Intake 输入
{{intake}}

## 任务拆解参考
{{task_decomposition}}

## 风险登记册

| ID | 风险描述 | 类别 | 概率 | 影响 | 等级 | 缓解措施 | 负责人 |
|----|----------|------|------|------|------|----------|--------|
| R-01 | 需求范围蔓延，MVP 无法单轮交付 | 范围 | 中 | 高 | **高** | MoSCoW 严格裁剪，Emma 功能优先级步骤 | Emma |
| R-02 | 设计与架构不一致导致返工 | 协作 | 中 | 中 | 中 | Bob 审阅 PRD+设计约束步骤 | Bob |
| R-03 | 纯前端 localStorage 限制复杂数据 | 技术 | 高 | 中 | 中 | Alex 明确 Mock API，文档化扩展路径 | Alex |
| R-04 | 主题 tokens 与组件样式冲突 | 设计 | 低 | 中 | 低 | Luna visual-system 引用 themeVars | Luna |
| R-05 | iframe 沙箱限制外部资源加载 | 技术 | 中 | 低 | 低 | 禁止 CDN 依赖，内联 CSS/JS | Alex |
| R-06 | 无 OpenAI Key 时模板输出过于通用 | 质量 | 中 | 中 | 中 | 丰富模板结构，上游产物交叉引用 | 全员 |

## 优先级矩阵

### P0 — 必须本迭代解决
1. 核心 {{appType}} 交互路径可运行
2. PRD → 设计 → 架构 → 代码链路 artifact 完整
3. 预览 iframe 正常渲染

### P1 — 应该解决
1. 响应式断点覆盖 mobile/tablet/desktop
2. 空状态与错误提示
3. 主题 CSS 变量全组件覆盖

### P2 — 可延后
1. 真实后端 API
2. 单元测试覆盖
3. SEO / 广告 optional agents 深度定制

## 决策记录
| 决策 | 理由 | 日期 |
|------|------|------|
| 采用 SPA + localStorage | 符合 Demo 约束，零部署依赖 | 2026-06-28 |
| 设计先于架构并行准备 | Luna 与 Bob 可基于 PRD 各自推进 | 2026-06-28 |
| Optional agents 插入 Emma 后 | PRD 是 SEO/广告/调研的共同输入 | 2026-06-28 |

## 升级路径
若 R-01 触发（范围过大）：
1. Mike 重新裁剪 intake，标记 Out-of-Scope
2. Emma 将 P2 功能移入 Backlog
3. 仅保留 Must-Have 进入 Luna/Bob/Alex 流水线
