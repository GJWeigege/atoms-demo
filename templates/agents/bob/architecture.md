# 技术架构规格（完整版）

## 1. 文档信息
| 字段 | 内容 |
|------|------|
| 项目 | {{title}} |
| 类型 | {{appType}} |
| 架构师 | Bob |

---

## 2. PRD/设计审阅
{{requirements_review}}

---

## 3. 系统架构
{{system_design}}

---

## 4. 数据模型
{{data_model}}

---

## 5. 技术栈总览
| 层级 | 选型 | 说明 |
|------|------|------|
| 结构 | HTML5 语义化 | header / main / section |
| 样式 | CSS3 + Variables | {{themeLabel}} 主题 tokens |
| 逻辑 | 原生 JavaScript (ES6+) | 无框架 |
| 状态 | 内存 + localStorage | 见 data-model |
| 构建 | Alex assemble | 合并 html/css/js |

## 6. API 设计（Mock / 未来扩展）
```
GET    /api/items          → Item[]
POST   /api/items          → Item (body: { text })
PATCH  /api/items/:id      → Item (body: { done?, text? })
DELETE /api/items/:id      → 204

# 当前实现：Storage Adapter 模拟上述语义，无 HTTP
```

## 7. UI 结构（来自设计包）
{{design}}

## 8. 模块目录（逻辑）
```
src/
├── layout/       # AppShell, Header, Footer
├── components/   # Button, Input, ListItem, EmptyState
├── state/        # store.js — load/save/mutate
├── views/        # main view render
└── theme/        # tokens (injected CSS)
```

## 9. 响应式断点
| 名称 | 宽度 | 布局 |
|------|------|------|
| mobile | < 640px | 单列，full width |
| tablet | 640–1024px | 居中 max-width |
| desktop | > 1024px | 卡片居中 480–960px |

## 10. 安全与沙箱
- 无 eval / innerHTML 用户输入
- XSS：textContent 渲染用户文本
- iframe sandbox 兼容

## 11. PRD 追溯
{{prd}}

## 12. 架构决策记录 (ADR)
| ID | 决策 | 状态 |
|----|------|------|
| ADR-001 | localStorage 替代后端 | 已接受 |
| ADR-002 | 无框架 SPA | 已接受 |
| ADR-003 | Mock API 文档化 | 已接受 |
