#!/usr/bin/env node
/**
 * testex Playwright Agent
 * ─────────────────────────────────────────────────────────────────────────────
 * Discovers every indexed page, generates a Playwright spec per page, and
 * writes them to --out (default: tests/e2e).
 *
 * Usage:
 *   npx tsx examples/playwright-agent.ts
 *   npx tsx examples/playwright-agent.ts --out tests/e2e --dry-run
 *
 * This script mirrors the exact MCP tool sequence an AI agent uses:
 *   Step 1  list_pages()                → all routes in the project
 *   Step 2  get_test_plan(page)         → flow + test IDs per page
 *   Step 3  generate_playwright_test()  → ready .spec.ts content
 *
 * To use via Claude Code MCP instead, see: .claude/commands/write-tests.md
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve, basename } from "path";
import { parseArgs }               from "util";

// ── resolve project root (this file lives in examples/) ──────────────────────
const __dirname = new URL(".", import.meta.url).pathname;
const ROOT      = resolve(__dirname, "..");

// ── imports from compiled testex dist ────────────────────────────────────────
const { LanceDBStore }             = await import(`${ROOT}/dist/vectorstore/lancedb-store.js`);
const { deriveTestFlow,
        generatePlaywrightSnippet } = await import(`${ROOT}/dist/schema/models.js`);
const { config }                   = await import(`${ROOT}/dist/config.js`);

// ── CLI args ──────────────────────────────────────────────────────────────────
const { values: args } = parseArgs({
  options: {
    out:     { type: "string",  default: "tests/e2e" },
    "dry-run": { type: "boolean", default: false },
    page:    { type: "string"  },   // generate for one page only
  },
  strict: false,
});

const OUT_DIR  = resolve(ROOT, args.out as string);
const DRY_RUN  = args["dry-run"] as boolean;
const ONE_PAGE = args.page as string | undefined;

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const db = new LanceDBStore(config.dbPath);

  // ── STEP 1: list_pages() ──────────────────────────────────────────────────
  console.log("\n🔍  [Step 1] list_pages — discovering indexed routes...");
  const pages = await db.listPages(200);

  if (!pages.length) {
    console.error(
      "\n❌  No pages found in index.\n" +
      "    Run first:  node dist/cli/index.js index <path-to-src>\n"
    );
    process.exit(1);
  }

  // Filter if --page flag was given
  const targets = ONE_PAGE
    ? pages.filter((p) =>
        p.name.toLowerCase().includes(ONE_PAGE.toLowerCase()) ||
        (p.route ?? "").toLowerCase().includes(ONE_PAGE.toLowerCase())
      )
    : pages;

  console.log(`    Found ${pages.length} pages total${ONE_PAGE ? `, filtered to ${targets.length}` : ""}`);
  for (const p of targets) {
    console.log(`      • ${p.name.padEnd(28)} ${p.route ?? "-"}`);
  }

  if (!targets.length) {
    console.error(`\n❌  No pages matched "${ONE_PAGE}"`);
    process.exit(1);
  }

  if (!DRY_RUN) mkdirSync(OUT_DIR, { recursive: true });

  // ── STEP 2 + 3: get_test_plan → generate_playwright_test per page ─────────
  const generated: string[] = [];

  for (const page of targets) {
    console.log(`\n📋  [Step 2] get_test_plan("${page.name}")`);

    // Aggregate elements from this page's record
    const flow    = deriveTestFlow(page.elements ?? []);
    const testIds = page.dataTestIds;

    console.log(`    route       : ${page.route ?? "(no route)"}`);
    console.log(`    test IDs    : ${testIds.length}`);
    console.log(`    flow steps  : ${flow.length}`);
    flow.forEach((s) =>
      console.log(`      ${s.step}. ${s.action.padEnd(12)} ${s.testId}${s.value ? `  ← "${s.value}"` : ""}`)
    );

    // ── STEP 3: generate_playwright_test() ────────────────────────────────
    console.log(`\n✏️   [Step 3] generate_playwright_test("${page.name}")`);
    const spec = buildSpec(page, flow);

    const fileName  = toFileName(page.name) + ".spec.ts";
    const filePath  = join(OUT_DIR, fileName);

    if (DRY_RUN) {
      console.log(`\n    [dry-run] would write → ${filePath}`);
      console.log("    ─".repeat(40));
      console.log(spec.split("\n").map((l) => "    " + l).join("\n"));
    } else {
      writeFileSync(filePath, spec, "utf-8");
      console.log(`    ✓ written → ${filePath}`);
    }
    generated.push(filePath);
  }

  console.log(`\n✅  Done — ${generated.length} spec file(s) ${DRY_RUN ? "would be " : ""}written to ${OUT_DIR}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Build a full Playwright spec from a ComponentRecord + derived flow
// ─────────────────────────────────────────────────────────────────────────────
function buildSpec(page, flow) {
  const name  = page.name;
  const route = page.route ?? null;
  const lines = [];

  lines.push(`import { test, expect } from '@playwright/test';`);
  lines.push(``);
  lines.push(`/**`);
  lines.push(` * Auto-generated by testex playwright-agent`);
  lines.push(` * Source : ${page.file}`);
  if (route) lines.push(` * Route  : ${route}`);
  lines.push(` *`);
  lines.push(` * Regenerate: npx tsx examples/playwright-agent.ts --page "${name}"`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`test.describe('${name}', () => {`);

  // ── Happy path ────────────────────────────────────────────────────────────
  lines.push(`  test('happy path', async ({ page }) => {`);
  if (route) lines.push(`    await page.goto('${route}');`);

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
        lines.push(`    await page.getByTestId('${step.testId}').selectOption('value');`);
        break;
      case "click":
        lines.push(
          `    await page.getByTestId('${step.testId}').click();` +
          (step.text ? `  // ${step.text}` : "")
        );
        break;
      case "navigate":
        lines.push(
          `    // [navigation] page.getByTestId('${step.testId}').click()  →  ${step.text ?? step.testId}`
        );
        break;
    }
  }

  // Auto-assertion: first test ID should be visible
  if (page.dataTestIds.length) {
    lines.push(``);
    lines.push(`    // Assertions`);
    lines.push(`    await expect(page.getByTestId('${page.dataTestIds[0]}')).toBeVisible();`);
  }
  lines.push(`  });`);

  // ── Visibility smoke test ─────────────────────────────────────────────────
  lines.push(``);
  lines.push(`  test('all key elements visible', async ({ page }) => {`);
  if (route) lines.push(`    await page.goto('${route}');`);
  for (const id of page.dataTestIds.slice(0, 6)) {
    lines.push(`    await expect(page.getByTestId('${id}')).toBeVisible();`);
  }
  lines.push(`  });`);

  // ── Negative path (form validation) if there are fill steps ──────────────
  const fillSteps = flow.filter((s) => s.action === "fill");
  const clickSteps = flow.filter((s) => s.action === "click");
  if (fillSteps.length && clickSteps.length) {
    lines.push(``);
    lines.push(`  test('shows validation error on empty submit', async ({ page }) => {`);
    if (route) lines.push(`    await page.goto('${route}');`);
    lines.push(`    // Submit without filling any fields`);
    lines.push(`    await page.getByTestId('${clickSteps[0].testId}').click();`);
    lines.push(`    // Expect form to remain on same page (or show error)`);
    if (route) lines.push(`    await expect(page).toHaveURL(new RegExp('${route}'));`);
    lines.push(`  });`);
  }

  lines.push(`});`);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
function toFileName(name) {
  return name
    .replace(/([A-Z])/g, (_, c, i) => (i > 0 ? "-" : "") + c.toLowerCase())
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

main().catch((err) => { console.error(err); process.exit(1); });
