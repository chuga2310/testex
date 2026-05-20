# testex — Hướng dẫn sử dụng

## Mục lục

1. [testex là gì?](#1-testex-là-gì)
2. [Cài đặt](#2-cài-đặt)
3. [Index dự án](#3-index-dự-án)
4. [CLI reference](#4-cli-reference)
5. [Tích hợp MCP](#5-tích-hợp-mcp)
6. [Tham chiếu MCP tools](#6-tham-chiếu-mcp-tools)
7. [REST API](#7-rest-api)
8. [Cấu hình](#8-cấu-hình)
9. [File ví dụ](#9-file-ví-dụ)
10. [Kiến trúc](#10-kiến-trúc)

---

## 1. testex là gì?

testex xây dựng một **vector index cục bộ** cho toàn bộ UI component trong dự án,
trích xuất:

- Các thuộc tính `data-test`, `data-testid`, `data-cy`, `data-e2e`
- Metadata chi tiết từng element (tag, input type, text của button, placeholder, aria-label)
- Route của trang, tương tác người dùng, cấu trúc component

Index được expose qua ba giao diện:

| Giao diện | Dùng khi nào |
|-----------|-------------|
| **MCP server** | Claude Code, Cursor, hoặc bất kỳ agent hỗ trợ MCP |
| **CLI** | Tìm kiếm trực tiếp trên terminal, scripting |
| **REST API** | Truy cập HTTP từ bất kỳ ngôn ngữ nào |

**Chạy hoàn toàn offline** — model ONNX (~32 MB) được bundled trong `./models/`.
Không có network call sau khi `npm install`.

---

## 2. Cài đặt

```bash
git clone https://github.com/YOUR_USERNAME/testex
cd testex
npm install
```

`npm install` tự động thực hiện 2 bước:
1. Compile TypeScript → `dist/`
2. Tải ONNX model vào `./models/` (1 lần duy nhất, ~32 MB)

Kiểm tra cài đặt:
```bash
node dist/cli/index.js --version
```

---

## 3. Index dự án

### Index cơ bản

```bash
node dist/cli/index.js index /đường/dẫn/tới/src
```

testex duyệt toàn bộ thư mục và phân tích mọi file `.tsx`, `.jsx`, `.ts`, `.js`,
`.vue`, `.svelte`, `.html`.

### Re-index sau khi thay đổi code

```bash
node dist/cli/index.js index /đường/dẫn/src --reset   # xóa index cũ + rebuild
```

### Watch — tự động re-index khi lưu file

```bash
node dist/cli/index.js watch /đường/dẫn/src
```

### Xác nhận đã index thành công

```bash
node dist/cli/index.js stats
# → Total components : 48
# → Total test IDs   : 213
```

> **Lưu ý:** Nếu bạn thêm `elements` field vào schema (phiên bản mới), cần chạy
> `--reset` để rebuild index với cấu trúc mới.

---

## 4. CLI reference

### `search` — Tìm kiếm

```bash
# Tìm kiếm ngữ nghĩa (natural language)
node dist/cli/index.js search "nút submit đăng nhập"
node dist/cli/index.js search "form thanh toán"

# Tìm chính xác theo tên test ID
node dist/cli/index.js search "login-btn" --test-ids

# Union search — embed từng keyword riêng, merge kết quả tốt nhất
# Dùng khi các keyword không liên quan đến nhau
node dist/cli/index.js search login --union checkout --union register

# AND filter — chỉ trả về component chứa TẤT CẢ các test ID này
node dist/cli/index.js search email --must password --must submit

# Giới hạn số kết quả
node dist/cli/index.js search "button" --limit 20
```

Kết quả tìm kiếm có cột **confidence** (độ tin cậy):

```
#   Component         Route    Test IDs                    Conf.     Score
────────────────────────────────────────────────────────────────────────────
1   LoginForm         /login   login-form, login-email-…  ● high    0.182
2   CheckoutForm      /cart    checkout-email, …          ◑ medium  0.521
```

| Icon | Mức độ | Ý nghĩa |
|------|--------|---------|
| ●    | high   | Chính xác — dùng trực tiếp |
| ◑    | medium | Khá đúng — nên verify file path |
| ○    | low    | Không chắc — cần kiểm tra thủ công |

### `test-context` — Lấy Playwright locators

```bash
node dist/cli/index.js test-context LoginForm
```

Output:
```
Component : LoginForm
File      : src/components/LoginForm.tsx
Route     : /login

Locators:
  page.getByTestId('login-email-input')
  page.getByTestId('login-password-input')
  page.getByTestId('login-submit-button')

Actions   : submit
```

### `stats` — Thống kê index

```bash
node dist/cli/index.js stats
```

### `watch` — Theo dõi thay đổi

```bash
node dist/cli/index.js watch ./src   # re-index khi file thay đổi
```

### `serve` / `mcp`

```bash
node dist/cli/index.js serve    # khởi động REST API trên :8000
node dist/cli/index.js mcp      # khởi động MCP server qua stdio
```

---

## 5. Tích hợp MCP

### Với Claude Code

Thêm vào `.mcp.json` ở thư mục gốc dự án của bạn:

```json
{
  "mcpServers": {
    "testex": {
      "command": "node",
      "args": ["/đường/dẫn/tuyệt/đối/tới/testex/dist/cli/index.js", "mcp"]
    }
  }
}
```

Khởi động lại Claude Code, kiểm tra bằng `/mcp`.

Ví dụ câu hỏi:
- *"Trang login có những test ID nào?"*
- *"Generate Playwright test cho LoginForm"*
- *"Tìm tất cả nút submit trong dự án"*
- *"Trang login đã có đủ test ID chưa?"*

### Với GitHub Copilot (VS Code 1.102+)

**Yêu cầu:** VS Code 1.102 trở lên · GitHub Copilot extension (phiên bản mới nhất)

Tạo file `.vscode/mcp.json` ở thư mục gốc dự án:

```json
{
  "servers": {
    "testex": {
      "command": "node",
      "args": ["/đường/dẫn/tuyệt/đối/tới/testex/dist/cli/index.js", "mcp"]
    }
  }
}
```

> **Lưu ý quan trọng:** Copilot dùng key `"servers"`, khác với Claude Code dùng `"mcpServers"`.

**Các bước thực hiện:**

1. Tạo hoặc mở `.vscode/mcp.json`
2. Paste config trên với đường dẫn thực tế của bạn
3. Nút **Start** xuất hiện ở đầu file — click để khởi động server
4. Mở **Copilot Chat** → click dropdown chọn mode → chọn **Agent**
5. Các tools của testex đã sẵn sàng sử dụng

**Ví dụ câu hỏi:**
- *"Dự án này có những trang nào?"*
- *"Generate Playwright test cho trang login"*
- *"Tìm tất cả nút submit và test ID của chúng"*

**Workspace vs. user config:**

| Cấp độ | File | Dùng khi nào |
|--------|------|-------------|
| Workspace | `.vscode/mcp.json` | Chia sẻ với team qua git |
| User | VS Code Settings Sync | Config cá nhân, đồng bộ giữa các máy |

Nên commit `.vscode/mcp.json` vào repo để mọi thành viên trong team
đều tự động có testex tools mà không cần cấu hình thêm.

### Với Cursor

Thêm vào cài đặt MCP của Cursor với cùng format `command` + `args` như Claude Code.

### Với JetBrains IDEs (public preview)

GitHub Copilot agent mode với MCP đang ở public preview cho IntelliJ, PyCharm,
WebStorm và các IDE JetBrains khác (từ tháng 5/2025). Format cấu hình khác
mỗi IDE — xem
[tài liệu JetBrains Copilot MCP](https://docs.github.com/copilot/customizing-copilot/using-model-context-protocol/extending-copilot-chat-with-mcp)
để biết các bước cụ thể.

---

## 6. Tham chiếu MCP tools

### Khám phá

| Tool | Khi nào dùng |
|------|-------------|
| `index_stats()` | Xác nhận index tồn tại trước mọi thao tác |
| `list_pages({ limit? })` | Bước đầu tiên — xem tất cả routes trong dự án |
| `list_all_test_ids({ limit?, offset? })` | Duyệt toàn bộ test IDs (phân trang, mặc định 200) |

### Tìm kiếm

| Tool | Khi nào dùng |
|------|-------------|
| `search_components({ query, limit? })` | Tìm component bằng ngôn ngữ tự nhiên |
| `search_test_ids({ query, exact?, limit? })` | Tìm theo tên test ID (exact hoặc semantic) |
| `search_multi({ keywords[], limit? })` | Nhiều keyword không liên quan, merge kết quả tốt nhất |
| `search_must({ test_ids[], limit? })` | AND filter — phải chứa tất cả IDs |
| `find_by_action({ action, limit? })` | Tìm theo interaction: `click` `submit` `fill` `check` `navigate` |
| `find_similar_components({ component, limit? })` | Tìm component tương tự |

### Phân tích trang

| Tool | Khi nào dùng |
|------|-------------|
| `get_test_plan({ page })` | **One-shot**: route + flow + elements + Playwright snippet |
| `get_user_flow({ page })` | Components và test IDs của một route |
| `explain_page_structure({ route })` | Audit test coverage của một route |

### Generate test

| Tool | Khi nào dùng |
|------|-------------|
| `generate_playwright_test({ component, route? })` | Tạo file `.spec.ts` sẵn sàng chạy |
| `generate_test_context({ component })` | Chỉ lấy Playwright locators |

### `get_test_plan` — Tool quan trọng nhất

Trả về mọi thứ cần thiết trong 1 lần gọi:

```json
{
  "route": "/login",
  "all_test_ids": ["login-form", "login-email-input", "login-submit-button"],
  "elements": [
    { "testId": "login-email-input", "tag": "input", "inputType": "email",
      "placeholder": "Email", "ariaLabel": "Email address", "order": 1 },
    { "testId": "login-submit-button", "tag": "button", "text": "Sign In", "order": 3 }
  ],
  "test_flow": [
    { "step": 1, "action": "fill",  "testId": "login-email-input",    "value": "test@example.com" },
    { "step": 2, "action": "fill",  "testId": "login-password-input", "value": "TestPassword123!" },
    { "step": 3, "action": "click", "testId": "login-submit-button",  "text": "Sign In" }
  ],
  "playwright_snippet": "import { test, expect } from '@playwright/test'; ..."
}
```

`test_flow` đã sắp xếp theo thứ tự DOM — **luôn tương tác theo đúng thứ tự này**.

---

## 7. REST API

```bash
node dist/cli/index.js serve
# → Đang lắng nghe tại http://0.0.0.0:8000
```

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/health` | Kiểm tra server |
| GET | `/stats` | Thống kê index |
| GET | `/search/components?q=QUERY` | Tìm kiếm component |
| GET | `/search/test-ids?q=QUERY` | Tìm test IDs |
| GET | `/flow/:page` | User flow của một trang |
| GET | `/test-ids` | Tất cả test IDs |

---

## 8. Cấu hình

Copy `.env.example` thành `.env` và điều chỉnh:

```bash
# Đường dẫn database
TESTEX_DB_PATH=.testex/db

# Model embedding (phải khớp với model đã tải về)
TESTEX_EMBEDDING_MODEL=Xenova/bge-small-en-v1.5
TESTEX_EMBEDDING_DIM=384

# Extensions file sẽ được index
TESTEX_INDEX_EXTENSIONS=[".tsx",".jsx",".ts",".js",".vue",".svelte",".html"]

# Thư mục bỏ qua khi scan
TESTEX_EXCLUDE_DIRS=["node_modules",".git","dist","build",".next","coverage"]

# Thuộc tính test ID bổ sung (data-test và data-testid luôn được include)
TESTEX_DATA_TEST_ATTRS=["data-test","data-testid","data-cy","data-e2e"]

# Số kết quả tìm kiếm mặc định
TESTEX_SEARCH_LIMIT=10

# REST API
TESTEX_API_HOST=0.0.0.0
TESTEX_API_PORT=8000
```

---

## 9. File ví dụ

Repo đi kèm các **file ví dụ** sẵn sàng dùng. Chúng **không bắt buộc** —
copy phần bạn cần và xóa phần còn lại.

> ⚠️ **Đây là file ví dụ (starter files), không phải code chạy production.**
> Hãy đọc, chỉnh sửa cho phù hợp với dự án của bạn trước khi dùng.

---

### `examples/playwright-agent.ts` — Script tự động generate test

Script chạy độc lập, query testex index và ghi một file Playwright spec cho mỗi trang.

```bash
# Generate test cho toàn bộ project
npx tsx examples/playwright-agent.ts --out tests/e2e

# Xem kết quả trước khi ghi file
npx tsx examples/playwright-agent.ts --dry-run

# Generate cho 1 trang cụ thể
npx tsx examples/playwright-agent.ts --page LoginForm --out tests/e2e
```

Mỗi spec được generate gồm 3 test case:
1. **Happy path** — điền form theo đúng thứ tự DOM với giá trị thực
2. **Visibility smoke** — assert từng test ID phải visible
3. **Validation negative** — submit rỗng, expect ở lại trang hiện tại

**Cách script hoạt động** (tương ứng với MCP tools):

```
list_pages()          →  Discover tất cả routes
get_test_plan(page)   →  Lấy flow + elements cho mỗi trang
generatePlaywrightSnippet()  →  Tạo nội dung spec
writeFileSync()       →  Ghi ra tests/e2e/
```

---

### `examples/generated/login-form.spec.ts` — Ví dụ output

File spec đã được generate sẵn, dùng để tham khảo cấu trúc output.
Không cần chạy agent mới xem được kết quả trông như thế nào.

---

### `skills/testex-skill.md` — MCP skill reference cho agents

Tài liệu tham chiếu toàn diện mô tả 13 MCP tools, decision tree, và các
pattern hay dùng. AI agent có thể đọc file này để biết cách dùng testex
mà không cần hướng dẫn thêm.

```
→ Được dùng bởi: agents/playwright-writer.md (tham chiếu tường minh)
```

**Nội dung:**
- Catalog 13 tools với params, return shape, rule
- Decision tree: task → tool nào
- 4 pattern phổ biến
- Bảng confidence levels
- Error handling

---

### `agents/playwright-writer.md` — Agent viết Playwright test

Định nghĩa Claude Code agent. Khi được invoke, agent sẽ:
1. Gọi `index_stats` — xác nhận index tồn tại
2. Gọi `get_test_plan` — lấy thông tin trang cần test
3. Generate spec với 3 test case theo quy tắc trong skill
4. Ghi ra `tests/e2e/<tên>.spec.ts`

**Cách dùng:** Copy vào `.claude/agents/` trong dự án của bạn, sau đó:
```
Use the playwright-writer agent to write tests for LoginForm.
```

---

### `agents/testex-explorer.md` — Agent khám phá codebase

Claude Code agent trả lời câu hỏi mở về UI của dự án thông qua testex MCP.
Không cần skill reference — tự suy luận từ mô tả của từng MCP tool.

Ví dụ câu hỏi agent xử lý được:
- *"Dự án này có những trang nào?"*
- *"Trang login đã có đủ test ID chưa?"*
- *"Tìm tất cả nút submit"*
- *"LoginForm và RegisterForm có gì giống nhau?"*
- *"Test ID 'checkout-submit-btn' nằm ở component nào?"*

**Cách dùng:** Copy vào `.claude/agents/` trong dự án của bạn.

---

### `.claude/commands/write-tests.md` — Slash command `/write-tests`

Định nghĩa Claude Code slash command. Gõ `/write-tests` trong Claude Code,
nó sẽ tự động gọi `list_pages → get_test_plan → generate_playwright_test`
và ghi file spec.

---

## 10. Kiến trúc

```
src/
├── config.ts                    Đọc env vars, export config object
├── schema/models.ts             ComponentRecord, ElementInfo, TestStep
│                                deriveTestFlow(), generatePlaywrightSnippet()
├── parser/
│   ├── base.ts                  Dùng chung: makeId, extractStaticTestIds,
│   │                            extractElementInfos
│   ├── react-parser.ts          Dispatcher theo extension + React parser
│   ├── vue-parser.ts            Vue SFC parser
│   ├── svelte-parser.ts         Svelte parser
│   ├── html-parser.ts           Angular/HTML parser
│   └── normalizer.ts            Dedup components
├── embeddings/pipeline.ts       ONNX qua @xenova/transformers (offline)
├── vectorstore/lancedb-store.ts LanceDB: upsert, search, listPages, findByAction
├── cli/
│   ├── index.ts                 Commander entry point
│   └── commands.ts              index, search, test-context, stats, watch
├── mcp/server.ts                13 MCP tools
└── api/server.ts                Fastify REST API
```

### Luồng dữ liệu

```
parseFile(path)
  → ComponentRecord {
      dataTestIds[],
      elements[{ testId, tag, inputType, text, placeholder, order }],
      userActions[],
      route,
      framework
    }
  → toEmbedText()   (IDs + tokens + button texts + placeholders → 1 string)
  → embed(text)     → float32[384]
  → LanceDB.upsert()

search(query)
  → embed(query)    → float32[384]
  → LanceDB.search() → SearchResult[] { score, confidence, matchType }
```

### Frameworks được hỗ trợ

| Framework | Extensions | Parser |
|-----------|-----------|--------|
| React / JSX | `.tsx` `.jsx` | `react-parser.ts` |
| Vue | `.vue` | `vue-parser.ts` |
| Svelte | `.svelte` | `svelte-parser.ts` |
| Angular / HTML | `.html` | `html-parser.ts` |
