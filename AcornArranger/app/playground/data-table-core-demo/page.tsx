"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/datagrid/DataTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Person = {
  id: number;
  name: string;
  email: string;
  age: number;
};

const demoData: Person[] = [
  { id: 1, name: "Alice", email: "alice@example.com", age: 31 },
  { id: 2, name: "Bob", email: "bob@example.com", age: 27 },
  { id: 3, name: "Carol", email: "carol@example.com", age: 36 },
  { id: 4, name: "Dave", email: "dave@example.com", age: 29 },
];

const columns: ColumnDef<Person>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => (
      <button
        className="text-left font-medium"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        ID
      </button>
    ),
    cell: ({ row }) => <span>{row.original.id}</span>,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <button
        className="text-left font-medium"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Name
      </button>
    ),
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <button
        className="text-left font-medium"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Email
      </button>
    ),
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span>,
  },
  {
    accessorKey: "age",
    header: ({ column }) => (
      <button
        className="text-left font-medium"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Age
      </button>
    ),
    cell: ({ row }) => <span>{row.original.age}</span>,
  },
];

export default function DataTableCoreDemoPage() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

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
      <DataTable<Person, unknown>
        columns={columns}
        data={error ? [] : demoData}
        total={demoData.length}
        page={page}
        pageSize={pageSize}
        loading={loading}
        error={error}
        onChange={(change) => {
          if (typeof change.page === "number") setPage(change.page);
          if (typeof change.pageSize === "number") setPageSize(change.pageSize);
        }}
      />
      <p className="text-sm text-muted-foreground">Sorting is toggled by clicking column headers. Pagination controls will be added in Task 13.2.</p>
    </div>
  );
}


