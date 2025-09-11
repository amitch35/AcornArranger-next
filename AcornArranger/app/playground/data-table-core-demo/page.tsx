"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/datagrid/DataTable";
import { TableToolbar } from "@/components/datagrid/TableToolbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TablePagination } from "@/components/datagrid/TablePagination";
import { AgeFilterBarDemo, type AgeFilterBarValue } from "@/components/filters/AgeFilterBarDemo";

type Person = {
  id: number;
  name: string;
  email: string;
  age: number;
  role: "Admin" | "Manager" | "Staff" | "Guest";
};

const roles = ["Admin", "Manager", "Staff", "Guest"] as const;
const demoData: Person[] = Array.from({ length: 75 }, (_, i) => {
  const id = i + 1;
  return {
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
    age: 20 + ((i * 7) % 40),
    role: roles[i % roles.length],
  } satisfies Person;
});

const columns: ColumnDef<Person>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="h-auto p-0 text-left font-medium"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        ID
      </Button>
    ),
    cell: ({ row }) => <span>{row.original.id}</span>,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="h-auto p-0 text-left font-medium"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Name
      </Button>
    ),
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="h-auto p-0 text-left font-medium"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Email
      </Button>
    ),
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span>,
  },
  {
    accessorKey: "age",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="h-auto p-0 text-left font-medium"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Age
      </Button>
    ),
    cell: ({ row }) => <span>{row.original.age}</span>,
  },
  {
    accessorKey: "role",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="h-auto p-0 text-left font-medium"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Role
      </Button>
    ),
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.role}</span>,
  },
];

export default function DataTableCoreDemoPage() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [sort, setSort] = React.useState<Array<{ id: string; desc: boolean }>>([]);
  const [search, setSearch] = React.useState("");
  const [filters, setFilters] = React.useState<AgeFilterBarValue>({ ageBuckets: [], roles: [] });

  const sorted = React.useMemo(() => {
    if (error) return [] as Person[];
    const q = search.trim().toLowerCase();
    let base = demoData;
    if (q) {
      base = base.filter((p) =>
        [String(p.id), p.name, p.email, String(p.age)].join(" ").toLowerCase().includes(q),
      );
    }
    if (filters.ageBuckets.length) {
      base = base.filter((p) => {
        const age = p.age;
        return filters.ageBuckets.some((b) =>
          (b === "<25" && age < 25) ||
          (b === "25-34" && age >= 25 && age <= 34) ||
          (b === "35-44" && age >= 35 && age <= 44) ||
          (b === "45+" && age >= 45),
        );
      });
    }
    if (filters.roles && filters.roles.length) {
      base = base.filter((p) => filters.roles!.includes(p.role));
    }
    if (typeof filters.minAge === "number") {
      base = base.filter((p) => p.age >= filters.minAge!);
    }
    if (!sort.length) return base;
    const copy = [...base];
    copy.sort((a, b) => {
      for (const s of sort) {
        const key = s.id as keyof Person;
        const av = a[key] as unknown as string | number;
        const bv = b[key] as unknown as string | number;
        let cmp = 0;
        if (typeof av === "number" && typeof bv === "number") {
          cmp = av - bv;
        } else {
          cmp = String(av).localeCompare(String(bv));
        }
        if (cmp !== 0) return s.desc ? -cmp : cmp;
      }
      return 0;
    });
    return copy;
  }, [sort, error, search, filters]);

  const paged = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return sorted.slice(start, end);
  }, [page, pageSize, sorted]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">DataTable Core Demo</h1>
      <div className="flex items-center gap-2">
        <Button
          variant={loading ? "secondary" : "default"}
          onClick={() => setLoading((v) => !v)}
        >
          {loading ? "Disable" : "Enable"} Loading
        </Button>
        <Button
          variant={error ? "secondary" : "default"}
          onClick={() => setError((e) => (e ? null : "Example error state"))}
        >
          {error ? "Clear" : "Trigger"} Error
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <AgeFilterBarDemo
        value={filters}
        onChange={(f) => setFilters(f)}
        onApply={() => setPage(1)}
        onReset={() => { setFilters({ ageBuckets: [], roles: [] }); setPage(1); }}
      />
      <DataTable<Person, unknown>
        columns={columns}
        data={paged}
        total={sorted.length}
        page={page}
        pageSize={pageSize}
        loading={loading}
        error={error}
        renderToolbar={(table) => (
          <TableToolbar table={table} onSearch={(q) => { setPage(1); setSearch(q); }} />
        )}
        onChange={(change) => {
          if (typeof change.page === "number") setPage(change.page);
          if (typeof change.pageSize === "number") setPageSize(change.pageSize);
          if (change.sort) {
            setSort(change.sort);
            setPage(1);
          }
        }}
      />
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={sorted.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
      <p className="text-sm text-muted-foreground">Sorting is toggled by clicking column headers. Pagination controls are added. Search is debounced. Columns can be toggled.</p>
    </div>
  );
}


