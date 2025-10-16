"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { TablePagination } from "@/components/datagrid/TablePagination";
import { StaffAdapter } from "@/src/adapters/Staff";

export default function StaffAdapterDemo() {
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [sort, setSort] = React.useState<Array<{ id: string; desc: boolean }>>([]);

  const params = React.useMemo(() => StaffAdapter.toApiParams({
    filters: { q, page, pageSize, sort: "", statusIds: [], serviceIds: [], staffIds: [], propertyIds: [], dateFrom: undefined, dateTo: undefined },
    sort,
    pagination: { page, pageSize },
  }), [q, page, pageSize, sort]);

  const url = React.useMemo(() => {
    const qs = params.toString();
    return qs ? `${StaffAdapter.endpoint}?${qs}` : StaffAdapter.endpoint;
  }, [params]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Staff Adapter Demo</h1>
      <div className="flex items-center gap-2">
        <Input placeholder="Search (q)" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        <Button variant="secondary" onClick={() => setSort((s) => s.length ? [] : [{ id: "name", desc: false }])}>
          {sort.length ? "Clear sort" : "Sort by name asc"}
        </Button>
      </div>
      <div className="text-sm text-muted-foreground break-all">{url}</div>
      <Separator />
      <TablePagination page={page} pageSize={pageSize} total={280} onPageChange={setPage} onPageSizeChange={setPageSize} />
      <p className="text-sm text-muted-foreground">This demo shows the computed API URL using the adapter.</p>
    </div>
  );
}


