import type { AppointmentFilters } from "@/lib/filters/schemas";
import { toSearchParams, buildSortParam, type EntityAdapter } from "./common";

/**
 * Sort key mapping: TanStack Table column IDs → API sort param keys.
 * The API route maps these to actual DB columns.
 */
const SORT_KEY_MAP = {
  id: "id",
  serviceTime: "serviceTime",
  property: "property",
  staff: "staff",
  nextArrivalTime: "nextArrivalTime",
  status: "status",
} as const;

export const AppointmentsAdapter: EntityAdapter<AppointmentFilters> = {
  endpoint: "/api/appointments",
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
      taOnly: filters.taOnly,
      nextArrivalBefore: filters.nextArrivalBefore,
      nextArrivalAfter: filters.nextArrivalAfter,
    });
  },
};

export default AppointmentsAdapter;
