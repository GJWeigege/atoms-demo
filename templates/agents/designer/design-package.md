# 设计交付包

## 项目：{{title}}
**视觉主题：** {{themeLabel}}

---

## 1. 视觉系统引用
{{visual_system}}

---

## 2. 线框实现对照
{{wireframe}}

---

## 3. PRD 功能对齐
{{prd}}

---

## 4. 设计令牌（完整注入）
```css
{{themeVars}}

/* Component tokens from visual-system */
.app-shell { background: var(--card); border-radius: 16px; padding: 2rem; }
.btn-primary { background: var(--primary); color: #fff; border-radius: 8px; padding: 0.75rem 1.25rem; }
.input { border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 8px; }
```

---

## 5. HTML 结构片段（供 Alex 引用）

```html
<div class="app-shell">
  <header class="app-header">
    <h1 class="app-title">{{title}}</h1>
    <p class="app-subtitle">Built by Atoms Demo</p>
  </header>
  <div class="input-row">
    <input class="input" id="mainInput" type="text" placeholder="输入内容..." />
    <button class="btn-primary" id="primaryAction">添加</button>
  </div>
  <main class="app-main">
    <ul class="item-list" id="itemList"></ul>
    <div class="empty-state" id="emptyState">
      <p>📋 还没有任何内容</p>
      <button class="btn-primary">创建第一条</button>
    </div>
  </main>
  <footer class="app-footer">
    <span id="stats">0 项</span>
  </footer>
</div>
```

---

## 6. 组件状态表
| 组件 | Default | Hover | Focus | Disabled | Error |
|------|---------|-------|-------|----------|-------|
| btn-primary | primary bg | opacity 0.9 | outline | opacity 0.5 | — |
| input | border | — | primary outline | bg muted | red border |
| list-item | transparent | bg subtle | — | — | — |

---

## 7. 响应式规格
| 断点 | app-shell | input-row |
|------|-----------|-----------|
| mobile | padding 1rem, full width | column 或 flex |
| tablet+ | max-width 480–720px | flex row |

---

## 8. 交付清单
- [x] 主题 CSS 变量（themeVars）
- [x] 视觉系统 token 文档
- [x] 线框 ASCII → HTML 映射
- [x] 组件 class 命名规范
- [x] 空状态与统计区规格
- [x] 无障碍 contrast 说明

---

## 9. Bob / Alex 引用说明
- **Bob：** UI 结构见 §5，数据绑定点 `#mainInput`, `#itemList`, `#stats`
- **Alex：** 合并 themeVars + 组件 CSS；JS 操作上述 ID
