import { ComponentRecord } from "../schema/models.js";
import {
  makeId,
  extractStaticTestIds,
  extractAriaLabels,
  extractRoutes,
  nameFromFile,
} from "./base.js";

// Vue-specific action patterns: @click, v-on:click, @submit, v-on:submit
const VUE_CLICK_RE = /(?:@click|v-on:click)\s*=/i;
const VUE_SUBMIT_RE = /(?:@submit|v-on:submit)[.a-z]*\s*=/i;

// Vue Options API: name: 'ComponentName'
const VUE_NAME_RE = /name\s*:\s*["']([^"']+)["']/;

// Vue Router: { path: '/login' }
const VUE_ROUTE_RE = /path\s*:\s*["']([/][^"']+)["']/g;

function extractVueRoutes(content: string): string[] {
  const results: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(VUE_ROUTE_RE.source, "g");
  while ((m = re.exec(content)) !== null) results.push(m[1]);
  return [...new Set(results)];
}

function extractTemplatePart(content: string): string {
  const m = content.match(/<template[^>]*>([\s\S]*?)<\/template>/);
  return m?.[1] ?? content;
}

function extractScriptPart(content: string): string {
  const m = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  return m?.[1] ?? "";
}

export function parseVueFile(
  filePath: string,
  content: string,
  dataTestAttrs: string[] = []
): ComponentRecord {
  const template = extractTemplatePart(content);
  const script = extractScriptPart(content);
  const combined = template + "\n" + script;

  // Component name: Options API name property → fallback to filename
  const nameMatch = VUE_NAME_RE.exec(script);
  const name = nameMatch?.[1] ?? nameFromFile(filePath);

  const extraAttrs = dataTestAttrs.filter(
    (a) => a !== "data-test" && a !== "data-testid"
  );
  const testIds = extractStaticTestIds(combined, extraAttrs);
  const ariaLabels = extractAriaLabels(template);

  // Routes: standard path="..." OR Vue Router path: '...'
  const routes = [
    ...extractRoutes(combined),
    ...extractVueRoutes(combined),
  ];

  const actions: string[] = [];
  if (VUE_CLICK_RE.test(template)) actions.push("click");
  if (VUE_SUBMIT_RE.test(template)) actions.push("submit");

  return {
    id: makeId(filePath, name),
    type: routes.length ? "page" : "component",
    framework: "vue",
    name,
    route: routes[0] ?? null,
    file: filePath,
    dataTestIds: testIds,
    ariaLabels,
    relatedApi: [],
    children: [],
    userActions: actions,
    rawText: content.slice(0, 1000),
  };
}
