import type { PropertyFilters } from "@/lib/filters/schemas";
import { toSearchParams, buildSortParam, type EntityAdapter } from "./common";

const SORT_KEY_MAP = {
  id: "id",
  name: "name",
  estimatedCleaningMins: "estimatedCleaningMins",
  status: "status",
} as const;

export const PropertiesAdapter: EntityAdapter<PropertyFilters> = {
  endpoint: "/api/properties",
  toApiParams({ filters, sort, pagination }) {
    const sortParam = buildSortParam(sort, SORT_KEY_MAP);
    return toSearchParams({
      q: filters.q,
      page: pagination.page,
      pageSize: pagination.pageSize,
      sort: sortParam,
      statusIds: filters.statusIds,
      serviceIds: filters.serviceIds,
      staffIds: filters.staffIds,
      propertyIds: filters.propertyIds,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
  },
};

export default PropertiesAdapter;


