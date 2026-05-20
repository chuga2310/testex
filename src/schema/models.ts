export interface ComponentRecord {
  id: string;
  type: string;
  framework: string;
  name: string;
  route: string | null;
  file: string;
  dataTestIds: string[];
  ariaLabels: string[];
  relatedApi: string[];
  children: string[];
  userActions: string[];
  rawText: string;
}

export interface SearchResult {
  record: ComponentRecord;
  score: number;
}

/** Split a test-id into human-readable tokens.
 *  "login-email-input" → "login email input"
 *  "loginEmailInput"   → "login Email Input"
 *  "btn__submit--lg"   → "btn submit lg"
 */
export function normalizeId(id: string): string {
  return id
    // camelCase → spaces
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // separators (-, _, .) → space
    .replace(/[-_.]+/g, " ")
    // collapse multiple spaces
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function toEmbedText(record: ComponentRecord): string {
  const parts: string[] = [`Component: ${record.name}`];
  if (record.route) parts.push(`Route: ${record.route}`);
  if (record.dataTestIds.length) {
    parts.push(`Test IDs: ${record.dataTestIds.join(", ")}`);
    // Add tokenized form for better semantic matching
    const tokens = record.dataTestIds.map(normalizeId).join(", ");
    parts.push(`Tokens: ${tokens}`);
  }
  if (record.ariaLabels.length)
    parts.push(`Aria labels: ${record.ariaLabels.join(", ")}`);
  if (record.userActions.length)
    parts.push(`Actions: ${record.userActions.join(", ")}`);
  if (record.rawText) parts.push(record.rawText.slice(0, 500));
  return parts.join(" | ");
}
