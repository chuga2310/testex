import { ComponentRecord } from "../schema/models.js";
import {
  makeId,
  extractStaticTestIds,
  extractAriaLabels,
  extractRoutes,
  nameFromFile,
  extractElementInfos,
} from "./base.js";

// Svelte action patterns: on:click, on:submit
const SVELTE_CLICK_RE = /on:click\s*=/i;
const SVELTE_SUBMIT_RE = /on:submit[|a-z]*\s*=/i;

// SvelteKit route: export const load, +page.svelte filename pattern
const SVELTE_PAGE_RE = /\+page(\.svelte)?$/;

function extractScriptPart(content: string): string {
  const m = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  return m?.[1] ?? "";
}

function extractTemplatePart(content: string): string {
  // In Svelte, the template is everything outside <script> and <style>
  return content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
}

export function parseSvelteFile(
  filePath: string,
  content: string,
  dataTestAttrs: string[] = []
): ComponentRecord {
  const template = extractTemplatePart(content);
  const script = extractScriptPart(content);
  const combined = template + "\n" + script;

  // SvelteKit: +page.svelte is always a route; name from file
  const isSvelteKitPage = SVELTE_PAGE_RE.test(filePath);
  const name = nameFromFile(filePath)
    .replace(/^\+/, "")          // remove leading +
    .replace(/^page$/, "Page")
    || "Component";

  const extraAttrs = dataTestAttrs.filter(
    (a) => a !== "data-test" && a !== "data-testid"
  );
  const testIds = extractStaticTestIds(combined, extraAttrs);
  const ariaLabels = extractAriaLabels(template);
  const routes = extractRoutes(combined);

  const actions: string[] = [];
  if (SVELTE_CLICK_RE.test(template)) actions.push("click");
  if (SVELTE_SUBMIT_RE.test(template)) actions.push("submit");

  return {
    id: makeId(filePath, name),
    type: isSvelteKitPage || routes.length ? "page" : "component",
    framework: "svelte",
    name,
    route: routes[0] ?? null,
    file: filePath,
    dataTestIds: testIds,
    ariaLabels,
    relatedApi: [],
    children: [],
    userActions: actions,
    elements: extractElementInfos(template, dataTestAttrs),
    rawText: content.slice(0, 1000),
  };
}
