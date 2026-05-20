import { ComponentRecord } from "../schema/models.js";
import {
  makeId,
  extractStaticTestIds,
  extractAriaLabels,
  extractRoutes,
  nameFromFile,
} from "./base.js";

// Angular action patterns: (click), (submit), (ngSubmit)
const NG_CLICK_RE = /\(click\)\s*=/i;
const NG_SUBMIT_RE = /\((?:submit|ngSubmit)\)\s*=/i;

// Angular routerLink: routerLink="/path"
const NG_ROUTER_LINK_RE = /routerLink\s*=\s*["']([/][^"']+)["']/g;

// Angular @Component selector (in .ts files)
const NG_SELECTOR_RE = /selector\s*:\s*["']([^"']+)["']/;
const NG_COMPONENT_NAME_RE = /class\s+([A-Z][a-zA-Z0-9]*)(?:Component|Page|Module)/;

function extractAngularRoutes(content: string): string[] {
  const results: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(NG_ROUTER_LINK_RE.source, "g");
  while ((m = re.exec(content)) !== null) results.push(m[1]);
  return [...new Set(results)];
}

export function parseHtmlFile(
  filePath: string,
  content: string,
  dataTestAttrs: string[] = []
): ComponentRecord {
  const extraAttrs = dataTestAttrs.filter(
    (a) => a !== "data-test" && a !== "data-testid"
  );

  const testIds = extractStaticTestIds(content, extraAttrs);
  const ariaLabels = extractAriaLabels(content);
  const routes = [
    ...extractRoutes(content),
    ...extractAngularRoutes(content),
  ];

  const actions: string[] = [];
  if (NG_CLICK_RE.test(content)) actions.push("click");
  if (NG_SUBMIT_RE.test(content)) actions.push("submit");

  // Component name: Angular class name or filename
  const classMatch = NG_COMPONENT_NAME_RE.exec(content);
  const name = classMatch
    ? classMatch[1] + (classMatch[0].includes("Component") ? "Component" : "")
    : nameFromFile(filePath);

  // Detect framework from content patterns
  const isAngular =
    NG_CLICK_RE.test(content) ||
    NG_SUBMIT_RE.test(content) ||
    NG_SELECTOR_RE.test(content) ||
    /\*ngFor|\*ngIf|\[ngModel\]/.test(content);

  return {
    id: makeId(filePath, name),
    type: routes.length ? "page" : "component",
    framework: isAngular ? "angular" : "html",
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
