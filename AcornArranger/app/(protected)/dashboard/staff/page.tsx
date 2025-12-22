"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/datagrid/DataTable";
import { TablePagination } from "@/components/datagrid/TablePagination";
import { RoleMultiSelect } from "@/components/filters/RoleMultiSelect";
import { StatusMultiSelect } from "@/components/filters/StatusMultiSelect";
import { StaffAdapter } from "@/src/adapters/Staff";
import type { StaffFilters } from "@/lib/filters/schemas";
import type { Staff } from "@/src/features/staff/schemas";
import { Check, X, Eye } from "lucide-react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

/**
 * Staff List Page
 * 
 * Displays all staff members with comprehensive filtering:
 * - Search by name
 * - Filter by role (multi-select)
 * - Filter by status (Active, Inactive, Unverified - multi-select)
 * - Filter by capabilities (Can Clean, Can Lead Team)
 * 
 * Columns: User ID, Name, First Name, Last Name, Role, Status, Can Clean, Can Lead Team, Actions
 */

type StaffListResponse = {
  items: Staff[];
  total: number;
};

// Status badge component
function StatusBadge({ status }: { status: Staff["status"] }) {
  if (!status) return <span className="text-muted-foreground text-sm">—</span>;
  
  const variant = status.status === "Active" 
    ? "default" 
    : status.status === "Inactive" 
    ? "secondary" 
    : "outline";
    
  return <Badge variant={variant}>{status.status}</Badge>;
}

// Capability indicator
function CapabilityCheck({ value }: { value: boolean }) {
  return value ? (
    <Check className="h-4 w-4 text-green-600" aria-label="Yes" />
  ) : (
    <X className="h-4 w-4 text-muted-foreground" aria-label="No" />
  );
}

export default function StaffListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse filters from URL
  const [q, setQ] = React.useState(searchParams.get("q") || "");
  const [statusIds, setStatusIds] = React.useState<string[]>(
    searchParams.get("statusIds")?.split(",").filter(Boolean) || []
  );
  const [roleIds, setRoleIds] = React.useState<string[]>(
    searchParams.get("roleIds")?.split(",").filter(Boolean) || []
  );
  const [canClean, setCanClean] = React.useState(
    searchParams.get("canClean") === "true"
  );
  const [canLeadTeam, setCanLeadTeam] = React.useState(
    searchParams.get("canLeadTeam") === "true"
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

  // Fetch role options
  const { data: roleOptions = [] } = useQuery<Array<{ value: string; label: string }>>({
    queryKey: ["roles-options"],
    queryFn: async () => {
      const res = await fetch("/api/options/roles");
      if (!res.ok) throw new Error("Failed to load roles");
      const data = await res.json();
      return data.options.map((opt: any) => ({
        value: String(opt.id),
        label: opt.label,
      }));
    },
  });

  // Status options (hardcoded based on staff_status_key table)
  const statusOptions = [
    { value: "1", label: "Active" },
    { value: "2", label: "Inactive" },
    { value: "3", label: "Unverified" },
  ];

  // Build filters object
  const filters: StaffFilters = React.useMemo(
    () => ({
      q,
      statusIds: statusIds.map(Number),
      roleIds: roleIds.map(Number),
      canClean: canClean || undefined,
      canLeadTeam: canLeadTeam || undefined,
      // Other filters not used for staff list
      serviceIds: [],
      staffIds: [],
      propertyIds: [],
      page,
      pageSize,
      sort: "",
      dateFrom: undefined,
      dateTo: undefined,
    }),
    [q, statusIds, roleIds, canClean, canLeadTeam, page, pageSize]
  );

  // Build API URL using adapter
  const apiParams = React.useMemo(
    () => StaffAdapter.toApiParams({ filters, sort, pagination: { page, pageSize } }),
    [filters, sort, page, pageSize]
  );

  const apiUrl = React.useMemo(() => {
    const qs = apiParams.toString();
    return qs ? `${StaffAdapter.endpoint}?${qs}` : StaffAdapter.endpoint;
  }, [apiParams]);

  // Fetch staff data
  const {
    data,
    isLoading,
    error,
  } = useQuery<StaffListResponse>({
    queryKey: ["staff", apiUrl],
    queryFn: async () => {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error("Failed to load staff");
      return res.json();
    },
  });

  // Update URL when filters change
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (statusIds.length) params.set("statusIds", statusIds.join(","));
    if (roleIds.length) params.set("roleIds", roleIds.join(","));
    if (canClean) params.set("canClean", "true");
    if (canLeadTeam) params.set("canLeadTeam", "true");
    if (page > 1) params.set("page", String(page));
    if (pageSize !== 25) params.set("pageSize", String(pageSize));
    
    const newUrl = params.toString() ? `/dashboard/staff?${params}` : "/dashboard/staff";
    router.replace(newUrl, { scroll: false });
  }, [q, statusIds, roleIds, canClean, canLeadTeam, page, pageSize, router]);

  // Define columns
  const columns: ColumnDef<Staff>[] = React.useMemo(
    () => [
      {
        accessorKey: "user_id",
        header: "ID",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.user_id}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => row.original.name || "—",
      },
      {
        accessorKey: "first_name",
        header: "First Name",
        cell: ({ row }) => row.original.first_name || "—",
      },
      {
        accessorKey: "last_name",
        header: "Last Name",
        cell: ({ row }) => row.original.last_name || "—",
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => row.original.role?.title || "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "can_clean",
        header: "Can Clean",
        cell: ({ row }) => (
          <CapabilityCheck value={row.original.role?.can_clean ?? false} />
        ),
      },
      {
        id: "can_lead_team",
        header: "Can Lead Team",
        cell: ({ row }) => (
          <CapabilityCheck value={row.original.role?.can_lead_team ?? false} />
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Link href={`/dashboard/staff/${row.original.user_id}`}>
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

  // Clear all filters
  const clearFilters = () => {
    setSearchValue("");
    setQ("");
    setStatusIds([]);
    setRoleIds([]);
    setCanClean(false);
    setCanLeadTeam(false);
    setPage(1);
  };

  const hasActiveFilters =
    q ||
    statusIds.length > 0 ||
    roleIds.length > 0 ||
    canClean ||
    canLeadTeam;

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Staff</h1>
        <p className="text-muted-foreground mt-2">
          Manage and view all staff members
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
            <Label htmlFor="search">Search by name</Label>
            <Input
              id="search"
              placeholder="Search staff..."
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

          {/* Role Multi-Select */}
          <div className="space-y-2">
            <Label>Role</Label>
            <RoleMultiSelect
              label="Roles"
              options={roleOptions}
              value={roleIds}
              onChange={(next) => {
                setRoleIds(next);
                setPage(1);
              }}
              showBadges={false}
            />
          </div>
        </div>

        {/* Capability Checkboxes */}
        <div className="flex items-center gap-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="canClean"
              checked={canClean}
              onCheckedChange={(checked) => {
                setCanClean(checked === true);
                setPage(1);
              }}
            />
            <Label
              htmlFor="canClean"
              className="text-sm font-normal cursor-pointer"
            >
              Can Clean
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="canLeadTeam"
              checked={canLeadTeam}
              onCheckedChange={(checked) => {
                setCanLeadTeam(checked === true);
                setPage(1);
              }}
            />
            <Label
              htmlFor="canLeadTeam"
              className="text-sm font-normal cursor-pointer"
            >
              Can Lead Team
            </Label>
          </div>
        </div>
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
