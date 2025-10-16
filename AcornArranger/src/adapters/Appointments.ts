import type { AppointmentFilters } from "@/lib/filters/schemas";
import { toSearchParams, buildSortParam, type EntityAdapter } from "./common";

const SORT_KEY_MAP = {
  id: "id",
  arrivalTime: "arrivalTime",
  serviceTime: "serviceTime",
  nextArrivalTime: "nextArrivalTime",
  status: "status",
  turnAround: "turnAround",
  cancelledDate: "cancelledDate",
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
    });
  },
};

export default AppointmentsAdapter;


