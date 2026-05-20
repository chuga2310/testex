import { ComponentRecord } from "../schema/models.js";

export function normalize(records: ComponentRecord[]): ComponentRecord[] {
  const seen = new Map<string, ComponentRecord>();
  for (const rec of records) {
    const existing = seen.get(rec.id);
    if (existing) {
      seen.set(rec.id, {
        ...existing,
        dataTestIds: [...new Set([...existing.dataTestIds, ...rec.dataTestIds])],
        ariaLabels: [...new Set([...existing.ariaLabels, ...rec.ariaLabels])],
        userActions: [...new Set([...existing.userActions, ...rec.userActions])],
      });
    } else {
      seen.set(rec.id, rec);
    }
  }
  return [...seen.values()];
}
