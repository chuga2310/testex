export interface ElementInfo {
  testId:       string;
  tag:          string;        // input | button | a | select | textarea | form | div …
  inputType?:   string;        // email | password | text | checkbox | submit …
  text?:        string;        // visible button/link text
  placeholder?: string;        // input placeholder
  ariaLabel?:   string;        // aria-label value
  order:        number;        // position in component (for test-flow ordering)
}

export interface TestStep {
  step:       number;
  action:     "fill" | "click" | "check" | "selectOption" | "navigate";
  testId:     string;
  inputType?: string;
  text?:      string;          // button label / link text
  hint?:      string;          // "use a valid email address"
  value?:     string;          // suggested test value
}

export interface ComponentRecord {
  id:          string;
  type:        string;
  framework:   string;
  name:        string;
  route:       string | null;
  file:        string;
  dataTestIds: string[];
  ariaLabels:  string[];
  relatedApi:  string[];
  children:    string[];
  userActions: string[];
  elements:    ElementInfo[];   // structured per-element metadata
  rawText:     string;
}

export interface SearchResult {
  record:     ComponentRecord;
  score:      number;
  confidence: "high" | "medium" | "low";   // based on vector distance
  matchType:  "exact" | "semantic";
}

// ── normalizeId ───────────────────────────────────────────────────────────────
export function normalizeId(id: string): string {
  return id
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// ── toEmbedText ───────────────────────────────────────────────────────────────
export function toEmbedText(record: ComponentRecord): string {
  const parts: string[] = [`Component: ${record.name}`];
  if (record.route) parts.push(`Route: ${record.route}`);

  if (record.dataTestIds.length) {
    parts.push(`Test IDs: ${record.dataTestIds.join(", ")}`);
    parts.push(`Tokens: ${record.dataTestIds.map(normalizeId).join(", ")}`);
  }

  // Element-level detail improves semantic recall significantly
  const buttonTexts = record.elements
    .filter(e => e.text && (e.tag === "button" || e.tag === "a"))
    .map(e => e.text as string);
  if (buttonTexts.length) parts.push(`Button texts: ${buttonTexts.join(", ")}`);

  const placeholders = record.elements
    .filter(e => e.placeholder)
    .map(e => e.placeholder as string);
  if (placeholders.length) parts.push(`Placeholders: ${placeholders.join(", ")}`);

  if (record.ariaLabels.length)
    parts.push(`Aria labels: ${record.ariaLabels.join(", ")}`);
  if (record.userActions.length)
    parts.push(`Actions: ${record.userActions.join(", ")}`);
  if (record.rawText)
    parts.push(record.rawText.slice(0, 400));

  return parts.join(" | ");
}

// ── confidence ────────────────────────────────────────────────────────────────
export function scoreToConfidence(
  distance: number
): "high" | "medium" | "low" {
  if (distance < 0.4) return "high";
  if (distance < 0.8) return "medium";
  return "low";
}

// ── deriveTestFlow ─────────────────────────────────────────────────────────────
export function deriveTestFlow(elements: ElementInfo[]): TestStep[] {
  const steps: TestStep[] = [];
  const sorted = [...elements].sort((a, b) => a.order - b.order);

  for (const el of sorted) {
    const t = el.tag;
    const it = el.inputType?.toLowerCase();

    if (t === "form") continue;                        // containers, skip

    if (t === "input" || t === "textarea") {
      if (it === "submit" || it === "button" || it === "reset") {
        steps.push({
          step: steps.length + 1,
          action: "click",
          testId: el.testId,
          text: el.ariaLabel,
          hint: "submit the form",
        });
      } else if (it === "checkbox" || it === "radio") {
        steps.push({
          step: steps.length + 1,
          action: "check",
          testId: el.testId,
          inputType: it,
          hint: `check the ${it}`,
        });
      } else {
        steps.push({
          step: steps.length + 1,
          action: "fill",
          testId: el.testId,
          inputType: it,
          text: el.placeholder ?? el.ariaLabel,
          hint: getInputHint(it),
          value: getTestValue(it),
        });
      }
    } else if (t === "select") {
      steps.push({
        step: steps.length + 1,
        action: "selectOption",
        testId: el.testId,
        hint: "choose an option",
      });
    } else if (t === "button") {
      steps.push({
        step: steps.length + 1,
        action: "click",
        testId: el.testId,
        text: el.text,
        hint: el.text ? `click "${el.text}"` : "click the button",
      });
    } else if (t === "a") {
      steps.push({
        step: steps.length + 1,
        action: "navigate",
        testId: el.testId,
        text: el.text,
        hint: `navigate via "${el.text ?? el.testId}"`,
      });
    }
    // div / span / label / other containers → skip
  }

  return steps;
}

function getTestValue(inputType?: string): string {
  switch (inputType) {
    case "email":    return "test@example.com";
    case "password": return "TestPassword123!";
    case "number":   return "42";
    case "tel":      return "+1234567890";
    case "url":      return "https://example.com";
    case "date":     return "2024-01-01";
    case "search":   return "search term";
    default:         return "test value";
  }
}

function getInputHint(inputType?: string): string {
  switch (inputType) {
    case "email":    return "use a valid email address";
    case "password": return "use a secure password (8+ chars)";
    case "number":   return "use a numeric value";
    case "date":     return "use YYYY-MM-DD format";
    case "search":   return "enter a search query";
    default:         return "enter a test value";
  }
}

// ── generatePlaywrightSnippet ─────────────────────────────────────────────────
export function generatePlaywrightSnippet(record: ComponentRecord): string {
  const flow = deriveTestFlow(record.elements);
  const lines: string[] = [];

  lines.push(`import { test, expect } from '@playwright/test';`);
  lines.push(``);
  lines.push(`test.describe('${record.name}', () => {`);
  lines.push(`  test('happy path', async ({ page }) => {`);

  if (record.route) {
    lines.push(`    await page.goto('${record.route}');`);
  }

  for (const step of flow) {
    switch (step.action) {
      case "fill":
        lines.push(
          `    await page.getByTestId('${step.testId}').fill('${step.value ?? "test value"}');` +
          (step.hint ? `  // ${step.hint}` : "")
        );
        break;
      case "check":
        lines.push(`    await page.getByTestId('${step.testId}').check();`);
        break;
      case "selectOption":
        lines.push(
          `    await page.getByTestId('${step.testId}').selectOption('value');  // choose an option`
        );
        break;
      case "click":
        lines.push(`    await page.getByTestId('${step.testId}').click();` +
          (step.text ? `  // ${step.text}` : ""));
        break;
      case "navigate":
        lines.push(
          `    // await page.getByTestId('${step.testId}').click();  // navigates: ${step.text ?? step.testId}`
        );
        break;
    }
  }

  // Auto-assertions for visible elements
  if (record.dataTestIds.length) {
    lines.push(``);
    lines.push(`    // Assertions`);
    const mainId = record.dataTestIds[0];
    lines.push(`    await expect(page.getByTestId('${mainId}')).toBeVisible();`);
  }

  lines.push(`  });`);
  lines.push(`});`);
  return lines.join("\n");
}
