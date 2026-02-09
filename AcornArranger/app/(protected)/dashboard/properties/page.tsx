"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DataTable } from "@/components/datagrid/DataTable";
import { TablePagination } from "@/components/datagrid/TablePagination";
import { ResultsCount } from "@/components/datagrid/ResultsCount";
import { StatusMultiSelect } from "@/components/filters/StatusMultiSelect";
import DurationPicker from "@/components/filters/DurationPicker";
import { PropertyAdapter } from "@/src/adapters/Property";
import type { PropertyRow } from "@/src/features/properties/schemas";
import { formatMinutes } from "@/src/features/properties/schemas";
import { Eye } from "lucide-react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

/**
 * Properties List Page
 * 
 * Displays all properties with comprehensive filtering:
 * - Search by property name
 * - Filter by city (prefix match)
 * - Filter by status (multi-select)
 * - Filter by cleaning time range (min/max minutes)
 * 
 * Columns: ID, Property Name, City, State, Status, Cleaning Time, Double Unit Count, Actions
 */

type PropertyListResponse = {
  items: PropertyRow[];
  total: number;
};

// Status badge component
function StatusBadge({ status }: { status: PropertyRow["status"] }) {
  if (!status) return <span className="text-muted-foreground text-sm">—</span>;
  
  const variant = status.status === "Active" 
    ? "default" 
    : status.status === "Inactive" 
    ? "secondary" 
    : "outline";
    
  return <Badge variant={variant}>{status.status}</Badge>;
}

