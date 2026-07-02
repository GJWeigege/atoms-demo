# 后端 / 数据层 Schema

## 应用类型
{{appType}}

## 技术栈
{{tech_stack}}

## 架构规格
{{architecture}}

## 数据模型（Bob）
{{data_model}}

## PRD 数据需求
{{prd}}

---

## 1. 存储层设计

### localStorage Adapter
```javascript
const STORAGE_KEY = 'atoms-{{appType}}-v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, items: [], meta: {} };
    return JSON.parse(raw);
  } catch (e) {
    console.warn('State load failed', e);
    return { version: 1, items: [], meta: {} };
  }
}

function saveState(state) {
  state.meta.lastModified = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
```

## 2. 实体 Schema v1
| 实体 | 字段 | 类型 | 约束 |
|------|------|------|------|
| Item | id | string | UUID |
| Item | text | string | min 1 |
| Item | done | boolean | default false |
| Item | createdAt | string | ISO8601 |

## 3. 业务逻辑层
| 函数 | 签名 | 说明 |
|------|------|------|
| createItem | (text) => Item | 校验 + push + save |
| toggleItem | (id) => void | 翻转 done |
| deleteItem | (id) => void | splice + save |
| filterItems | (query?) => Item[] | 搜索 P1 |

## 4. Mock API 映射
| HTTP | 内部函数 |
|------|----------|
| GET /api/items | loadState().items |
| POST /api/items | createItem(body.text) |
| PATCH /api/items/:id | toggleItem / update text |
| DELETE /api/items/:id | deleteItem |

## 5. 错误处理
| 场景 | 行为 |
|------|------|
| 空 text | throw / return false，UI 提示 |
| 存储满 | alert 用户，不 silent fail |
|  corrupt JSON | 重置为空 state |

## 6. 持久化策略
- 每次 mutation 立即 saveState（同步）
- 无 debounce（数据量小）
- 页面 beforeunload 无需额外处理

## 7. 扩展预留
```javascript
// Future: swap adapter
// const api = createRestAdapter('/api');
// const api = createLocalStorageAdapter(STORAGE_KEY);
```
