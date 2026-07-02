# 广告投放执行方案

## 项目：{{title}}

---

## 1. 受众分析
{{audience_analysis}}

---

## 2. 投放策略
{{campaign_strategy}}

---

## 3. 广告创意
{{ad_creatives}}

---

## 4. PRD 参考
{{prd}}

---

## 5. Campaign 结构

### Google Ads
```
Campaign: {{title}} - Search
├── Ad Group: AI app builder
│   ├── Keywords: AI 构建 app, {{appType}} 工具
│   └── Ads: RSA (H-A, H-B, D-A, D-B)
└── Ad Group: Brand
    └── Keywords: {{title}}, Atoms demo
```

### Meta Ads
```
Campaign: {{title}} - Conversions
├── Ad Set: Broad dev interest
├── Ad Set: Retarget 7d
└── Creatives: V1, V2
```

## 6. 预算与排期
| 周 | 日预算 | 重点 |
|----|--------|------|
| W1–2 | ¥800 | 学习期，广泛测试 |
| W3–4 | ¥1000 | 缩放胜出组 |
| W5+ | ¥1200 | Retarget 加权 |

## 7. 转化追踪
| 事件 | 触发 | 平台 |
|------|------|------|
| page_view | Landing | GA4 |
| sign_up | 注册 | GA4 + Pixel |
| build_start | 点击构建 | 自定义 |
| preview_ready | 流水线完成 | 自定义 |

## 8. KPI 目标
| 指标 | 目标 |
|------|------|
| CPC | < ¥5 |
| CPA (构建) | < ¥50 |
| ROAS | > 2 (如有付费) |
| 落地页转化率 | > 3% |

## 9. 优化节奏
- 每日：花费、CTR 异常
- 每周：创意轮换、否定词
- 每月：受众、预算再分配

## 10. 风险与合规
| 风险 | 缓解 |
|------|------|
| 点击欺诈 | 平台过滤 + 监控 |
| 落地页加载慢 | 静态 Landing |
| 预期过高 | 创意真实展示 Demo 能力 |

## 11. 签署
**广告负责人：** Adrian  
**日期：** 2026-06-28
