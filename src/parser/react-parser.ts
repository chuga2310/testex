import { createHash } from "crypto";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname, basename, sep } from "path";
import { ComponentRecord } from "../schema/models.js";
import { parseVueFile } from "./vue-parser.js";
import { parseSvelteFile } from "./svelte-parser.js";
import { parseHtmlFile } from "./html-parser.js";


// ── Regex patterns (ported from Python) ─────────────────────────────────────
const DATA_TEST_STATIC_RE =
  /(?:data-test|data-testid|data-cy|data-e2e)\s*=\s*["']([^"']+)["']/g;
const DATA_TEST_EXPR_RE =
  /data-test(?:id)?\s*=\s*\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g;
const ARIA_LABEL_RE = /aria-label\s*=\s*["']([^"']+)["']/g;
const COMPONENT_FN_RE =
  /(?:export\s+(?:default\s+)?)?(?:function|const)\s+([A-Z][a-zA-Z0-9]*)/g;
const ROUTE_RE = /path\s*=\s*["']([/][^"']+)["']/g;
const BUTTON_RE = /onClick\s*=/i;
const SUBMIT_RE = /onSubmit\s*=/i;

// ── Afforai testDataHelpers mappings ─────────────────────────────────────────
const SCOPE_PREFIXES: Record<string, string> = {
  page: "page",
  section: "section",
  component: "component",
  form: "form",
  modal: "modal",
};

const ELEMENT_TYPES: Record<string, string> = {
  button: "btn",
  input: "input",
  textarea: "textarea",
  select: "select",
  link: "link",
  list: "list",
  listItem: "item",
  checkbox: "checkbox",
  radio: "radio",
  toggle: "switch",
  error: "error",
  status: "status",
  label: "label",
  text: "text",
  tooltip: "tooltip",
  breadcrumb: "breadcrumb",
  tab: "tab",
  card: "card",
  menu: "menu",
  icon: "icon",
};

const SINGLE_ARG_SUFFIX: Record<string, string> = {
  loader: "loader",
  dialog: "dialog",
};

function extractStringArgs(argsStr: string): string[] {
  const matches: string[] = [];
  const re = /["'`]([^"'`]+)["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(argsStr)) !== null) matches.push(m[1]);
  return matches;
}

function splitFirstArg(argsStr: string): [string, string] {
  let depth = 0;
  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if ("({[".includes(ch)) depth++;
    else if (")}]".includes(ch)) depth--;
    else if (ch === "," && depth === 0)
      return [argsStr.slice(0, i).trim(), argsStr.slice(i + 1).trim()];
  }
  return [argsStr.trim(), ""];
}

function resolveExpr(expr: string): string {
  expr = expr.trim();
  if (!expr) return "";

  // Template literal
  if (expr.startsWith("`")) {
    const inner = expr.slice(1, expr.length - 1);
    const resolved = inner.replace(/\$\{([^}]+)\}/g, (_, e) =>
      resolveExpr(e.trim())
    );
    return resolved.replace(/\$\{[^}]+\}/g, "").replace(/^-|-$/g, "");
  }

  // Plain string
  if (
    (expr.startsWith('"') && expr.endsWith('"')) ||
    (expr.startsWith("'") && expr.endsWith("'"))
  )
    return expr.slice(1, -1);

  // Function call
  const fnMatch = /^(\w+)\((.+)\)$/s.exec(expr);
  if (fnMatch) {
    const [, fnName, argsStr] = fnMatch;
    if (SCOPE_PREFIXES[fnName]) {
      const prefix = SCOPE_PREFIXES[fnName];
      const strs = extractStringArgs(argsStr);
      return strs.length ? `${prefix}-${strs[0]}` : prefix;
    }
    if (ELEMENT_TYPES[fnName]) {
      const elType = ELEMENT_TYPES[fnName];
      const [first, rest] = splitFirstArg(argsStr);
      const scope = resolveExpr(first);
      if (rest) {
        const identArgs = extractStringArgs(rest);
        if (identArgs.length && scope) return `${scope}-${elType}-${identArgs[0]}`;
        if (scope) return `${scope}-${elType}`;
      }
      return scope ? `${scope}-${elType}` : "";
    }
    if (SINGLE_ARG_SUFFIX[fnName]) {
      const scope = resolveExpr(argsStr);
      return scope ? `${scope}-${SINGLE_ARG_SUFFIX[fnName]}` : "";
    }
  }
  return "";
}

