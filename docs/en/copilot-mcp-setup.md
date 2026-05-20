# Connect testex MCP to GitHub Copilot

A step-by-step guide to integrating the testex local AI index as an MCP server
inside GitHub Copilot Chat (VS Code).

---

## Prerequisites

| Requirement | Minimum version | How to check |
|---|---|---|
| VS Code | **1.102** | `Help → About` |
| GitHub Copilot extension | latest | Extensions panel |
| Node.js | 18+ | `node --version` |

> **Note:** MCP support in Copilot Chat requires VS Code 1.102 or later.
> Update VS Code if the Agent mode dropdown is not visible.

---

## Step 1 — Install testex globally

Clone and install once. `npm link` makes `testex` available as a global command
so every project can use it without absolute paths.

```bash
git clone https://github.com/chuga2310/testex
cd testex
npm install
npm link
```

`npm install` automatically:
1. Compiles TypeScript → `dist/`
2. Downloads the ONNX embedding model into `models/` (~32 MB, one-time)

Verify:

```bash
testex --version
# → 0.1.0
```

---

## Step 2 — Set up your project with one command

Run this from inside **your project** (not the testex repo):

```bash
cd /your-project
testex init
```

`testex init` does three things at once:
1. Auto-detects your source directory (`src/`, `app/`, `pages/`, or `components/`)
2. Indexes all UI components
3. Creates `.vscode/mcp.json` configured for GitHub Copilot

**Options:**
```bash
testex init --src ./frontend   # specify source directory
testex init --force            # overwrite existing .vscode/mcp.json
```

Confirm indexing succeeded:

```bash
testex stats
# → Total components : 48
# → Total test IDs   : 213
```

If `Total components` is `0`, check that your source directory contains
`.tsx`, `.vue`, `.svelte`, or `.html` files with `data-test` / `data-testid`
attributes.

---

## Step 3 — Review `.vscode/mcp.json`

`testex init` creates this file automatically. You can review or edit it:

```json
{
  "servers": {
    "testex": {
      "type": "stdio",
      "command": "testex",
      "args": ["mcp"],
      "description": "Local AI index for data-test IDs and UI components"
    }
  }
}
```

> **Copilot vs Claude Code:** Copilot uses key `"servers"` (not `"mcpServers"`).
> The `"type": "stdio"` field is optional but recommended for clarity.

---

## Step 4 — Start the MCP server

Open `.vscode/mcp.json` in VS Code. A **Start** button appears at the top of
the editor:

```
▶ Start  testex
```

Click **Start**. The status indicator turns green when the server is running.

Alternatively, the server starts automatically when you open Copilot Chat in
Agent mode (see next step).

---

## Step 5 — Switch Copilot Chat to Agent mode

1. Open Copilot Chat: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Shift+I` (macOS)
2. Click the **mode dropdown** at the bottom of the chat panel (shows "Ask" by default)
3. Select **Agent**

The testex tools are now listed under the tools icon (⚙) in the chat toolbar.
You should see entries like `search_components`, `get_test_plan`,
`generate_playwright_test`, etc.

---

## Step 6 — Verify the connection

Send this message in Agent mode:

```
How many components are indexed?
```

Copilot will call `index_stats` and return something like:

```
Total components : 48
Total test IDs   : 213
Database         : .testex/db
Model            : Xenova/bge-small-en-v1.5
```

If you see `0` components, go back to Step 2 and re-index.

---

## What you can do now

### Discover test IDs

```
What test IDs are on the login page?
```

```
Find all submit buttons in the project
```

### Generate Playwright tests

```
Generate a Playwright test spec for LoginForm
```

```
Write tests for all pages in the project
```

### Audit coverage

```
Which pages have the fewest test IDs?
```

```
Does the checkout page have good test coverage?
```

### Explore structure

```
What components are on the /profile route?
```

```
Find components similar to LoginForm
```

---

## Recommended: use the built-in agents

testex ships two agent definition files. Copy them into your project to get
specialized Copilot agents:

| File | Purpose |
|---|---|
| `agents/playwright-writer.md` | Writes complete Playwright specs from index data |
| `agents/testex-explorer.md` | Answers any question about test IDs and page structure |

Copy to your project:

```bash
mkdir -p .github/agents
cp $(npm root -g)/testex/agents/playwright-writer.md .github/agents/
cp $(npm root -g)/testex/agents/testex-explorer.md   .github/agents/
```

Then invoke by name in Copilot Chat Agent mode:

```
@playwright-writer write tests for the checkout page
```

```
@testex-explorer what actions are available on /profile?
```

---

## Keep the index up to date

Re-run indexing whenever you add or rename components:

```bash
# Full re-index
testex index ./src --reset

# Or use watch mode (auto re-indexes on file save)
testex watch ./src
```

For teams, add a re-index step to your CI pipeline or a pre-commit hook.

---

## Share config with your team

Commit `.vscode/mcp.json` to your repository. Every teammate with VS Code
1.102+ and the Copilot extension will get testex tools automatically after
cloning — as long as they also run `npm link` after installing testex.

**Recommended team setup:**

1. Each developer installs testex globally once:
   ```bash
   git clone https://github.com/chuga2310/testex && cd testex && npm install && npm link
   ```
2. Run `testex init` inside the project (creates `.vscode/mcp.json` + indexes `src/`)
3. Commit `.vscode/mcp.json`
4. Add a note in your project's `README.md`:

```markdown
## Test tooling

This project uses testex for AI-assisted test ID discovery.

Setup:
1. `git clone https://github.com/chuga2310/testex && cd testex && npm install && npm link`
2. `cd /your-project && testex init`
3. Open VS Code — testex is available in Copilot Chat Agent mode
```

---

## Troubleshooting

### "Start" button does not appear

- Ensure VS Code is 1.102 or later
- Ensure the Copilot extension is updated to the latest version
- Make sure the file is named exactly `.vscode/mcp.json` (not `mcp.json` in root)

### Agent mode is missing from the dropdown

- Update the GitHub Copilot extension
- Sign in to GitHub Copilot if not already authenticated

### `index_stats` returns 0 components

- The index is empty — run Step 2 again
- Check the path passed to `index` points to the correct source directory
- Ensure source files contain `data-test` or `data-testid` attributes

### Server shows red / failed to start

- Run `testex mcp` in a terminal to see the raw error
- Common causes: `npm link` not run, Node.js too old, `dist/` not built
- Rebuild: `cd /path/to/testex && npm run build && npm link`

### Tools appear but return errors

- The server is running but the index may be empty or at a different `TESTEX_DB_PATH`
- Set `TESTEX_DB_PATH` in a `.env` file inside the testex directory to match
  where you ran `testex index`

---

## Quick reference

```bash
# Install once (global)
git clone https://github.com/chuga2310/testex && cd testex && npm install && npm link

# Set up any project
cd /your-project
testex init         # indexes src/, creates .vscode/mcp.json

# Verify
testex stats
```

Then open VS Code → Copilot Chat → Agent mode → start asking.
