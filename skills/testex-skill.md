# Skill: testex MCP — AI Index for Test IDs & UI Components

## Mục đích

testex là một MCP server chạy **100% local**, cung cấp vector index cho toàn bộ
`data-test` IDs và UI components trong dự án (React, Vue, Svelte, Angular).

Agent sử dụng skill này để:
- Tìm đúng `data-testid` mà không cần đọc source code
- Hiểu cấu trúc trang trước khi viết test
- Generate Playwright test spec chính xác, đúng thứ tự

---

## Điều kiện tiên quyết

Trước khi gọi bất kỳ tool nào, xác nhận index đã tồn tại:

```
→ index_stats()
← { total_components: 42, total_test_ids: 187 }
```

Nếu `total_components = 0` → yêu cầu user chạy:
```bash
node dist/cli/index.js index <path-to-src>
```

---

## Tool Catalog

### 1. `list_pages`
**Khi nào dùng:** Bước đầu tiên khi không biết project có gì.

```
list_pages({ limit?: number })
→ [{ name, route, file, test_ids_count, test_ids, framework }]
```

**Rule:** Luôn gọi `list_pages` trước khi viết test cho một trang mới.

---

### 2. `get_test_plan`
**Khi nào dùng:** Cần đầy đủ thông tin để viết test cho 1 page. **Tool quan trọng nhất.**

```
get_test_plan({ page: string })
→ {
    route,
    all_test_ids,
    elements: [{ testId, tag, inputType, text, placeholder, order }],
    test_flow: [{ step, action, testId, value, hint }],
    playwright_snippet
  }
```

**Rule:** `test_flow` đã được sắp xếp theo thứ tự DOM — dùng đúng thứ tự này khi fill form.

**Ví dụ `test_flow`:**
```json
[
  { "step": 1, "action": "fill",  "testId": "login-email-input",    "value": "test@example.com" },
  { "step": 2, "action": "fill",  "testId": "login-password-input", "value": "TestPassword123!" },
  { "step": 3, "action": "click", "testId": "login-submit-button",  "text": "Sign In" }
]
```

---

### 3. `generate_playwright_test`
**Khi nào dùng:** Cần Playwright spec sẵn sàng copy-paste.

```
generate_playwright_test({ component: string, route?: string })
→ { component, file, route, confidence, test_flow, playwright_test }
```

**Rule:** Confidence `low` → verify lại file path trước khi dùng.

---

### 4. `search_components`
**Khi nào dùng:** Tìm component theo ngôn ngữ tự nhiên.

```
search_components({ query: string, limit?: number })
→ [{ name, file, route, data_test_ids, confidence, score }]
```

**Ví dụ:** `"form đăng nhập"`, `"nút submit thanh toán"`, `"dropdown chọn quốc gia"`

---

### 5. `search_test_ids`
**Khi nào dùng:** Tìm component chứa 1 test ID cụ thể. Exact match trước, fallback semantic.

```
search_test_ids({ query: string, limit?: number, exact?: boolean })
→ [{ component, file, test_ids, match_type, confidence }]
```

---

### 6. `search_multi`
**Khi nào dùng:** Tìm nhiều keyword **không liên quan** cùng lúc.

```
search_multi({ keywords: string[], limit?: number })
→ [{ name, file, route, data_test_ids, confidence }]
```

**Ví dụ:** `keywords: ["login form", "checkout page"]` — embed riêng từng keyword, merge kết quả.

---

### 7. `search_must`
**Khi nào dùng:** Tìm component **phải chứa TẤT CẢ** các test ID chỉ định.

```
search_must({ test_ids: string[], limit?: number })
→ [{ name, file, route, data_test_ids }]
```

**Ví dụ:** Xác nhận LoginForm có cả `email-input` và `password-input` và `submit-button`.

---

### 8. `find_by_action`
**Khi nào dùng:** Tìm tất cả components có 1 loại interaction cụ thể.

```
find_by_action({ action: "click"|"submit"|"fill"|"check"|"navigate", limit?: number })
→ [{ name, route, file, data_test_ids, elements }]
```

