import type { StaffFilters } from "@/lib/filters/schemas";
import { toSearchParams, buildSortParam, type EntityAdapter } from "./common";

const SORT_KEY_MAP = {
  id: "id",
  name: "name",
  firstName: "firstName",
  lastName: "lastName",
  role: "role",
  status: "status",
} as const;

export const StaffAdapter: EntityAdapter<StaffFilters> = {
  endpoint: "/api/staff",
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

export default StaffAdapter;


