# SEO 审计

## 项目：{{title}}

## 内容策略
{{content_strategy}}

## 关键词
{{keyword_research}}

## PRD
{{prd}}

---

## 1. 技术 SEO 检查清单
| 检查项 | 状态 | 说明 |
|--------|------|------|
| `<title>` 唯一且含关键词 | ⚠️ | 需动态 {{title}} |
| meta description | ⚠️ | 150 字符内 |
| `<html lang="zh-CN">` | ✅ | preview 已设 |
| viewport meta | ✅ | 响应式 |
| HTTPS | ✅ | 部署层 |
| robots.txt | ⚠️ | 需允许 crawl |
| sitemap.xml | ✗ | 待生成 |
| canonical URL | ⚠️ | 防 duplicate |
| 结构化数据 | ✗ | 建议 WebApplication |

## 2. 页面 SEO
| 页面 | Title 建议 | Meta 建议 |
|------|------------|-----------|
| 首页 | {{title}} — AI 构建 {{appType}} | 用 Atoms 多智能体团队几分钟构建... |
| 预览 | {{title}} 预览 | 在线体验 {{appType}} 应用 |
| 项目 | 工作区 — {{title}} | noindex (私有) |

## 3. 内容 SEO
| 检查项 | 状态 |
|--------|------|
| H1 唯一 | ⚠️ |
| 关键词密度自然 | ✅ |
| 图片 alt | ⚠️ iframe 内 |
| 内链结构 | ⚠️ |
| 内容深度 ≥ 300 字 | 依赖 PRD/页面 |

## 4. 性能 (Core Web Vitals)
| 指标 | 目标 | 当前(估) |
|------|------|----------|
| LCP | < 2.5s | 优（静态） |
| FID/INP | < 200ms | 优 |
| CLS | < 0.1 | 需测 |

## 5. 移动 SEO
- [x] Mobile-friendly
- [x] 触控目标尺寸
- [ ] AMP（不需要）

## 6. 问题优先级
| 问题 | 严重 | 修复 |
|------|------|------|
| 无 sitemap | 中 | 构建时生成 |
| 项目页 index | 高 | noindex |
| 缺 Schema | 中 | JSON-LD 注入 |

## 7. 竞品 SEO 差距
- 竞品 A：blog 内容丰富 → 我们需 content-strategy 执行
- 竞品 B：模板页 SEO 强 → 模板库页面对标
