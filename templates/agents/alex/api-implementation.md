# API 接口实现（Mock）

## 项目上下文
基于架构：{{architecture}}

## 后端 Schema
{{backend}}

## 数据模型
{{data_model}}

## 技术栈
{{tech_stack}}

---

## 1. API 概览
**Base URL（未来）：** `/api`  
**当前实现：** 客户端 Storage Adapter，语义等价 REST

## 2. 端点规格

### GET /api/items
**描述：** 获取全部 Item 列表  
**响应 200：**
```json
{
  "items": [
    { "id": "abc", "text": "任务1", "done": false, "createdAt": "2026-06-28T00:00:00Z" }
  ],
  "total": 1
}
```
**Mock 实现：** `return { items: loadState().items, total: state.items.length }`

---

### POST /api/items
**描述：** 创建新 Item  
**请求体：**
```json
{ "text": "新任务" }
```
**响应 201：**
```json
{ "id": "new-uuid", "text": "新任务", "done": false, "createdAt": "..." }
```
**校验：** text 必填，trim 后 length ≥ 1  
**Mock：** `createItem(text)` → return item

---

### PATCH /api/items/:id
**描述：** 更新 Item  
**请求体：**
```json
{ "done": true, "text": "可选更新" }
```
**响应 200：** 完整 Item 对象  
**404：** id 不存在

---

### DELETE /api/items/:id
**描述：** 删除 Item  
**响应 204：** 无 body  
**Mock：** `deleteItem(id)`

---

## 3. 客户端 API 模块
```javascript
const api = {
  listItems: () => loadState().items,
  createItem: (text) => { /* validate, push, save, return */ },
  updateItem: (id, patch) => { /* merge, save */ },
  deleteItem: (id) => { /* splice, save */ },
};
```

## 4. 错误码（Mock 映射）
|  code | 场景 | 前端处理 |
|------|------|----------|
| 400 | 空 text | 输入框 error 态 |
| 404 | id 不存在 | console.warn |
| 500 | JSON 损坏 | 重置 state |

## 5. 与 frontend 集成点
- `#primaryAction` onclick → api.createItem
- checkbox onchange → api.updateItem(id, { done })
- delete btn → api.deleteItem(id)
- DOMContentLoaded → api.listItems → render

## 6. 测试用例（手动）
| # | 操作 | 期望 |
|---|------|------|
| 1 | POST 空 text | 拒绝 |
| 2 | POST 有效 text | 列表 +1，localStorage 更新 |
| 3 | PATCH done | checkbox 状态同步 |
| 4 | DELETE | 项消失，计数减 1 |
| 5 | 刷新页面 | GET 恢复数据 |
