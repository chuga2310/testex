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

export function toEmbedText(record: ComponentRecord): string {
  const parts: string[] = [`Component: ${record.name}`];
  if (record.route) parts.push(`Route: ${record.route}`);
  if (record.dataTestIds.length)
    parts.push(`Test IDs: ${record.dataTestIds.join(", ")}`);
  if (record.ariaLabels.length)
    parts.push(`Aria labels: ${record.ariaLabels.join(", ")}`);
  if (record.userActions.length)
    parts.push(`Actions: ${record.userActions.join(", ")}`);
  if (record.rawText) parts.push(record.rawText.slice(0, 500));
  return parts.join(" | ");
}
