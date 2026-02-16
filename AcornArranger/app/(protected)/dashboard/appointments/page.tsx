"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DataTable } from "@/components/datagrid/DataTable";
import { TablePagination } from "@/components/datagrid/TablePagination";
import { ResultsCount } from "@/components/datagrid/ResultsCount";
import { StatusMultiSelect } from "@/components/filters/StatusMultiSelect";
import { ServiceMultiSelect } from "@/components/filters/ServiceMultiSelect";
import { DateRangePicker } from "@/components/filters/DateRangePicker";
import { AppointmentsAdapter } from "@/src/adapters/Appointments";
import type { DateRange } from "@/components/ui/calendar";
import type { AppointmentFilters } from "@/lib/filters/schemas";
import type {
  AppointmentRow,
  AppointmentListResponse,
  AppointmentStaffMember,
} from "@/src/features/appointments/schemas";
import {
  formatDateTime,
  formatStaffSummary,
  formatAppointmentStaffName,
  getStatusBadgeVariant,
  isWithinHours,
} from "@/src/features/appointments/schemas";
import { RotateCw, Eye, Clock } from "lucide-react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { saveListUrl } from "@/lib/navigation/listReturnUrl";

/**
 * Appointments List Page (read-only)
 *
 * Columns: ID, Service Time, Property, Staff, T/A, Next Arrival, Service, Status
 * Filters: search, status, service, date range, T/A Only
 *
 * Defaults (matching legacy project):
 * - Date range: TODAY only
 * - Status: All except Cancelled
 * - Sort: departure_time ASC, next_arrival_time ASC
 */

// Helper to get today's date in YYYY-MM-DD format
function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ============================================================================
// Status Badge (mirrors Staff page approach)
// ============================================================================

function AppointmentStatusBadge({
  status,
}: {
  status: AppointmentRow["status"];
}) {
  if (!status) return <span className="text-muted-foreground text-sm">—</span>;
  const variant = getStatusBadgeVariant(status.status);
  return <Badge variant={variant}>{status.status ?? "Unknown"}</Badge>;
}

// ============================================================================
// Staff List Popover (shows all staff members for an appointment)
// ============================================================================

