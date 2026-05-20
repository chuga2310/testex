import { createHash } from "crypto";
import { basename, extname } from "path";
import type { ElementInfo } from "../schema/models.js";

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

// ── extractElementInfos ───────────────────────────────────────────────────────
/**
 * For each element that carries a data-test* attribute, extract structured
 * metadata: tag name, input type, visible text, placeholder, aria-label.
 *
 * Works for JSX/TSX, Vue templates, Svelte markup, and plain HTML.
 * Uses a position-walk approach so JSX expressions like `{() => x}` never
 * confuse the attribute scanner.
 */
/** Base attributes always scanned (same as extractStaticTestIds). */
const BASE_TEST_ATTRS = ["data-test", "data-testid", "data-cy", "data-e2e"];

export function extractElementInfos(
  content: string,
  extraAttrs: string[] = []
): ElementInfo[] {
  const found: Array<{ pos: number; info: Omit<ElementInfo, "order"> }> = [];
  const seenIds = new Set<string>();

  // Always scan the 4 base attrs + any project-specific extras
  const attrsToScan = [
    ...BASE_TEST_ATTRS,
    ...extraAttrs.filter((a) => !BASE_TEST_ATTRS.includes(a)),
  ];

  for (const attr of attrsToScan) {
    const attrEscaped = attr.replace(/-/g, "\\-");
    const RE = new RegExp(
      `${attrEscaped}\\s*=\\s*["']([^"']+)["']`,
      "g"
    );
    let m: RegExpExecArray | null;

    while ((m = RE.exec(content)) !== null) {
      const testId = m[1];
      if (seenIds.has(testId)) continue;
      seenIds.add(testId);

      const attrPos = m.index;

      // Walk backward to find the opening '<' of this element
      let tagStart = attrPos;
      while (tagStart > 0 && content[tagStart] !== "<") tagStart--;

      // Window: from '<' to 300 chars after the attribute position
      const window = content.slice(tagStart, attrPos + 300);

      const tagNameMatch = window.match(/^<([\w-]+)/);
      const tag = tagNameMatch?.[1]?.toLowerCase() ?? "div";

      // Extract key attributes from the window
      const inputType  = attrVal(window, "type");
      const placeholder = attrVal(window, "placeholder");
      const ariaLabel  = attrVal(window, "aria-label");

      // Extract visible text for interactive elements (button, a, label, span)
      let text: string | undefined;
      const TEXT_TAGS = new Set(["button", "a", "label", "span", "h1", "h2", "h3"]);
      if (TEXT_TAGS.has(tag)) {
        // Find first '>' that closes the opening tag, then grab inner text
        const afterAttr = content.slice(attrPos);
        const gtIdx = afterAttr.indexOf(">");
        if (gtIdx !== -1) {
          const afterOpen = afterAttr.slice(gtIdx + 1);
          const closeRe   = new RegExp(`<\\/${tag}\\s*>`, "i");
          const closeMatch = closeRe.exec(afterOpen);
          if (closeMatch) {
            const inner = afterOpen
              .slice(0, closeMatch.index)
              .replace(/<[^>]+>/g, "")       // strip child tags
              .replace(/\{[^}]+\}/g, "")      // strip JSX / template expressions
              .replace(/\s+/g, " ")
              .trim();
            if (inner) text = inner.slice(0, 80);
          }
        }
      }

      found.push({
        pos: attrPos,
        info: { testId, tag, inputType, text, placeholder, ariaLabel },
      });
    }
  }

  // Sort by position in file so `order` matches DOM order
  found.sort((a, b) => a.pos - b.pos);
  return found.map((f, i) => ({ ...f.info, order: i }));
}

// helper: extract `name="value"` from an attribute string
function attrVal(attrs: string, name: string): string | undefined {
  const nameEsc = name.replace(/-/g, "\\-");
  const m = attrs.match(new RegExp(`\\b${nameEsc}\\s*=\\s*["']([^"']+)["']`));
  return m?.[1] ?? undefined;
}
