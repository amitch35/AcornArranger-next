"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Table as TanStackTable } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

export type DataTableChange = {
  page?: number;
  pageSize?: number;
  sort?: { id: string; desc: boolean }[];
  filters?: Record<string, unknown>;
};

export type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  total?: number;
  page?: number;
  pageSize?: number;
  loading?: boolean;
  error?: string | null;
  onChange?: (change: DataTableChange) => void;
  initialSorting?: SortingState;
  initialVisibility?: VisibilityState;
  /**
   * When true, sorting is assumed to be handled externally (e.g., server-side).
   * The table will still track sort state for UI/ARIA and emit `onChange`,
   * but it will NOT sort rows client-side.
   */
  manualSorting?: boolean;
  renderToolbar?: (table: TanStackTable<TData>) => React.ReactNode;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  total,
  page = 1,
  pageSize = 25,
  loading,
  error,
  onChange,
  initialSorting,
  initialVisibility,
  manualSorting = false,
  renderToolbar,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting ?? []);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialVisibility ?? {});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnFilters },
    manualSorting,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(next);
      onChange?.({ sort: next.map((s) => ({ id: s.id, desc: s.desc })) });
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="w-full overflow-hidden rounded-md border" aria-busy={!!loading}>
      {renderToolbar ? (
        <div className="flex items-center justify-between gap-2 border-b p-3">
          {renderToolbar(table)}
        </div>
      ) : null}
      <div aria-live="polite" className="sr-only">
        {loading ? "Loading table" : `${table.getRowModel().rows.length} rows`}
      </div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort?.() ?? false;
                const headerDef = header.column.columnDef.header;
                const isDefaultHeader =
                  typeof headerDef === "string" || typeof headerDef === "undefined";
                const sorted = header.column.getIsSorted?.();
                const sortDir = sorted === "desc" ? "desc" : sorted === "asc" ? "asc" : null;

                const headerContent = header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext());

                const renderDefaultSortableHeader =
                  canSort && isDefaultHeader && typeof headerContent === "string"
                    ? (
                        <Button
                          variant="ghost"
                          className="-ml-2 h-8 px-2 py-1 text-left font-medium"
                          onClick={() => header.column.toggleSorting(sortDir === "asc")}
                        >
                          <span className="mr-1">{headerContent}</span>
                          <span aria-hidden="true" className="inline-flex items-center text-muted-foreground">
                            {sortDir === "asc" ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : sortDir === "desc" ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronsUpDown className="h-4 w-4" />
                            )}
                          </span>
                        </Button>
                      )
                    : headerContent;

                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      sorted
                        ? (sorted === "desc" ? "descending" : "ascending")
                        : "none"
                    }
                  >
                    {renderDefaultSortableHeader}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: Math.min(pageSize, 10) }).map((_, idx) => (
              <TableRow key={`sk-${idx}`}>
                {columns.map((_, cIdx) => (
                  <TableCell key={`skc-${idx}-${cIdx}`}>
                    <Skeleton className="h-5 w-full" aria-hidden />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell role="status" colSpan={columns.length} className="h-24 text-center">
                {error ? error : "No results"}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {/* Pagination is handled by parent via onChange; dedicated component in 13.2 */}
    </div>
  );
}