function StaffListPopover({ staff }: { staff: AppointmentStaffMember[] }) {
  const [open, setOpen] = React.useState(false);

  if (!staff.length) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  const { primary, additionalCount } = formatStaffSummary(staff);

  return (
    <div className="flex items-center justify-between gap-2 min-w-[180px]">
      <span className="text-sm truncate">{primary}</span>
      {additionalCount > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs font-mono shrink-0">
              +{additionalCount}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Assigned Staff ({staff.length})</h4>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {staff.map((member) => (
                  <Link
                    key={member.user_id}
                    href={`/dashboard/staff/${member.user_id}`}
                    className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => { saveListUrl("appointments"); setOpen(false); }}
                  >
                    <Badge variant="secondary" className="font-mono text-xs shrink-0">
                      #{member.user_id}
                    </Badge>
                    <span className="flex-1 truncate">{formatAppointmentStaffName(member)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ============================================================================
// T/A Indicator (simple boolean icon with aria-label)
// ============================================================================

function TurnAroundIndicator({ value }: { value: boolean | null | undefined }) {
  if (!value) return <span className="text-muted-foreground text-sm">—</span>;
  return (
    <RotateCw
      className="h-4 w-4 text-muted-foreground"
      aria-label="Turn-around"
    />
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function AppointmentsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ---- Filter state from URL (with legacy-compatible defaults) ----
  const todayString = getTodayDateString();
  const [q, setQ] = React.useState(searchParams.get("q") || "");
  const [statusIds, setStatusIds] = React.useState<string[]>(
    searchParams.get("statusIds")?.split(",").filter(Boolean) || []
  );
  const [serviceIds, setServiceIds] = React.useState<string[]>(
    searchParams.get("serviceIds")?.split(",").filter(Boolean) || []
  );
  const [taOnly, setTaOnly] = React.useState(
    searchParams.get("taOnly") === "true"
  );
  
  // Helper to parse YYYY-MM-DD as local date (not UTC)
  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  // Date range state using DateRange type
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(() => {
    const fromParam = searchParams.get("dateFrom");
    const toParam = searchParams.get("dateTo");
    
    // Default to today if no params
    if (!fromParam && !toParam) {
      return { from: parseLocalDate(todayString), to: parseLocalDate(todayString) };
    }
    
    // Parse from URL params as local dates
    return {
      from: fromParam ? parseLocalDate(fromParam) : undefined,
      to: toParam ? parseLocalDate(toParam) : undefined,
    };
  });

  const [hasInitializedDefaults, setHasInitializedDefaults] =
    React.useState(false);
  const [page, setPage] = React.useState(
    Number(searchParams.get("page")) || 1
  );
  const [pageSize, setPageSize] = React.useState(
    Number(searchParams.get("pageSize")) || 25
  );
  const [sort, setSort] = React.useState<
    Array<{ id: string; desc: boolean }>
  >([]);

  // ---- Fetch appointment status options (24h cache) ----
  const { data: statusOptions = [] } = useQuery<
    Array<{ value: string; label: string }>
  >({
    queryKey: ["appointment-status-options"],
    queryFn: async () => {
      const res = await fetch("/api/options/appointment-status");
      if (!res.ok) throw new Error("Failed to load appointment statuses");
      const data = await res.json();
      return data.options.map((opt: any) => ({
        value: String(opt.id),
        label: opt.label,
      }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  // ---- Fetch service options (24h cache) ----
  const { data: serviceOptions = [] } = useQuery<
    Array<{ value: string; label: string }>
  >({
    queryKey: ["service-options"],
    queryFn: async () => {
      const res = await fetch("/api/options/services");
      if (!res.ok) throw new Error("Failed to load services");
      const data = await res.json();
      return data.options.map((opt: any) => ({
        value: String(opt.id),
        label: opt.label,
      }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  // ---- Initialize default filters after options load ----
  React.useEffect(() => {
    if (
      !hasInitializedDefaults &&
      statusOptions.length > 0 &&
      serviceOptions.length > 0 &&
      statusIds.length === 0 &&
      !searchParams.get("statusIds")
    ) {
      // Default: All statuses EXCEPT "Cancelled"
      // Legacy project excluded status_id 5 (Cancelled)
      const cancelledOption = statusOptions.find((opt) =>
        opt.label.toLowerCase().includes("cancel")
      );
      const defaultStatuses = statusOptions
        .filter((opt) => opt.value !== cancelledOption?.value)
        .map((opt) => opt.value);

      if (defaultStatuses.length > 0) {
        setStatusIds(defaultStatuses);
      }

      // Default: "Departure Clean" and "Office Clean" services
      if (serviceIds.length === 0 && !searchParams.get("serviceIds")) {
        const departureClean = serviceOptions.find((opt) =>
          opt.label.toLowerCase().includes("departure clean")
        );
        const officeClean = serviceOptions.find((opt) =>
          opt.label.toLowerCase().includes("office clean")
        );
        const defaultServices = [
          departureClean?.value,
          officeClean?.value,
        ].filter(Boolean) as string[];

        if (defaultServices.length > 0) {
          setServiceIds(defaultServices);
        }
      }

      setHasInitializedDefaults(true);
    }
  }, [
    statusOptions,
    serviceOptions,
    hasInitializedDefaults,
    statusIds.length,
    serviceIds.length,
    searchParams,
  ]);

  // ---- Build filters object ----
  const filters: AppointmentFilters = React.useMemo(() => {
    // Convert Date objects to ISO string format for API
    const dateFromISO = dateRange?.from?.toISOString().split("T")[0];
    const dateToISO = dateRange?.to?.toISOString().split("T")[0];
    
    return {
      q,
      statusIds: statusIds.map(Number),
      serviceIds: serviceIds.map(Number),
      staffIds: [],
      propertyIds: [],
      taOnly: taOnly || undefined,
      dateFrom: dateFromISO || undefined,
      dateTo: dateToISO || undefined,
      nextArrivalBefore: undefined,
      nextArrivalAfter: undefined,
      page,
      pageSize,
      sort: "",
    };
  }, [q, statusIds, serviceIds, taOnly, dateRange, page, pageSize]);

  // ---- Build API URL via adapter ----
  const apiParams = React.useMemo(
    () =>
      AppointmentsAdapter.toApiParams({
        filters,
        sort,
        pagination: { page, pageSize },
      }),
    [filters, sort, page, pageSize]
  );

  const apiUrl = React.useMemo(() => {
    const qs = apiParams.toString();
    return qs
      ? `${AppointmentsAdapter.endpoint}?${qs}`
      : AppointmentsAdapter.endpoint;
  }, [apiParams]);

  // ---- Fetch appointment data ----
  const shouldFetch =
    hasInitializedDefaults || searchParams.get("statusIds") !== null;

  const { data, isLoading, error } = useQuery<AppointmentListResponse>({
    queryKey: ["appointments", apiUrl],
    queryFn: async () => {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error("Failed to load appointments");
      return res.json();
    },
    enabled: shouldFetch,
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh while on page
    refetchOnMount: "always", // Always fetch fresh data when returning to page
  });

  // ---- URL sync (skip initial render) ----
  const initialRenderRef = React.useRef(true);
  React.useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (statusIds.length) params.set("statusIds", statusIds.join(","));
    if (serviceIds.length) params.set("serviceIds", serviceIds.join(","));
    if (taOnly) params.set("taOnly", "true");
    
    // Convert Date objects to YYYY-MM-DD for URL
    if (dateRange?.from) {
      params.set("dateFrom", dateRange.from.toISOString().split("T")[0]);
    }
    if (dateRange?.to) {
      params.set("dateTo", dateRange.to.toISOString().split("T")[0]);
    }
    
    if (page > 1) params.set("page", String(page));
    if (pageSize !== 25) params.set("pageSize", String(pageSize));

    const newUrl = params.toString()
      ? `/dashboard/appointments?${params}`
      : "/dashboard/appointments";
    router.replace(newUrl, { scroll: false });
  }, [q, statusIds, serviceIds, taOnly, dateRange, page, pageSize, router]);

  // ---- Column definitions ----
  const columns: ColumnDef<AppointmentRow>[] = React.useMemo(
    () => [
      {
        accessorKey: "appointment_id",
        header: "ID",
        cell: ({ row }) => {
          const apptId = row.original.appointment_id ?? row.original.id;
          return <span className="font-mono text-sm">{apptId}</span>;
        },
      },
      {
        id: "serviceTime",
        header: "Service Time",
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {formatDateTime(row.original.departure_time)}
          </span>
        ),
      },
      {
        id: "property",
        header: "Property",
        cell: ({ row }) => {
          const info = row.original.property_info;
          if (!info)
            return <span className="text-muted-foreground text-sm">—</span>;
          return (
            <Link
              href={`/dashboard/properties/${info.properties_id}`}
              className="text-sm text-primary hover:underline"
            >
              {info.property_name}
            </Link>
          );
        },
      },
      {
        id: "staff",
        header: "Staff",
        cell: ({ row }) => <StaffListPopover staff={row.original.staff} />,
      },
      {
        id: "ta",
        header: "T/A",
        cell: ({ row }) => (
          <TurnAroundIndicator value={row.original.turn_around} />
        ),
      },
      {
        id: "nextArrivalTime",
        header: "Next Arrival",
        cell: ({ row }) => {
          const value = row.original.next_arrival_time;
          if (!value) {
            return <span className="text-muted-foreground text-sm">—</span>;
          }
          const urgent = isWithinHours(value, 2);
          const formatted = formatDateTime(value);
          if (urgent) {
            return (
              <Badge variant="destructive" className="gap-1 whitespace-nowrap">
                <Clock className="h-3 w-3" />
                {formatted}
              </Badge>
            );
          }
          return <span className="text-sm whitespace-nowrap">{formatted}</span>;
        },
      },
      {
        id: "service",
        header: "Service",
        cell: ({ row }) => {
          const info = row.original.service_info;
          if (!info)
            return <span className="text-muted-foreground text-sm">—</span>;
          return <span className="text-sm">{info.name ?? "—"}</span>;
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <AppointmentStatusBadge status={row.original.status} />
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const apptId = row.original.appointment_id ?? row.original.id;
          return (
            <Link
              href={`/dashboard/appointments/${apptId}`}
              onClick={() => saveListUrl("appointments")}
            >
              <Button variant="ghost" size="sm">
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
            </Link>
          );
        },
      },
    ],
    []
  );

  // ---- Debounced search ----
  const [searchValue, setSearchValue] = React.useState(q);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchValue);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  // ---- Clear all filters ----
  const clearFilters = () => {
    setSearchValue("");
    setQ("");
    setStatusIds([]);
    setServiceIds([]);
    setTaOnly(false);
    const today = parseLocalDate(todayString);
    setDateRange({ from: today, to: today });
    setPage(1);
  };

  const hasActiveFilters =
    q ||
    statusIds.length > 0 ||
    serviceIds.length > 0 ||
    taOnly ||
    dateRange?.from?.toISOString().split("T")[0] !== todayString ||
    dateRange?.to?.toISOString().split("T")[0] !== todayString;

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
        <p className="text-muted-foreground mt-2">
          View all appointments
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Filters</h2>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search by property</Label>
            <Input
              id="search"
              placeholder="Search appointments..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>

          {/* Status Multi-Select */}
          <div className="space-y-2">
            <Label>Status</Label>
            <StatusMultiSelect
              label="Status"
              options={statusOptions}
              value={statusIds}
              onChange={(next) => {
                setStatusIds(next);
                setPage(1);
              }}
              showBadges={false}
            />
          </div>

          {/* Service Multi-Select */}
          <div className="space-y-2">
            <Label>Service</Label>
            <ServiceMultiSelect
              label="Service"
              options={serviceOptions}
              value={serviceIds}
              onChange={(next) => {
                setServiceIds(next);
                setPage(1);
              }}
              showBadges={false}
            />
          </div>
        </div>

        {/* Date Range and T/A Filter */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="space-y-2 flex-1 max-w-md">
            <Label>Service Time Range</Label>
            <DateRangePicker
              label="Service Time"
              value={dateRange}
              onChange={(next) => {
                setDateRange(next);
                setPage(1);
              }}
            />
          </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="taOnly"
                checked={taOnly}
                onCheckedChange={(checked) => {
                  setTaOnly(checked === true);
                  setPage(1);
                }}
              />
              <Label
                htmlFor="taOnly"
                className="text-sm font-normal cursor-pointer"
              >
                Turn-around only
              </Label>
            </div>
          </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <ResultsCount
          total={data?.total ?? 0}
          loading={isLoading}
          entityName="appointments"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.items || []}
        total={data?.total}
        page={page}
        pageSize={pageSize}
        manualSorting
        loading={isLoading}
        error={error?.message}
        onChange={(change) => {
          if (change.page !== undefined) setPage(change.page);
          if (change.pageSize !== undefined) {
            setPageSize(change.pageSize);
            setPage(1);
          }
          if (change.sort !== undefined) setSort(change.sort);
        }}
      />

      {/* Pagination */}
      {data && data.total > 0 && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={data.total}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
