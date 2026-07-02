# 设计调研与参考

## 项目：{{title}}
**主题方向：** {{themeLabel}}

## PRD 摘要
{{prd}}

## 需求要点
{{requirements}}

---

## 竞品视觉参考

| 产品 | 类型 | 布局特点 | 色彩 | 可借鉴 | 避免 |
|------|------|----------|------|--------|------|
| Notion | 生产力 | 侧边栏+主内容 | 中性灰 | 清晰层级 | 过重信息密度 |
| Linear | 任务 | 极简列表 | 紫/深色 | 紧凑列表 | 过度动画 |
| Todoist | 待办 | 单列+输入顶栏 | 红/白 | 快速添加交互 | 品牌色硬套 |
| Stripe Dashboard | 数据 | 卡片网格 | 渐变紫 | 数据卡片 | 复杂图表 |

## 设计趋势 (2026)
1. **Soft UI** — 大圆角、柔和阴影（契合 {{themeLabel}}）
2. **CSS Variables** — 主题 token 驱动，便于 Alex 组装
3. **Mobile-first** — 触控目标 ≥ 44px
4. **微交互** — hover/focus 态，不过度

## 用户旅程设计启示
- 首次使用：Hero 区 + 单一 CTA
- 深度使用：列表密度适中，操作按钮右对齐
- 空状态：插画占位 + 「开始添加」引导

## 约束清单
| 约束 | 说明 |
|------|------|
| 技术 | 纯 CSS，无 Tailwind 运行时 |
| 主题 | 必须使用 `templates/themes/{{theme}}/tokens.css` |
| 沙箱 | 无外部字体 CDN，system-ui 栈 |
| 范围 | 仅 MVP Must-Have 界面 |

## 设计原则
1. **清晰优先** — 主操作一眼可见
2. **一致性** — 间距 4/8/16/24/32 倍数
3. **可访问** — 对比度 WCAG AA
4. **可交付** — 线框可直接映射 HTML 结构

## 调研结论 → 线框输入
- 布局：Header + Main（单列或主从）
- 组件：Button、Input、Card、List Item
- 色彩：引用 theme tokens，不硬编码 hex
- 下一步：输出 ASCII 线框与区域标注
