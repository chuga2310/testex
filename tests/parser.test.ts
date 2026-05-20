/**
 * Parser tests — no model/database needed, runs fast.
 * Run: npx tsx tests/parser.test.ts
 */
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseFile, scanDirectory } from "../src/parser/react-parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES = join(__dirname, "..", "examples");

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ ${msg}`);
    failed++;
  }
}

console.log("\n── LoginForm ──────────────────────────────");
{
  const [rec] = parseFile(join(EXAMPLES, "LoginForm.tsx"));
  assert(rec.name === "LoginForm", "name = LoginForm");
  assert(rec.dataTestIds.includes("login-email-input"), "has login-email-input");
  assert(rec.dataTestIds.includes("login-password-input"), "has login-password-input");
  assert(rec.dataTestIds.includes("login-submit-button"), "has login-submit-button");
  assert(rec.dataTestIds.includes("login-form"), "has login-form");
  assert(rec.ariaLabels.includes("Email address"), "has aria-label Email address");
  assert(rec.userActions.includes("submit"), "detects submit action");
}

console.log("\n── CheckoutPage ───────────────────────────");
{
  const [rec] = parseFile(join(EXAMPLES, "CheckoutPage.tsx"));
  assert(rec.dataTestIds.includes("checkout-submit-button"), "has checkout-submit-button");
  assert(rec.dataTestIds.includes("checkout-shipping-name-input"), "has checkout-shipping-name-input");
  assert(rec.userActions.includes("click"), "detects click action");
}

console.log("\n── ProfileSettings ────────────────────────");
{
  const [rec] = parseFile(join(EXAMPLES, "ProfileSettings.tsx"));
  assert(rec.dataTestIds.includes("profile-save-button"), "has profile-save-button");
  assert(rec.dataTestIds.includes("profile-delete-account-button"), "has profile-delete-account-button");
}

console.log("\n── Vue LoginForm ───────────────────────────");
{
  const [rec] = parseFile(join(EXAMPLES, "LoginForm.vue"));
  assert(rec.framework === "vue", "framework = vue");
  assert(rec.name === "LoginForm", "name = LoginForm");
  assert(rec.dataTestIds.includes("login-form-container"), "has login-form-container");
  assert(rec.dataTestIds.includes("login-email-input"), "has login-email-input");
  assert(rec.dataTestIds.includes("login-submit-btn"), "has login-submit-btn");
  assert(rec.userActions.includes("submit"), "has submit action");
}

console.log("\n── Svelte LoginForm ────────────────────────");
{
  const [rec] = parseFile(join(EXAMPLES, "LoginForm.svelte"));
  assert(rec.framework === "svelte", "framework = svelte");
  assert(rec.dataTestIds.includes("login-form-container"), "has login-form-container");
  assert(rec.dataTestIds.includes("login-email-input"), "has login-email-input");
  assert(rec.dataTestIds.includes("login-submit-btn"), "has login-submit-btn");
  assert(rec.userActions.includes("click"), "has click action");
  assert(rec.userActions.includes("submit"), "has submit action");
}

console.log("\n── Angular/HTML LoginForm ──────────────────");
{
  const [rec] = parseFile(join(EXAMPLES, "login.component.html"));
  assert(rec.framework === "angular", "framework = angular");
  assert(rec.dataTestIds.includes("login-form-container"), "has login-form-container");
  assert(rec.dataTestIds.includes("login-email-input"), "has login-email-input");
  assert(rec.dataTestIds.includes("login-submit-btn"), "has login-submit-btn");
  assert(rec.userActions.includes("click"), "has click action");
  assert(rec.userActions.includes("submit"), "has submit action");
}

console.log("\n── scanDirectory (multi-framework) ─────────");
{
  const records = scanDirectory(EXAMPLES, [".tsx", ".jsx", ".vue", ".svelte", ".html"], ["node_modules"]);
  assert(records.length >= 6, `found ${records.length} >= 6 components`);
  const allIds = records.flatMap((r) => r.dataTestIds);
  assert(allIds.includes("checkout-submit-button"), "checkout-submit-button in scan");
  assert(allIds.includes("login-submit-button"), "login-submit-button in scan");
  const frameworks = [...new Set(records.map((r) => r.framework))];
  assert(frameworks.includes("react"), "react found");
  assert(frameworks.includes("vue"), "vue found");
  assert(frameworks.includes("svelte"), "svelte found");
  assert(frameworks.includes("angular"), "angular found");
}

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
