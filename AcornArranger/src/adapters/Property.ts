import { toSearchParams, buildSortParam, type EntityAdapter } from "./common";

// Property-specific filter type (subset of full filters)
export type PropertyFilters = {
  q?: string;
  city?: string;
  statusIds?: number[];
  cleaningTimeMin?: number;
  cleaningTimeMax?: number;
  page: number;
  pageSize: number;
};

const SORT_KEY_MAP = {
  // Column IDs from TanStack Table mapped to API sort keys
  // See /api/properties route.ts for parseSortParam mapping
  properties_id: "id",
  property_name: "name",
  estimated_cleaning_mins: "estimatedCleaningMins",
  status: "status",
} as const;

export const PropertyAdapter: EntityAdapter<PropertyFilters> = {
  endpoint: "/api/properties",
  toApiParams({ filters, sort, pagination }) {
    const sortParam = buildSortParam(sort, SORT_KEY_MAP);
    return toSearchParams({
      q: filters.q,
      city: filters.city,
      statusIds: filters.statusIds,
      cleaningTimeMin: filters.cleaningTimeMin,
      cleaningTimeMax: filters.cleaningTimeMax,
      page: pagination.page,
      pageSize: pagination.pageSize,
      sort: sortParam,
    });
  },
};

export default PropertyAdapter;
