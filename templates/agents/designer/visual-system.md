# 视觉系统 (Design Tokens)

## 项目：{{title}}
**主题：** {{themeLabel}} — {{themeDescription}}

## 线框参考
{{wireframe}}

## PRD 约束
{{prd}}

---

## 1. 色彩系统

### 语义色（映射 theme tokens）
| Token | CSS 变量 | 用途 |
|-------|----------|------|
| Background | `--bg` | 页面背景 |
| Surface | `--card` | 卡片/容器 |
| Primary | `--primary` | 主按钮、链接 |
| Text Primary | `--text` | 标题、正文 |
| Text Muted | `--muted` | 副标题、占位 |
| Border | `--border` | 分割线、输入框 |

### 主题 CSS 源文件
```css
{{themeVars}}
```

## 2. 字体系统
| 级别 | 大小 | 字重 | 行高 | 用途 |
|------|------|------|------|------|
| Display | 1.75rem | 700 | 1.2 | 页面标题 |
| H2 | 1.25rem | 600 | 1.3 | 区块标题 |
| Body | 1rem | 400 | 1.5 | 正文 |
| Small | 0.875rem | 400 | 1.4 | 辅助文字 |
| Caption | 0.75rem | 500 | 1.3 | 标签/统计 |

**字体栈：** `system-ui, -apple-system, "Segoe UI", sans-serif`

## 3. 间距系统 (4px 基准)
| Token | 值 | 用途 |
|-------|-----|------|
| space-1 | 4px | 图标间距 |
| space-2 | 8px | 紧凑内边距 |
| space-3 | 12px | 列表项 padding |
| space-4 | 16px | 卡片内边距 |
| space-6 | 24px | 区块间距 |
| space-8 | 32px | 页面边距 |

## 4. 圆角与阴影
| Token | 值 | 组件 |
|-------|-----|------|
| radius-sm | 8px | Input, Button |
| radius-md | 12px | Card |
| radius-lg | 16px | App Shell |
| shadow-md | 0 4px 24px rgba(0,0,0,0.12) | 主容器 |

## 5. 组件规格

### Primary Button
```css
.btn-primary {
  background: var(--primary);
  color: #fff;
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-sm, 8px);
  font-weight: 600;
  border: none;
  cursor: pointer;
}
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
```

### Text Input
```css
.input {
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 8px);
  background: var(--bg);
  color: var(--text);
  width: 100%;
}
.input:focus { outline: 2px solid var(--primary); outline-offset: 2px; }
```

### Card / App Shell
```css
.app-shell {
  background: var(--card);
  border-radius: var(--radius-lg, 16px);
  padding: var(--space-6, 24px);
  box-shadow: var(--shadow-md);
  max-width: 480px;
  width: 100%;
}
```

## 6. 图标与 emoji
- 标题区：✦ 或业务相关 emoji
- 空状态：📋
- 统计：纯文字，避免图标过载

## 7. 无障碍
- 正文对比度 ≥ 4.5:1
- Focus 环可见
- 按钮 min-height 44px（移动端）

## 8. 交付给 design-package
- 以上 token 全部注入最终 CSS
- HTML class 命名：BEM 风格 `.app`, `.input-row`, `.btn-primary`
