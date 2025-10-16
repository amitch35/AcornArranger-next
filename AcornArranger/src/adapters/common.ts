import { encodeToSearchParams } from "@/lib/filters/URLQueryCodec";

export type SortDirection = "asc" | "desc";

export type SortRule = {
  id: string;
  desc: boolean;
};

export type SortState = SortRule[];

export type Pagination = {
  page: number;
  pageSize: number;
};

export type SortKeyMap = Record<string, string>;

export function buildSortParam(sort: SortState, sortKeyMap: SortKeyMap): string {
  if (!Array.isArray(sort) || sort.length === 0) return "";
  const parts: string[] = [];
  for (const rule of sort) {
    const apiKey = sortKeyMap[rule.id] ?? rule.id;
    const dir: SortDirection = rule.desc ? "desc" : "asc";
    parts.push(`${apiKey}:${dir}`);
  }
  return parts.join(",");
}

export interface EntityAdapter<F extends Record<string, unknown>> {
  endpoint: string;
  toApiParams(input: { filters: F; sort: SortState; pagination: Pagination }): URLSearchParams;
}

export function toSearchParams(input: Record<string, unknown>): URLSearchParams {
  return encodeToSearchParams(input);
}


