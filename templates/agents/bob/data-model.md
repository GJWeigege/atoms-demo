# 数据模型设计

## 应用类型：{{appType}}

## 系统架构参考
{{system_design}}

## PRD 数据需求
{{prd}}

## 审阅清单
{{requirements_review}}

---

## 1. 实体关系图 (ER)
```
┌──────────────┐       ┌──────────────┐
│    AppMeta   │       │     Item     │
├──────────────┤       ├──────────────┤
│ version      │       │ id (string)  │
│ createdAt    │  1:N  │ text         │
│ theme        │◀──────│ done         │
└──────────────┘       │ createdAt    │
                       └──────────────┘
```

## 2. 实体定义

### Item（主业务实体）
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string (uuid) | ✓ | 唯一标识 |
| text | string | ✓ | 显示内容 |
| done | boolean | ✓ | 完成状态 |
| createdAt | ISO8601 | ✓ | 创建时间 |

### AppState（根对象）
| 字段 | 类型 | 说明 |
|------|------|------|
| version | number | Schema 版本，当前 1 |
| items | Item[] | 业务数据数组 |
| meta | object | 扩展元数据 |

## 3. localStorage Schema
**键名：** `atoms-{{appType}}-v1`

```json
{
  "version": 1,
  "items": [
    {
      "id": "uuid-1",
      "text": "示例任务",
      "done": false,
      "createdAt": "2026-06-28T00:00:00.000Z"
    }
  ],
  "meta": {
    "lastModified": "2026-06-28T00:00:00.000Z"
  }
}
```

## 4. 校验规则
| 规则 | 实现 |
|------|------|
| text 非空 | trim().length > 0 |
| id 唯一 | 创建时 crypto.randomUUID() |
| 数组上限 | 软限 1000 条（可选） |
| JSON 解析失败 | 回退空数组 + console.warn |

## 5. CRUD 操作映射
| 操作 | State 变更 | Storage |
|------|------------|---------|
| Create | items.push | setItem |
| Read | items (load) | getItem |
| Update | items[i].field = | setItem |
| Delete | items.splice | setItem |

## 6. 索引与查询
- **按 done 筛选：** `items.filter(i => !i.done)` — 客户端
- **搜索：** `items.filter(i => i.text.includes(q))` — P1

## 7. 迁移策略
| 从版本 | 到版本 | 策略 |
|--------|--------|------|
| 无数据 | v1 | 初始化空结构 |
| v1 | v2 | 未来：meta 扩展字段 |

## 8. Alex 实现要点
- `loadState()` / `saveState(state)` 封装
- 所有 mutation 后调用 saveState
- assemble 时 backend artifact 引用本 schema
