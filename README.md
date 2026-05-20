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
# 1. Install testex globally (once)
git clone https://github.com/chuga2310/testex
cd testex && npm install && npm link

# 2. In any project — one command does everything
cd /your-react-project
testex init           # indexes src/, creates .vscode/mcp.json
```

Then open **Copilot Chat → Agent mode** and start asking:
- *"What test IDs are on the login page?"*
- *"Generate a Playwright test for CheckoutPage"*

---

## MCP integration

testex works as an MCP server with **Claude Code**, **GitHub Copilot**, and **Cursor**.

### GitHub Copilot (VS Code 1.102+)

Run `testex init` inside your project — it creates `.vscode/mcp.json` automatically
and indexes your source in one step:

```bash
testex init                  # auto-detects src/, app/, pages/
testex init --src ./frontend # specify source directory
```

Then click **Start** in the generated `.vscode/mcp.json` file, switch Copilot Chat
to **Agent mode**, and the tools are ready.
Commit `.vscode/mcp.json` to share with your team.

### Claude Code / Cursor

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "testex": {
      "command": "testex",
      "args": ["mcp"]
    }
  }
}
```

---

**13 MCP tools** — `get_test_plan`, `generate_playwright_test`, `list_pages`,
`find_by_action`, `search_components`, `search_test_ids`, `search_multi`,
`search_must`, `get_user_flow`, `find_similar_components`,
`explain_page_structure`, `list_all_test_ids`, `index_stats`.

---

## CLI reference

```bash
# Setup (run once per project)
testex init                        # auto-detect src/, create .vscode/mcp.json
testex init --src ./src            # specify source directory
testex init --force                # overwrite existing .vscode/mcp.json

# Indexing
testex index <path>                # index project
testex index <path> --reset        # drop + re-index
testex watch <path>                # live re-index on save

# Search
testex search "query"              # semantic
testex search "id" --test-ids      # exact substring
testex search login --union checkout  # multi-keyword
testex search email --must password   # AND filter

# Inspect
testex test-context <component>    # Playwright locators
testex stats                       # index stats

# Servers
testex mcp                         # MCP server (stdio)
testex serve                       # REST API :8000
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
