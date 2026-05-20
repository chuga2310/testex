# testex

Local-first AI indexing for `data-test` attributes and React UI components.

Indexes your React/TSX/JSX source code — extracts `data-test` IDs, component structure, routes, and user flows — then exposes them via MCP, REST API, and CLI for use with Claude Code, Cursor, and custom agents.

```
Source Code → Parser → ONNX Embeddings → Vector DB → MCP / API / CLI
```

**100% local after `npm install`.** No cloud API. No Docker. Model bundled in `./models/`.

---

## Quick Start

```bash
git clone https://github.com/cuonglm/testex
cd testex
npm install          # builds TypeScript + downloads ~23 MB ONNX model

node dist/cli/index.js index /path/to/your/react-project
node dist/cli/index.js search "login submit button"
node dist/cli/index.js test-context LoginForm
```

Or use `npx` without cloning:
```bash
npx testex index ./src
npx testex search "checkout button"
```

---

## Features

- **Semantic search** over components, pages, and test IDs
- **Dynamic expression resolver** — understands helper functions like `section()`, `button()`, `text()`
- **Playwright locator generation** — ready-to-use `getByTestId` snippets
- **MCP server** — plug directly into Claude Code, Cursor, and any MCP-compatible tool
- **REST API** — language-agnostic HTTP access
- **Incremental watch** — re-index on save
- **100% offline** — ONNX model stored locally, no network calls after install

---

## Stack

| Layer | Technology |
|---|---|
| Parser | Regex (TypeScript, zero deps) |
| Embeddings | `@xenova/transformers` — ONNX, runs locally |
| Model | `Xenova/bge-small-en-v1.5` (~23 MB, bundled) |
| Vector DB | `@lancedb/lancedb` (embedded, no Docker) |
| CLI | Commander |
| MCP | `@modelcontextprotocol/sdk` |
| API | Fastify |

---

## CLI Reference

```bash
node dist/cli/index.js index <path>            # Scan and index
node dist/cli/index.js index <path> --reset    # Drop and re-index
node dist/cli/index.js search "query"          # Semantic search
node dist/cli/index.js search "id" --test-ids  # Search test IDs only
node dist/cli/index.js test-context <name>     # Playwright locators
node dist/cli/index.js stats                   # Index statistics
node dist/cli/index.js watch <path>            # Incremental watch
node dist/cli/index.js mcp                     # Start MCP server
node dist/cli/index.js serve                   # Start REST API
```

---

## MCP Integration (Claude Code / Cursor)

After `npm install`, add to your project's `.mcp.json`:

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

Then ask Claude:
> "Find Playwright locators for the checkout submit button"
> "What test IDs are on the login page?"

### Available MCP Tools

| Tool | Description |
|---|---|
| `search_components(query)` | Find components by description |
| `search_test_ids(query)` | Find data-test IDs |
| `get_user_flow(page)` | All test IDs for a page/route |
| `generate_test_context(component)` | Playwright locators |
| `find_similar_components(component)` | Semantic similarity |
| `explain_page_structure(route)` | Page structure overview |
| `list_all_test_ids()` | All indexed IDs |
| `index_stats()` | Index statistics |

---

## REST API

```bash
node dist/cli/index.js serve
# → http://localhost:8000
```

| Endpoint | Description |
|---|---|
| `GET /health` | Health check |
| `GET /stats` | Index statistics |
| `GET /search/components?q=QUERY` | Search components |
| `GET /search/test-ids?q=QUERY` | Search test IDs |
| `GET /flow/:page` | User flow for page |
| `GET /test-ids` | All test IDs |

---

## Configuration

Environment variables (prefix `TESTEX_`, or `.env` file):

```bash
TESTEX_DB_PATH=.testex/db
TESTEX_EMBEDDING_MODEL=Xenova/bge-small-en-v1.5
TESTEX_INDEX_EXTENSIONS=[".tsx",".jsx",".ts",".js"]
TESTEX_SEARCH_LIMIT=10
```

See `.env.example` for all options.

---

## Architecture

```
src/
├── config.ts            Settings (env vars + defaults)
├── schema/models.ts     ComponentRecord type + helpers
├── parser/
│   ├── react-parser.ts  Regex-based TSX/JSX parser
│   └── normalizer.ts    Deduplication
├── embeddings/pipeline.ts  ONNX embeddings via @xenova/transformers
├── vectorstore/
│   └── lancedb-store.ts LanceDB vector store
├── cli/
│   ├── index.ts         Commander entry point
│   └── commands.ts      index, search, stats, watch, test-context
├── mcp/server.ts        MCP server (8 tools)
└── api/server.ts        Fastify REST API
```

---

## License

MIT
