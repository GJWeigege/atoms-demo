# 技术栈选型

## 项目：{{title}}（{{appType}}）

## 架构文档
{{architecture}}

## PRD
{{prd}}

## 设计包
{{design}}

---

## 选型矩阵

| 层级 | 候选 | 选择 | 理由 |
|------|------|------|------|
| 标记 | HTML5 / JSX | **HTML5** | 无构建链，iframe 直出 |
| 样式 | CSS / SCSS / Tailwind | **CSS + Variables** | themeVars 直接注入 |
| 脚本 | Vanilla / Vue / React | **Vanilla ES6+** | 架构 ADR-002 |
| 状态 | Redux / Zustand / 原生 | **原生对象 + 函数** | CRUD 简单 |
| 存储 | localStorage / IndexedDB | **localStorage** | ADR-001 |
| 工具 | TypeScript / JSDoc | **纯 JS** | Demo 快速交付 |
| 测试 | Vitest / 无 | **无（MVP）** | Won't Have |
| 包管理 | npm 模块 / 无 | **无依赖** | 沙箱零 CDN |

## 最终技术栈
```
HTML5 语义结构
  + CSS3 (theme tokens + component classes)
  + JavaScript ES6+ (modules optional, IIFE acceptable)
  + localStorage JSON persistence
  + 零 npm 运行时依赖
```

## 文件组织（assemble 输出）
| 产物 | 内容 |
|------|------|
| html | 结构片段（来自 frontend 或 appHtml） |
| css | themeVars + component + layout |
| js | state + events + render |

## 浏览器目标
- Chrome 120+
- Firefox 120+
- Safari 17+
- Edge 120+

## 性能预算
| 指标 | 目标 |
|------|------|
| HTML | < 5KB |
| CSS | < 8KB |
| JS | < 10KB |
| 总首屏 | < 25KB |

## 与架构对齐检查
- [x] Storage Adapter 模式 → localStorage 封装
- [x] 组件 class 与 design-package 一致
- [x] data-model schema v1
- [x] Mock API 语义在 api-implementation 实现

## 拒绝项及原因
| 技术 | 拒绝原因 |
|------|----------|
| React | 需构建，超 Demo 范围 |
| Tailwind CDN | 沙箱外网依赖 |
| TypeScript | 增加 compile 步骤 |