**Ví dụ:** `find_by_action("submit")` → tìm tất cả form submit trong dự án.

---

### 9. `get_user_flow`
**Khi nào dùng:** Lấy danh sách components + test IDs của 1 route.

```
get_user_flow({ page: string })
→ { page, components: [{ name, route, test_ids, actions }] }
```

---

### 10. `explain_page_structure`
**Khi nào dùng:** Audit test coverage của 1 route.

```
explain_page_structure({ route: string })
→ { components, total_test_ids, test_ids, available_actions, test_coverage }
```

`test_coverage: "good"` = có > 3 test IDs. `"needs_improvement"` = thiếu coverage.

---

### 11. `find_similar_components`
**Khi nào dùng:** Tìm component tương tự để reuse test pattern.

```
find_similar_components({ component: string, limit?: number })
→ [{ name, file, test_ids, similarity, confidence }]
```

---

### 12. `list_all_test_ids`
**Khi nào dùng:** Liệt kê toàn bộ test IDs trong project (có phân trang).

```
list_all_test_ids({ limit?: number, offset?: number })
→ { total, offset, limit, ids: string[] }
```

**Rule:** Mặc định `limit=200`. Dùng `offset` để lấy trang tiếp theo.

---

### 13. `index_stats`
**Khi nào dùng:** Kiểm tra nhanh project đã được index chưa.

```
index_stats()
→ { total_components, total_test_ids, db_path, embedding_model }
```

---

## Decision Tree

```
Task?
│
├─ "Viết test cho trang X"
│   └─ list_pages → get_test_plan(X) → generate_playwright_test(X)
│
├─ "Tìm test ID của component Y"
│   └─ search_test_ids(Y) hoặc search_components(Y)
│
├─ "Dự án có những trang nào?"
│   └─ list_pages()
│
├─ "Component này có đủ test ID chưa?"
│   └─ explain_page_structure(route)
│
├─ "Tìm tất cả form trong dự án"
│   └─ find_by_action("submit")
│
├─ "Component X và Y nằm trên cùng trang không?"
│   └─ search_must({ test_ids: [X, Y] })
│
└─ "Viết test cho toàn bộ dự án"
    └─ list_pages → loop: get_test_plan → generate_playwright_test
```

---

## Confidence Levels

| Level  | Icon | Score range | Ý nghĩa |
|--------|------|-------------|---------|
| high   | ●    | < 0.4       | Kết quả chính xác, dùng ngay |
| medium | ◑    | 0.4–0.8     | Khá đúng, nên verify file path |
| low    | ○    | > 0.8       | Kết quả mơ hồ, cần kiểm tra thủ công |

---

## Patterns

### Pattern 1: Viết test cho 1 page
```
1. get_test_plan("LoginPage")
2. Đọc test_flow → viết theo đúng thứ tự step
3. Thêm 3 test cases: happy path, smoke visibility, negative validation
4. Ghi ra tests/e2e/login-page.spec.ts
```

### Pattern 2: Tìm và dùng test ID không biết tên
```
1. search_test_ids("email field on login") → lấy test ID
2. search_test_ids("submit button") → lấy test ID
3. search_must({ test_ids: [...] }) → xác nhận cùng component
```

### Pattern 3: Audit coverage trước khi viết test
```
1. list_pages → lấy tất cả routes
2. explain_page_structure(route) cho mỗi trang
3. Ưu tiên trang có test_coverage: "needs_improvement"
```

### Pattern 4: Generate test cho toàn bộ project
```
1. list_pages({ limit: 100 })
2. Với mỗi page: get_test_plan(page.name)
3. generate_playwright_test(page.name) → ghi file
```

---

## Error Handling

| Tình huống | Xử lý |
|---|---|
| Tool trả về `{ error: "..." }` | Đọc message, báo user, không tiếp tục |
| `total_components = 0` | Hướng dẫn chạy `testex index` |
| Confidence `low` | Ghi chú trong test file, để TODO |
| `playwright_snippet` trống | Fallback sang `search_components` + tự tạo locators |
| Route không có `/` prefix | Tool tự thêm, không cần lo |
