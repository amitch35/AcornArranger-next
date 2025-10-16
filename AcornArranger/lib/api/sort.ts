export type SortRule = { column: string; ascending: boolean };

export function parseSortParam(sort: string | null | undefined, allowed: Record<string, string>): SortRule[] {
  if (!sort) return [];

  // Normalize allowed keys to lowercase for case-insensitive matching
  const normalizedAllowed: Record<string, string> = {};
  for (const key of Object.keys(allowed)) {
    normalizedAllowed[key.toLowerCase()] = allowed[key];
  }

  const rules: SortRule[] = [];
  const parts = String(sort)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    const [rawKey = "", rawDir = "asc"] = part.split(":", 2);
    const key = rawKey.trim().toLowerCase();
    const apiColumn = normalizedAllowed[key];
    if (!apiColumn) continue;
    const dir = rawDir.trim().toLowerCase();
    const ascending = dir !== "desc";
    rules.push({ column: apiColumn, ascending });
  }
  return rules;
}


