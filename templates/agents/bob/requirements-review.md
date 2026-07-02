# PRD 与设计约束审阅

## 项目：{{title}}

## PRD 全文
{{prd}}

## 设计交付包
{{design}}

## 需求规格
{{requirements}}

---

## 审阅清单

### PRD 完整性
| 检查项 | 状态 | 备注 |
|--------|------|------|
| Must-Have 功能明确 | ✅ | MoSCoW 已定义 |
| 验收标准可测 | ✅ | 用户故事含 AC |
| 非功能需求 | ✅ | 性能/响应式/沙箱 |
| 数据实体描述 | ⚠️ | 需在 data-model 细化 |
| API 边界 | ⚠️ | 明确 localStorage only |

### 设计约束
| 检查项 | 状态 | 架构影响 |
|--------|------|----------|
| HTML 结构语义化 | ✅ | 组件层映射清晰 |
| CSS 变量主题 | ✅ | 无硬编码色值 |
| 组件 ID 约定 | ✅ | #mainInput, #itemList |
| 响应式断点 | ✅ | 640/1024 与 PRD 一致 |
| 外部依赖 | ✅ | 零 CDN |

## 架构输入清单（给 system-design）
1. **应用模式：** SPA，客户端渲染
2. **状态存储：** localStorage，键名待 data-model 定义
3. **模块边界：** Layout / Components / State / Theme
4. **UI 绑定点：** 设计包 §5 HTML IDs
5. **扩展预留：** Mock API 接口形状（未来后端）

## 风险与缺口
| 缺口 | 严重度 | 处理 |
|------|--------|------|
| 无真实 auth | 低 | Won't Have，文档化 |
| 搜索功能 P1 | 中 | 前端 filter，无服务端 |
| 批量操作 | 低 | Could Have，v2 |

## 审阅结论
**结论：** 通过，可进入系统架构设计  
**条件：** data-model 步骤必须输出 localStorage schema  
**签字：** Bob · 系统架构师
