# Skill: testex MCP — AI Index for Test IDs & UI Components

## Purpose

testex is a **100% local** MCP server that provides a vector index for all
`data-test` IDs and UI components in the project (React, Vue, Svelte, Angular).

Agents use this skill to:
- Find correct `data-testid` without reading source code
- Understand page structure before writing tests
- Generate accurate Playwright test specs in correct order

---

## Prerequisites

Before calling any tool, confirm the index exists:

```
→ index_stats()
← { total_components: 42, total_test_ids: 187 }
```

If `total_components = 0` → ask user to run:
```bash
testex index <path-to-src>
```

---

## Tool Catalog

### 1. `list_pages`
**When to use:** First step when unsure what's in the project.

```
list_pages({ limit?: number })
→ [{ name, route, file, test_ids_count, test_ids, framework }]
```

**Rule:** Always call `list_pages` before writing tests for a new page.

---

### 2. `get_test_plan`
**When to use:** Need full info to write tests for 1 page. **Most important tool.**

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

**Rule:** `test_flow` is already ordered by DOM — use this exact order when filling forms.

**Example `test_flow`:**
```json
[
  { "step": 1, "action": "fill",  "testId": "login-email-input",    "value": "test@example.com" },
  { "step": 2, "action": "fill",  "testId": "login-password-input", "value": "TestPassword123!" },
  { "step": 3, "action": "click", "testId": "login-submit-button",  "text": "Sign In" }
]
```

---

### 3. `generate_playwright_test`
**When to use:** Need ready-to-copy Playwright spec.

```
generate_playwright_test({ component: string, route?: string })
→ { component, file, route, confidence, test_flow, playwright_test }
```

**Rule:** Confidence `low` → verify file path before using.

---

### 4. `search_components`
**When to use:** Find component by natural language.

```
search_components({ query: string, limit?: number })
→ [{ name, file, route, data_test_ids, confidence, score }]
```

**Examples:** `"login form"`, `"submit payment button"`, `"country dropdown"`

---

### 5. `search_test_ids`
**When to use:** Find component containing a specific test ID. Try exact match first, fallback semantic.

```
search_test_ids({ query: string, limit?: number, exact?: boolean })
→ [{ component, file, test_ids, match_type, confidence }]
```

---

### 6. `search_multi`
**When to use:** Find multiple **unrelated** keywords at once.

```
search_multi({ keywords: string[], limit?: number })
→ [{ name, file, route, data_test_ids, confidence }]
```

**Example:** `keywords: ["login form", "checkout page"]` — embed each keyword separately, merge results.

---

### 7. `search_must`
**When to use:** Find component that **must contain ALL** specified test IDs.

```
search_must({ test_ids: string[], limit?: number })
→ [{ name, file, route, data_test_ids }]
```

**Example:** Verify LoginForm has both `email-input` and `password-input` and `submit-button`.

---

### 8. `find_by_action`
**When to use:** Find all components with a specific interaction type.

```
find_by_action({ action: "click"|"submit"|"fill"|"check"|"navigate", limit?: number })
→ [{ name, route, file, data_test_ids, elements }]
```

**Example:** `find_by_action("submit")` → find all forms in the project.

---

### 9. `get_user_flow`
**When to use:** Get list of components + test IDs for a route.

```
get_user_flow({ page: string })
→ { page, components: [{ name, route, test_ids, actions }] }
```

---

### 10. `explain_page_structure`
**When to use:** Audit test coverage for a route.

```
explain_page_structure({ route: string })
→ { components, total_test_ids, test_ids, available_actions, test_coverage }
```

`test_coverage: "good"` = has > 3 test IDs. `"needs_improvement"` = missing coverage.

---

### 11. `find_similar_components`
**When to use:** Find similar component to reuse test pattern.

```
find_similar_components({ component: string, limit?: number })
→ [{ name, file, test_ids, similarity, confidence }]
```

---

### 12. `list_all_test_ids`
**When to use:** List all test IDs in project (paginated).

```
list_all_test_ids({ limit?: number, offset?: number })
→ { total, offset, limit, ids: string[] }
```

**Rule:** Default `limit=200`. Use `offset` for next page.

---

### 13. `index_stats`
**When to use:** Quick check if project has been indexed.

```
index_stats()
→ { total_components, total_test_ids, db_path, embedding_model }
```

---

## Decision Tree

```
Task?
│
├─ "Write test for page X"
│   └─ list_pages → get_test_plan(X) → generate_playwright_test(X)
│
├─ "Find test ID of component Y"
│   └─ search_test_ids(Y) or search_components(Y)
│
├─ "What pages are in the project?"
│   └─ list_pages()
│
├─ "Does this component have enough test IDs?"
│   └─ explain_page_structure(route)
│
├─ "Find all forms in the project"
│   └─ find_by_action("submit")
│
├─ "Are components X and Y on the same page?"
│   └─ search_must({ test_ids: [X, Y] })
│
└─ "Write tests for entire project"
    └─ list_pages → loop: get_test_plan → generate_playwright_test
```

---

## Confidence Levels

| Level  | Icon | Score range | Meaning |
|--------|------|-------------|---------|
| high   | ●    | < 0.4       | Accurate result, use immediately |
| medium | ◑    | 0.4–0.8     | Likely correct, should verify file path |
| low    | ○    | > 0.8       | Ambiguous, needs manual review |

---

## Patterns

### Pattern 1: Write test for 1 page
```
1. get_test_plan("LoginPage")
2. Read test_flow → write exactly in step order
3. Add 3 test cases: happy path, smoke visibility, negative validation
4. Write to tests/e2e/login-page.spec.ts
```

### Pattern 2: Find and use test ID with unknown name
```
1. search_test_ids("email field on login") → get test ID
2. search_test_ids("submit button") → get test ID
3. search_must({ test_ids: [...] }) → confirm same component
```

### Pattern 3: Audit coverage before writing tests
```
1. list_pages → get all routes
2. explain_page_structure(route) for each page
3. Prioritize pages with test_coverage: "needs_improvement"
```

### Pattern 4: Generate tests for entire project
```
1. list_pages({ limit: 100 })
2. For each page: get_test_plan(page.name)
3. generate_playwright_test(page.name) → write file
```

---

## Error Handling

| Situation | Action |
|---|---|
| Tool returns `{ error: "..." }` | Read message, inform user, stop |
| `total_components = 0` | Guide user to run `testex index` |
| Confidence `low` | Add note in test file, leave TODO |
| `playwright_snippet` empty | Fallback to `search_components` + create locators manually |
| Route missing `/` prefix | Tool adds it automatically, no worries |
