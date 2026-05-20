# testex — Complete Guide

## Table of contents

1. [What is testex?](#1-what-is-testex)
2. [Installation](#2-installation)
3. [Indexing your project](#3-indexing-your-project)
4. [CLI reference](#4-cli-reference)
5. [MCP integration](#5-mcp-integration)
6. [MCP tool reference](#6-mcp-tool-reference)
7. [REST API](#7-rest-api)
8. [Configuration](#8-configuration)
9. [Example files](#9-example-files)
10. [Architecture](#10-architecture)

---

## 1. What is testex?

testex builds a **local vector index** of every UI component in your project,
extracting:

- `data-test`, `data-testid`, `data-cy`, `data-e2e` attributes
- Structured element metadata (tag, input type, button text, placeholder, aria-label)
- Page routes, user interactions, and component hierarchy

The index is exposed through three interfaces:

| Interface | Use case |
|-----------|---------|
| **MCP server** | Claude Code, Cursor, or any MCP-compatible agent |
| **CLI** | Terminal searches and scripting |
| **REST API** | Language-agnostic HTTP access |

**Fully offline** — the ONNX embedding model (~32 MB) is bundled in `./models/`.
No network call is made after `npm install`.

---

## 2. Installation

```bash
git clone https://github.com/YOUR_USERNAME/testex
cd testex
npm install
```

`npm install` runs two steps automatically:
1. Compiles TypeScript → `dist/`
2. Downloads the ONNX model into `./models/` (once, ~32 MB)

Verify the setup:
```bash
node dist/cli/index.js --version
```

---

## 3. Indexing your project

### Basic index

```bash
node dist/cli/index.js index /path/to/your/src
```

testex walks the directory and parses every `.tsx`, `.jsx`, `.ts`, `.js`,
`.vue`, `.svelte`, and `.html` file.

### Re-index after changes

```bash
node dist/cli/index.js index /path/to/src --reset   # drop + rebuild
```

### Live watch (auto re-index on save)

```bash
node dist/cli/index.js watch /path/to/src
```

### Verify

```bash
node dist/cli/index.js stats
# → Total components : 48
# → Total test IDs   : 213
```

---

## 4. CLI reference

### `search`

```bash
# Semantic search (natural language)
node dist/cli/index.js search "login submit button"
node dist/cli/index.js search "form đăng nhập"

# Exact substring match on test IDs
node dist/cli/index.js search "login-btn" --test-ids

# Union search — embed each keyword separately, merge best scores
# Use when keywords are unrelated
node dist/cli/index.js search login --union checkout --union register

# AND filter — only components containing ALL test IDs
node dist/cli/index.js search email --must password --must submit

# Limit results
node dist/cli/index.js search "button" --limit 20
```

Search output shows a **confidence column**:

```
#   Component         Route    Test IDs                    Conf.     Score
────────────────────────────────────────────────────────────────────────────
1   LoginForm         /login   login-form, login-email-…  ● high    0.182
2   CheckoutForm      /cart    checkout-email, …          ◑ medium  0.521
```

| Icon | Level | Meaning |
|------|-------|---------|
| ●    | high  | Reliable — use directly |
| ◑    | medium | Likely correct — verify file path |
| ○    | low   | Uncertain — check manually |

### `test-context`

Generate Playwright locators for a component:

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
```

### `stats`

```bash
node dist/cli/index.js stats
```

### `watch`

```bash
node dist/cli/index.js watch ./src   # re-indexes changed files on save
```

### `serve` / `mcp`

```bash
node dist/cli/index.js serve          # REST API on :8000
node dist/cli/index.js mcp            # MCP server over stdio
```

---

## 5. MCP integration

### With Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "testex": {
      "command": "node",
      "args": ["/absolute/path/to/testex/dist/cli/index.js", "mcp"]
    }
  }
}
```

Restart Claude Code. Confirm with:
```
/mcp
```

Example prompts:
- *"What test IDs are on the login page?"*
- *"Generate a Playwright test for CheckoutPage"*
- *"Find all form submit buttons in the project"*
- *"Is the login page well covered?"*

### With Cursor

Add to Cursor's MCP settings (same `command` + `args` format).

---

## 6. MCP tool reference

### Discovery

| Tool | When to use |
|------|------------|
| `index_stats()` | Verify index exists before any other call |
| `list_pages({ limit? })` | First step — see all routes in the project |
| `list_all_test_ids({ limit?, offset? })` | Browse all test IDs (paginated, default 200) |

### Search

| Tool | When to use |
|------|------------|
| `search_components({ query, limit? })` | Natural language component search |
| `search_test_ids({ query, exact?, limit? })` | Find by test ID substring or semantic |
| `search_multi({ keywords[], limit? })` | Multiple unrelated keywords, best-score merge |
| `search_must({ test_ids[], limit? })` | AND filter — all IDs must be present |
| `find_by_action({ action, limit? })` | Find by interaction: `click` `submit` `fill` `check` `navigate` |
| `find_similar_components({ component, limit? })` | Semantic similarity search |

### Page analysis

| Tool | When to use |
|------|------------|
| `get_test_plan({ page })` | **One-shot**: route + ordered flow + all elements + Playwright snippet |
| `get_user_flow({ page })` | Components and test IDs for a route |
| `explain_page_structure({ route })` | Coverage audit for a route |

### Test generation

| Tool | When to use |
|------|------------|
| `generate_playwright_test({ component, route? })` | Ready-to-run `.spec.ts` content |
| `generate_test_context({ component })` | Playwright locators only |

### `get_test_plan` — most important tool

Returns everything an agent needs in a single call:

```json
{
  "route": "/login",
  "all_test_ids": ["login-form", "login-email-input", "login-submit-button"],
  "elements": [
    { "testId": "login-email-input", "tag": "input",  "inputType": "email",
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

`test_flow` is sorted by DOM order — always interact in this sequence.

---

## 7. REST API

```bash
node dist/cli/index.js serve
# → Listening on http://0.0.0.0:8000
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/stats` | Index statistics |
| GET | `/search/components?q=QUERY` | Semantic component search |
| GET | `/search/test-ids?q=QUERY` | Test ID search |
| GET | `/flow/:page` | User flow for a page |
| GET | `/test-ids` | All indexed test IDs |

---

## 8. Configuration

Copy `.env.example` to `.env` and adjust:

```bash
# Database location
TESTEX_DB_PATH=.testex/db

# Embedding model (must match bundled model)
TESTEX_EMBEDDING_MODEL=Xenova/bge-small-en-v1.5
TESTEX_EMBEDDING_DIM=384

# File extensions to index
TESTEX_INDEX_EXTENSIONS=[".tsx",".jsx",".ts",".js",".vue",".svelte",".html"]

# Directories to skip
TESTEX_EXCLUDE_DIRS=["node_modules",".git","dist","build",".next","coverage"]

# Extra test-ID attributes (data-test and data-testid are always included)
TESTEX_DATA_TEST_ATTRS=["data-test","data-testid","data-cy","data-e2e"]

# Search result limit
TESTEX_SEARCH_LIMIT=10

# REST API
TESTEX_API_HOST=0.0.0.0
TESTEX_API_PORT=8000
```

---

## 9. Example files

The repo includes ready-to-use **example files**. They are not required —
copy what you need and delete the rest.

### `examples/playwright-agent.ts` — Standalone generator script

Queries the testex index and writes one Playwright spec per page.

```bash
# Generate specs for all indexed pages
npx tsx examples/playwright-agent.ts --out tests/e2e

# Preview without writing files
npx tsx examples/playwright-agent.ts --dry-run

# Generate for one page only
npx tsx examples/playwright-agent.ts --page LoginForm --out tests/e2e
```

Each generated spec includes three test cases:
1. **Happy path** — fills form fields in DOM order with realistic values
2. **Visibility smoke** — asserts each test ID is visible
3. **Validation negative** — submits empty form, expects to stay on same page

### `examples/generated/login-form.spec.ts` — Sample output

Pre-generated example showing what `playwright-agent.ts` produces.
Useful as a reference when writing tests manually.

### `skills/testex-skill.md` — MCP skill reference for agents

A comprehensive reference document describing all 13 MCP tools, a decision
tree, and common patterns. An AI agent can read this file to understand
how to use testex without prior knowledge.

```
→ Used by: agents/playwright-writer.md (explicit skill reference)
```

### `agents/playwright-writer.md` — Test-writing agent

A Claude Code agent definition. When invoked, it:
1. Calls `index_stats` to verify the index
2. Calls `get_test_plan` for the requested page
3. Generates a 3-test-case spec following the skill's rules
4. Writes to `tests/e2e/<name>.spec.ts`

**To use it**, copy to `.claude/agents/playwright-writer.md` in your
project (or the testex repo itself), then invoke via Claude Code:
```
Use the playwright-writer agent to write tests for LoginForm.
```

### `agents/testex-explorer.md` — Exploration agent

A Claude Code agent that answers open-ended questions about your codebase
using testex MCP. No skill reference needed — it reasons from MCP tool
descriptions directly.

Example questions it handles:
- *"What pages does this project have?"*
- *"Is the login page well covered?"*
- *"Find all form submit buttons"*
- *"What's the difference between LoginForm and RegisterForm?"*

**To use it**, copy to `.claude/agents/testex-explorer.md` in your project.

### `.claude/commands/write-tests.md` — `/write-tests` slash command

Defines a Claude Code slash command. Type `/write-tests` in Claude Code
and it will automatically call `list_pages → get_test_plan →
generate_playwright_test` and write spec files.

---

## 10. Architecture

```
src/
├── config.ts                    Env vars + defaults
├── schema/models.ts             ComponentRecord, ElementInfo, TestStep
│                                deriveTestFlow(), generatePlaywrightSnippet()
├── parser/
│   ├── base.ts                  Shared: makeId, extractStaticTestIds,
│   │                            extractElementInfos
│   ├── react-parser.ts          JSX/TSX dispatcher + React parser
│   ├── vue-parser.ts            Vue SFC parser
│   ├── svelte-parser.ts         Svelte parser
│   ├── html-parser.ts           Angular/HTML parser
│   └── normalizer.ts            Deduplication
├── embeddings/pipeline.ts       ONNX via @xenova/transformers (offline)
├── vectorstore/lancedb-store.ts LanceDB: upsert, search, listPages, findByAction
├── cli/
│   ├── index.ts                 Commander entry
│   └── commands.ts              index, search, test-context, stats, watch
├── mcp/server.ts                13 MCP tools
└── api/server.ts                Fastify REST API
```

### Data flow

```
parseFile(path)
  → ComponentRecord { dataTestIds[], elements[], testFlow, route, ... }
  → toEmbedText()  (test IDs + tokens + button texts + placeholders)
  → embed(text)    → float32[384]
  → LanceDB.upsert()

search(query)
  → embed(query)   → float32[384]
  → LanceDB.search() → SearchResult[] { confidence, matchType }
```
