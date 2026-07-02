# 前后端集成说明

## 集成目标
将 frontend UI、backend schema、API mock 层串联为可运行 SPA。

---

## 上游产物

### 前端结构
{{frontend}}

### 后端 Schema
{{backend}}

### API 规格
{{api}}

### 架构
{{architecture}}

### 设计
{{design}}

---

## 1. 集成架构
```
┌─────────────┐     events      ┌─────────────┐
│   DOM / UI  │ ◀──────────────▶│  Controller │
└─────────────┘                 └──────┬──────┘
                                       │ calls
                                ┌──────▼──────┐
                                │  api module │
                                └──────┬──────┘
                                       │
                                ┌──────▼──────┐
                                │ load/save   │
                                │ localStorage│
                                └─────────────┘
```

## 2. 绑定点清单
| DOM ID | 事件 | API 调用 | 渲染更新 |
|--------|------|----------|----------|
| #mainInput | keydown Enter | createItem | renderList |
| #primaryAction | click | createItem | renderList |
| .item-checkbox | change | updateItem(done) | renderList |
| .item-delete | click | deleteItem | renderList |
| (init) | DOMContentLoaded | listItems | renderAll |

## 3. 渲染流程
```javascript
function renderAll() {
  const items = api.listItems();
  renderList(items);
  renderStats(items);
  toggleEmptyState(items.length === 0);
}
```

## 4. CSS 集成
- 合并顺序：`themeVars` → visual-system components → layout
- class 名与 design-package §5 一致
- 空状态 `#emptyState` display toggle

## 5. 数据流验收
| 步骤 | 验证 |
|------|------|
| 添加 | 列表出现新行，input 清空，stats 更新 |
| 完成 | 样式变化，stats 完成数 +1 |
| 删除 | 行移除，localStorage 同步 |
| 刷新 | 数据完整恢复 |

## 6. 错误与边界
- 重复快速点击：debounce 或 disabled 提交中
- localStorage 不可用：内存 fallback + 警告 banner

## 7. assemble 输入清单
- [x] html 结构（frontend / appHtml）
- [x] css（themeVars + appCss）
- [x] js（controller + api + render）
- [x] 集成测试路径文档化

## 8. 已知限制
- 无真实 HTTP — 未来替换 api module 即可
- 单用户单设备 — 无 sync
