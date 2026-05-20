# Write Playwright Tests

Use the **testex MCP** to discover components and generate Playwright test specs for the current project.

## Instructions

1. Call `list_pages` to see all indexed routes. If the index is empty, tell the user to run `testex index <src-path>` first.

2. For each page (or the requested page), call `get_test_plan` to get:
   - The route to navigate to
   - Ordered `test_flow` (fill/click/check steps with test values)
   - All `elements` with tag, inputType, placeholder, text

3. Use `generate_playwright_test` as a starting point, then enrich it with:
   - A **happy path** test using values from `test_flow`
   - A **visibility smoke test** asserting each test ID is visible
   - A **negative/validation test** (empty submit, invalid input) where fill + click steps exist

4. Write the spec to `tests/e2e/<kebab-name>.spec.ts`.

5. After writing, run `npx playwright test <file>` to verify it is syntactically valid.

## Example tool sequence

```
→ list_pages()
  ← [{ name: "LoginForm", route: "/login", test_ids: [...] }, ...]

→ get_test_plan("LoginForm")
  ← { route: "/login", test_flow: [
       { step: 1, action: "fill", testId: "login-email-input", value: "test@example.com" },
       { step: 2, action: "fill", testId: "login-password-input", value: "TestPassword123!" },
       { step: 3, action: "click", testId: "login-submit-button", text: "Sign In" }
     ], playwright_snippet: "..." }

→ generate_playwright_test("LoginForm")
  ← { playwright_test: "import { test, expect } from '@playwright/test'; ..." }
```

## Output format

```typescript
import { test, expect } from '@playwright/test';

test.describe('LoginForm', () => {
  test('happy path', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill('test@example.com');
    await page.getByTestId('login-password-input').fill('TestPassword123!');
    await page.getByTestId('login-submit-button').click();
    await expect(page.getByTestId('login-form')).toBeVisible();
  });

  test('all key elements visible', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-email-input')).toBeVisible();
    await expect(page.getByTestId('login-password-input')).toBeVisible();
    await expect(page.getByTestId('login-submit-button')).toBeVisible();
  });

  test('shows validation error on empty submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-submit-button').click();
    await expect(page).toHaveURL(/\/login/);
  });
});
```

## Tips

- If a component has no route, use `find_by_action("click")` to find it in its parent page context.
- Use `search_must` with multiple test IDs to confirm a component is part of a specific page.
- Use `search_components` with natural language if you're unsure of the exact component name.
- Confidence `low` results → verify the file path before writing tests for them.
