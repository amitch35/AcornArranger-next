import { z } from "zod";
import {
  AppointmentFiltersSchema,
  PropertyFiltersSchema,
  StaffFiltersSchema,
  BaseFilterSchema,
  IdArraySchema,
} from "./schemas";

type CanonicalKeys =
  | "q"
  | "page"
  | "pageSize"
  | "sort"
  | "statusIds"
  | "serviceIds"
  | "staffIds"
  | "propertyIds"
  | "dateFrom"
  | "dateTo";

const CANONICAL_KEY_ORDER: CanonicalKeys[] = [
  "q",
  "page",
  "pageSize",
  "sort",
  "dateFrom",
  "dateTo",
  "statusIds",
  "serviceIds",
  "staffIds",
  "propertyIds",
];

export type DecodeOptions = {
  allow?: Partial<
    Record<"statusIds" | "serviceIds" | "staffIds" | "propertyIds", Set<number>>
  >;
};

function parseCsvNumbers(value: string | string[] | null | undefined): number[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(",") : value;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && Number.isInteger(n))
    .filter((n) => n >= 1 && n <= 2147483647);
}

function normalizeIso(input: string | undefined): string | undefined {
  if (!input) return undefined;
  try {
    const d = new Date(input);
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString();
  } catch {
    return undefined;
  }
}

// Decoder that only recognizes canonical keys and ignores everything else.
export function decodeFromSearchParams(
  searchParams: URLSearchParams,
  options?: DecodeOptions
): Record<CanonicalKeys, unknown> {
  const get = (k: string) => searchParams.get(k);

  const result: Partial<Record<CanonicalKeys, unknown>> = {};

  result.q = get("q") ?? undefined;
  const page = Number(get("page"));
  result.page = Number.isFinite(page) && page >= 1 ? Math.trunc(page) : undefined;
  const pageSize = Number(get("pageSize"));
  result.pageSize =
    Number.isFinite(pageSize) && pageSize >= 1 ? Math.trunc(pageSize) : undefined;
  result.sort = get("sort") ?? undefined;

  result.dateFrom = normalizeIso(get("dateFrom") ?? undefined);
  result.dateTo = normalizeIso(get("dateTo") ?? undefined);

  const statusIds = parseCsvNumbers(get("statusIds"));
  const serviceIds = parseCsvNumbers(get("serviceIds"));
  const staffIds = parseCsvNumbers(get("staffIds"));
  const propertyIds = parseCsvNumbers(get("propertyIds"));

  const allow = options?.allow;
  result.statusIds = allow?.statusIds
    ? statusIds.filter((n) => allow.statusIds!.has(n))
    : statusIds;
  result.serviceIds = allow?.serviceIds
    ? serviceIds.filter((n) => allow.serviceIds!.has(n))
    : serviceIds;
  result.staffIds = allow?.staffIds
    ? staffIds.filter((n) => allow.staffIds!.has(n))
    : staffIds;
  result.propertyIds = allow?.propertyIds
    ? propertyIds.filter((n) => allow.propertyIds!.has(n))
    : propertyIds;

  return result as Record<CanonicalKeys, unknown>;
}

function encodeCsvNumbers(values: number[] | undefined): string | undefined {
  if (!values || values.length === 0) return undefined;
  const cleaned = values
    .filter((n) => Number.isFinite(n) && Number.isInteger(n))
    .filter((n) => n >= 1 && n <= 2147483647);
  cleaned.sort((a, b) => a - b);
  if (cleaned.length === 0) return undefined;
  return cleaned.join(",");
}

export function encodeToSearchParams(
  input: Record<string, unknown>
): URLSearchParams {
  const params = new URLSearchParams();

  // Apply canonical order for stability
  for (const key of CANONICAL_KEY_ORDER) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    switch (key) {
      case "q":
      case "sort": {
        const v = String(value);
        if (v.length > 0) params.set(key, v);
        break;
      }
      case "page":
      case "pageSize": {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 1) params.set(key, String(Math.trunc(n)));
        break;
      }
      case "dateFrom":
      case "dateTo": {
        const iso = normalizeIso(String(value));
        if (iso) params.set(key, iso);
        break;
      }
      case "statusIds":
      case "serviceIds":
      case "staffIds":
      case "propertyIds": {
        const joined = encodeCsvNumbers(value as number[] | undefined);
        if (joined) params.set(key, joined);
        break;
      }
    }
  }

  return params;
}

// Schema helpers: validate decoded objects against specific schemas
export function validateBaseFilters<T extends z.ZodTypeAny>(
  decoded: Record<string, unknown>,
  schema: T
): z.infer<T> {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(decoded)) {
    if (v !== undefined) cleaned[k] = v;
  }
  const result = schema.safeParse(cleaned);
  if (result.success) return result.data as z.infer<T>;
  // If invalid, coerce with defaults by parsing empty object to get defaults, then merge only defined values
  const defaults = schema.parse({});
  return { ...defaults, ...cleaned } as z.infer<T>;
}

export const Schemas = {
  base: BaseFilterSchema,
  appointment: AppointmentFiltersSchema,
  property: PropertyFiltersSchema,
  staff: StaffFiltersSchema,
};