function extractDataTestIds(content: string, extraAttrs: string[]): string[] {
  const ids: string[] = [];

  let m: RegExpExecArray | null;
  const staticRe = new RegExp(DATA_TEST_STATIC_RE.source, "g");
  while ((m = staticRe.exec(content)) !== null) ids.push(m[1]);

  for (const attr of extraAttrs) {
    if (attr === "data-test" || attr === "data-testid") continue;
    const re = new RegExp(
      `${attr.replace(/-/g, "\\-")}\\s*=\\s*["']([^"']+)["']`,
      "g"
    );
    while ((m = re.exec(content)) !== null) ids.push(m[1]);
  }

  const exprRe = new RegExp(DATA_TEST_EXPR_RE.source, "g");
  while ((m = exprRe.exec(content)) !== null) {
    const resolved = resolveExpr(m[1].trim());
    if (resolved && !resolved.startsWith("$")) ids.push(resolved);
  }

  return [...new Set(ids)];
}

function makeId(file: string, name: string): string {
  return createHash("md5").update(`${file}::${name}`).digest("hex").slice(0, 12);
}

function extractComponentName(content: string, filePath: string): string {
  const matches = [...content.matchAll(COMPONENT_FN_RE)];
  if (matches.length) return matches[0][1];
  return basename(filePath, extname(filePath)).replace(/[-. ]/g, "_");
}

export function parseFile(
  filePath: string,
  dataTestAttrs: string[] = []
): ComponentRecord[] {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }
  if (!content.trim()) return [];

  const ext = extname(filePath).toLowerCase();

  // Dispatch to framework-specific parser
  if (ext === ".vue") return [parseVueFile(filePath, content, dataTestAttrs)];
  if (ext === ".svelte") return [parseSvelteFile(filePath, content, dataTestAttrs)];
  if (ext === ".html") return [parseHtmlFile(filePath, content, dataTestAttrs)];

  // Default: React/JSX/TSX parser (also handles plain TS/JS)
  const extra = dataTestAttrs.filter(
    (a) => a !== "data-test" && a !== "data-testid"
  );
  const testIds = extractDataTestIds(content, extra);
  const ariaLabels = [
    ...new Set([...content.matchAll(ARIA_LABEL_RE)].map((m) => m[1])),
  ];
  const routes = [
    ...new Set([...content.matchAll(ROUTE_RE)].map((m) => m[1])),
  ];
  const actions: string[] = [];
  if (BUTTON_RE.test(content)) actions.push("click");
  if (SUBMIT_RE.test(content)) actions.push("submit");
  const name = extractComponentName(content, filePath);
  const route = routes[0] ?? null;

  return [
    {
      id: makeId(filePath, name),
      type: route ? "page" : "component",
      framework: "react",
      name,
      route,
      file: filePath,
      dataTestIds: testIds,
      ariaLabels,
      relatedApi: [],
      children: [],
      userActions: actions,
      rawText: content.slice(0, 1000),
    },
  ];
}

export function scanDirectory(
  root: string,
  extensions: string[],
  excludeDirs: string[],
  dataTestAttrs: string[] = []
): ComponentRecord[] {
  const extSet = new Set(extensions);
  const excludeSet = new Set(excludeDirs);
  const records: ComponentRecord[] = [];

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (excludeSet.has(entry)) continue;
      const full = join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile() && extSet.has(extname(entry))) {
        records.push(...parseFile(full, dataTestAttrs));
      }
    }
  }

  walk(root);
  return records;
}
