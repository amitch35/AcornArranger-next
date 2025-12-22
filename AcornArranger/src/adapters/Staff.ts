import type { StaffFilters } from "@/lib/filters/schemas";
import { toSearchParams, buildSortParam, type EntityAdapter } from "./common";

const SORT_KEY_MAP = {
  // Column IDs come from TanStack Table column ids (accessorKey by default).
  // Map them to the API sort keys expected by /api/staff (see route.ts parseSortParam mapping).
  user_id: "id",
  name: "name",
  first_name: "firstName",
  last_name: "lastName",
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
      roleIds: filters.roleIds,
      canClean: filters.canClean,
      canLeadTeam: filters.canLeadTeam,
      // Remove unused filters that don't apply to staff list
      // serviceIds, staffIds, propertyIds, dateFrom, dateTo are for appointments/plans
    });
  },
};

export default StaffAdapter;


