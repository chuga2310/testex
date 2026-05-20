import { createHash } from "crypto";
import { basename, extname } from "path";

// ── Shared HTML attribute patterns (work for all frameworks) ──────────────
export const DATA_TEST_STATIC_RE =
  /(?:data-test|data-testid|data-cy|data-e2e)\s*=\s*["']([^"']+)["']/g;
export const ARIA_LABEL_RE = /aria-label\s*=\s*["']([^"']+)["']/g;
export const ROUTE_RE = /path\s*=\s*["']([/][^"']+)["']/g;

export function makeId(file: string, name: string): string {
  return createHash("md5").update(`${file}::${name}`).digest("hex").slice(0, 12);
}

export function extractStaticTestIds(
  content: string,
  extraAttrs: string[] = []
): string[] {
  const ids: string[] = [];
  let m: RegExpExecArray | null;

  const re = new RegExp(DATA_TEST_STATIC_RE.source, "g");
  while ((m = re.exec(content)) !== null) ids.push(m[1]);

  for (const attr of extraAttrs) {
    if (attr === "data-test" || attr === "data-testid") continue;
    const attrRe = new RegExp(
      `${attr.replace(/-/g, "\\-")}\\s*=\\s*["']([^"']+)["']`,
      "g"
    );
    while ((m = attrRe.exec(content)) !== null) ids.push(m[1]);
  }

  return [...new Set(ids)];
}

export function extractAriaLabels(content: string): string[] {
  const re = new RegExp(ARIA_LABEL_RE.source, "g");
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) results.push(m[1]);
  return [...new Set(results)];
}

export function extractRoutes(content: string): string[] {
  const re = new RegExp(ROUTE_RE.source, "g");
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) results.push(m[1]);
  return [...new Set(results)];
}

export function nameFromFile(filePath: string): string {
  return basename(filePath, extname(filePath)).replace(/[-. ]/g, "_");
}
