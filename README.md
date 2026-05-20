# testex

> Local-first AI index for `data-test` IDs and UI components.
> Works with React, Vue, Svelte, and Angular. 100% offline.

```
Source Code → Parser → ONNX Embeddings → LanceDB → MCP · REST · CLI
```

No cloud API. No Docker. ONNX model bundled (~32 MB). Runs on `npm install`.

---

## Quick start

```bash
git clone https://github.com/chuga2310/testex
cd testex
npm install                                    # builds + model ready

node dist/cli/index.js index /path/to/src      # index your project
node dist/cli/index.js search "login form"     # semantic search
node dist/cli/index.js stats                   # confirm index
```

---

## MCP integration

testex works as an MCP server with **Claude Code**, **GitHub Copilot**, and **Cursor**.

### Claude Code / Cursor

Add to your project's `.mcp.json`:

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

### GitHub Copilot (VS Code 1.102+)

Add to `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "testex": {
      "command": "node",
      "args": ["/absolute/path/to/testex/dist/cli/index.js", "mcp"]
    }
  }
}
```

Open **Copilot Chat → Agent mode** to use the tools.
Commit `.vscode/mcp.json` to share the config with your team.

---

**13 MCP tools** — `get_test_plan`, `generate_playwright_test`, `list_pages`,
`find_by_action`, `search_components`, `search_test_ids`, `search_multi`,
`search_must`, `get_user_flow`, `find_similar_components`,
`explain_page_structure`, `list_all_test_ids`, `index_stats`.

---

## CLI reference

```bash
# Indexing
node dist/cli/index.js index <path>             # index project
node dist/cli/index.js index <path> --reset     # drop + re-index
node dist/cli/index.js watch <path>             # live re-index on save

# Search
node dist/cli/index.js search "query"                     # semantic
node dist/cli/index.js search "id" --test-ids             # exact substring
node dist/cli/index.js search login --union checkout      # multi-keyword
node dist/cli/index.js search email --must password       # AND filter

# Inspect
node dist/cli/index.js test-context <component>  # Playwright locators
node dist/cli/index.js stats                     # index stats

# Servers
node dist/cli/index.js mcp                       # MCP server (stdio)
node dist/cli/index.js serve                     # REST API :8000
```

---

## Supported frameworks

| Framework | Extensions |
|-----------|-----------|
| React / JSX | `.tsx` `.jsx` `.ts` `.js` |
| Vue | `.vue` |
| Svelte | `.svelte` |
| Angular / HTML | `.html` |

---

## Example files

The following files are **starter examples** — copy, adapt, or delete them:

| File / Folder | What it is |
|---|---|
| `examples/playwright-agent.ts` | Script that auto-generates Playwright specs from the index |
| `examples/generated/login-form.spec.ts` | Sample generated spec |
| `skills/testex-skill.md` | MCP skill reference for AI agents |
| `agents/playwright-writer.md` | Agent definition: writes Playwright tests using the skill |
| `agents/testex-explorer.md` | Agent definition: explores the codebase via MCP |
| `.claude/commands/write-tests.md` | `/write-tests` slash command for Claude Code |

---

## Docs

- [English guide](docs/en/guide.md)
- [Hướng dẫn tiếng Việt](docs/vi/guide.md)

---

## License

MIT
