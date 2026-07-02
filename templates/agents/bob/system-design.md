# 系统架构设计

## 应用：{{title}}（{{appType}}）

## 审阅结论
{{requirements_review}}

## PRD 参考
{{prd}}

## 设计 UI 结构
{{design}}

---

## 1. 架构风格
- **模式：** 单页应用 (SPA)
- **分层：** 表现层 → 应用层 → 数据层（localStorage）
- **部署：** 静态 HTML，iframe 沙箱预览

## 2. 组件图
```
┌─────────────────────────────────────────┐
│              Browser (iframe)            │
│  ┌─────────────┐    ┌─────────────────┐ │
│  │  UI Layer   │───▶│  App Controller │ │
│  │ (HTML/CSS)  │    │  (JavaScript)   │ │
│  └─────────────┘    └────────┬────────┘ │
│                              │          │
│                     ┌────────▼────────┐ │
│                     │  State Manager  │ │
│                     │  (in-memory)    │ │
│                     └────────┬────────┘ │
│                              │          │
│                     ┌────────▼────────┐ │
│                     │  Storage Adapter│ │
│                     │  (localStorage) │ │
│                     └─────────────────┘ │
└─────────────────────────────────────────┘
```

## 3. 模块划分
| 模块 | 职责 | 文件/区域 |
|------|------|-----------|
| Layout | 页面骨架、Header/Footer | app-shell |
| Components | 可复用 UI（Button, Input, ListItem） | CSS classes |
| Controller | 事件绑定、业务流程 | app.js main |
| State | 内存状态、变更通知 | items[], stats |
| Storage | 持久化读写 | localStorage API |
| Theme | CSS 变量 | tokens.css |

## 4. 数据流
```
User Event → Controller.handleX()
           → State.update()
           → Storage.save(JSON)
           → UI.render()
```

## 5. 关键交互序列
### 添加项
1. User submit input
2. Validate non-empty
3. Push to state.items
4. Persist localStorage
5. Re-render list, update stats

### 页面加载
1. DOMContentLoaded
2. Storage.load() → hydrate state
3. UI.render() full pass

## 6. 技术决策
| 决策 | 选型 | 理由 |
|------|------|------|
| 框架 | 无 | Demo 约束，减小体积 |
| 状态 | 原生 JS 对象 | 简单 CRUD 足够 |
| 路由 | 无（单页） | MVP 范围 |
| 样式 | CSS Variables | 主题注入 |

## 7. 扩展点（Future）
- Storage Adapter 接口 → 可换 fetch API
- Event Bus → 模块解耦
- Router → 多视图 {{appType}}

## 8. 下游输入
- **data-model：** 实体字段、localStorage key
- **architecture：** 汇总本文 + API 设计
