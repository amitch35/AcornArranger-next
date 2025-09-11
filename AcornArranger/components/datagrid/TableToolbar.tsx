"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TableToolbarProps<TData> = {
  table: Table<TData>;
  onSearch?: (value: string) => void;
  creating?: boolean;
  onCreate?: () => void;
};

export function TableToolbar<TData>({ table, onSearch, creating, onCreate }: TableToolbarProps<TData>) {
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    const id = setTimeout(() => onSearch?.(query), 300);
    return () => clearTimeout(id);
  }, [query, onSearch]);

  return (
    <div className="flex w-full items-center gap-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        aria-label="Search"
        className="max-w-xs"
      />
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Columns</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table.getAllLeafColumns().map((column) => {
              if (column.columnDef.enableHiding === false) return null;
              const header = column.columnDef.header as unknown;
              const metaLabel = (column.columnDef as any)?.meta?.label as string | undefined;
              const label =
                typeof header === "string"
                  ? header
                  : metaLabel ?? column.id;
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(v) => column.toggleVisibility(!!v)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        {typeof onCreate === "function" ? (
          <Button onClick={onCreate} disabled={creating} variant="default">
            Create
          </Button>
        ) : null}
      </div>
    </div>
  );
}