// Linked units popover component
function LinkedUnitsPopover({ linkedIds }: { linkedIds: number[] }) {
  const [open, setOpen] = React.useState(false);

  // Fetch linked property details when popover opens
  const { data: linkedProperties, isLoading } = useQuery<PropertyRow[]>({
    queryKey: ["linked-properties", ...linkedIds.sort()],
    queryFn: async () => {
      // Fetch each property individually (they'll be cached by React Query)
      const promises = linkedIds.map(async (id) => {
        try {
          const res = await fetch(`/api/properties/${id}`);
          if (!res.ok) return null;
          return await res.json();
        } catch {
          return null;
        }
      });
      const results = await Promise.all(promises);
      return results.filter((p): p is PropertyRow => p !== null);
    },
    enabled: open && linkedIds.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const count = linkedIds.length;
  
  if (count === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 font-mono">
          {count}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Linked Double Units ({count})</h4>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : linkedProperties && linkedProperties.length > 0 ? (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {linkedProperties.map((prop) => (
                <Link
                  key={prop.properties_id}
                  href={`/dashboard/properties/${prop.properties_id}`}
                  className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-accent transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <Badge variant="secondary" className="font-mono text-xs shrink-0">
                    #{prop.properties_id}
                  </Badge>
                  <span className="flex-1 truncate">{prop.property_name}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No linked properties found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function PropertiesListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse filters from URL
  const [q, setQ] = React.useState(searchParams.get("q") || "");
  const [city, setCity] = React.useState(searchParams.get("city") || "");
  const [statusIds, setStatusIds] = React.useState<string[]>(
    searchParams.get("statusIds")?.split(",").filter(Boolean) || []
  );
  const [hasInitializedDefaults, setHasInitializedDefaults] = React.useState(false);
  const [cleaningTimeMin, setCleaningTimeMin] = React.useState<number | null>(
    searchParams.get("cleaningTimeMin")
      ? Number(searchParams.get("cleaningTimeMin"))
      : null
  );
  const [cleaningTimeMax, setCleaningTimeMax] = React.useState<number | null>(
    searchParams.get("cleaningTimeMax")
      ? Number(searchParams.get("cleaningTimeMax"))
      : null
  );
  const [page, setPage] = React.useState(
    Number(searchParams.get("page")) || 1
  );
  const [pageSize, setPageSize] = React.useState(
    Number(searchParams.get("pageSize")) || 25
  );
  const [sort, setSort] = React.useState<Array<{ id: string; desc: boolean }>>(
    []
  );

  // Fetch property status options from API
  const { data: statusOptions = [] } = useQuery<Array<{ value: string; label: string }>>({
    queryKey: ["property-status-options"],
    queryFn: async () => {
      const res = await fetch("/api/options/property-status");
      if (!res.ok) throw new Error("Failed to load property statuses");
      const data = await res.json();
      return data.options.map((opt: any) => ({
        value: String(opt.id),
        label: opt.label,
      }));
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - status options rarely change
  });

  // Set default status selection on initial load (Active only)
  React.useEffect(() => {
    if (!hasInitializedDefaults && statusOptions.length > 0 && statusIds.length === 0 && !searchParams.get("statusIds")) {
      const activeOption = statusOptions.find(opt => opt.label === "Active");
      if (activeOption) {
        setStatusIds([activeOption.value]);
      }
      setHasInitializedDefaults(true);
    }
  }, [statusOptions, hasInitializedDefaults, statusIds.length, searchParams]);

  // Build filters object
  const filters = React.useMemo(
    () => ({
      q,
      city,
      statusIds: statusIds.map(Number),
      cleaningTimeMin: cleaningTimeMin ?? undefined,
      cleaningTimeMax: cleaningTimeMax ?? undefined,
      page,
      pageSize,
    }),
    [q, city, statusIds, cleaningTimeMin, cleaningTimeMax, page, pageSize]
  );

  // Build API URL using adapter
  const apiParams = React.useMemo(
    () => PropertyAdapter.toApiParams({ filters, sort, pagination: { page, pageSize } }),
    [filters, sort, page, pageSize]
  );

  const apiUrl = React.useMemo(() => {
    const qs = apiParams.toString();
    return qs ? `${PropertyAdapter.endpoint}?${qs}` : PropertyAdapter.endpoint;
  }, [apiParams]);

  // Fetch properties data (wait for defaults to initialize to avoid double-fetch)
  const shouldFetchProperties = hasInitializedDefaults || searchParams.get("statusIds") !== null;
  
  const {
    data,
    isLoading,
    error,
  } = useQuery<PropertyListResponse>({
    queryKey: ["properties", apiUrl],
    queryFn: async () => {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error("Failed to load properties");
      return res.json();
    },
    enabled: shouldFetchProperties,
  });

  // Update URL when filters change (skip on initial load before defaults)
  const initialRenderRef = React.useRef(true);
  React.useEffect(() => {
    // Skip URL update on very first render to avoid race with defaults
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (city) params.set("city", city);
    if (statusIds.length) params.set("statusIds", statusIds.join(","));
    if (cleaningTimeMin !== null) params.set("cleaningTimeMin", String(cleaningTimeMin));
    if (cleaningTimeMax !== null) params.set("cleaningTimeMax", String(cleaningTimeMax));
    if (page > 1) params.set("page", String(page));
    if (pageSize !== 25) params.set("pageSize", String(pageSize));
    
    const newUrl = params.toString() ? `/dashboard/properties?${params}` : "/dashboard/properties";
    router.replace(newUrl, { scroll: false });
  }, [q, city, statusIds, cleaningTimeMin, cleaningTimeMax, page, pageSize, router]);

  // Define columns
  const columns: ColumnDef<PropertyRow>[] = React.useMemo(
    () => [
      {
        accessorKey: "properties_id",
        header: "ID",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.properties_id}</span>
        ),
      },
      {
        accessorKey: "property_name",
        header: "Property Name",
        cell: ({ row }) => row.original.property_name || "—",
      },
      {
        id: "city",
        header: "City",
        cell: ({ row }) => row.original.address?.city || "—",
      },
      {
        id: "state",
        header: "State",
        cell: ({ row }) => row.original.address?.state_name || "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "estimated_cleaning_mins",
        header: "Cleaning Time",
        cell: ({ row }) => {
          const mins = row.original.estimated_cleaning_mins;
          if (mins === null || mins === undefined) {
            return <span className="text-muted-foreground text-sm">—</span>;
          }
          return (
            <div className="flex flex-col">
              <span className="text-sm">{formatMinutes(mins)}</span>
              <span className="text-xs text-muted-foreground">{mins} min</span>
            </div>
          );
        },
      },
      {
        id: "double_unit_count",
        header: "Linked Units",
        cell: ({ row }) => {
          const linkedIds = row.original.double_unit ?? [];
          return <LinkedUnitsPopover linkedIds={linkedIds} />;
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Link href={`/dashboard/properties/${row.original.properties_id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          </Link>
        ),
      },
    ],
    []
  );

  // Handle search with debounce
  const [searchValue, setSearchValue] = React.useState(q);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchValue);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  // Handle city filter with debounce
  const [cityValue, setCityValue] = React.useState(city);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setCity(cityValue);
      setPage(1); // Reset to first page on city change
    }, 300);
    return () => clearTimeout(timer);
  }, [cityValue]);

  // Clear all filters
  const clearFilters = () => {
    setSearchValue("");
    setQ("");
    setCityValue("");
    setCity("");
    setStatusIds([]);
    setCleaningTimeMin(null);
    setCleaningTimeMax(null);
    setPage(1);
  };

  const hasActiveFilters =
    q ||
    city ||
    statusIds.length > 0 ||
    cleaningTimeMin !== null ||
    cleaningTimeMax !== null;

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
        <p className="text-muted-foreground mt-2">
          View and manage property settings
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
          {/* Search by property name */}
          <div className="space-y-2">
            <Label htmlFor="search">Search by name</Label>
            <Input
              id="search"
              placeholder="Search properties..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>

          {/* City filter */}
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="Filter by city..."
              value={cityValue}
              onChange={(e) => setCityValue(e.target.value)}
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
        </div>

        {/* Cleaning time range filters */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Cleaning Time Range</h3>
            <p className="text-xs text-muted-foreground">Filters apply automatically</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="cleaning-time-min">Minimum</Label>
              <DurationPicker
                aria-label="Minimum cleaning time"
                valueMinutes={cleaningTimeMin}
                onChange={(value) => {
                  setCleaningTimeMin(value);
                  setPage(1);
                }}
                placeholder="—"
                stepMinutes={15}
                showDropdowns
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="cleaning-time-max">Maximum</Label>
              <DurationPicker
                aria-label="Maximum cleaning time"
                valueMinutes={cleaningTimeMax}
                onChange={(value) => {
                  setCleaningTimeMax(value);
                  setPage(1);
                }}
                placeholder="—"
                stepMinutes={15}
                showDropdowns
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <ResultsCount
          total={data?.total ?? 0}
          loading={isLoading}
          entityName="properties"
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
