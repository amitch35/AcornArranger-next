"use client";

import * as React from "react";
import UserMultiSelect from "@/components/filters/UserMultiSelect";
import { useStaffOptions } from "@/lib/options/useStaffOptions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

export default function Page() {
  const [selected, setSelected] = React.useState<string[]>([]);
  const [filters, setFilters] = React.useState<{ canClean: boolean; statusIds: number[]; excludePlanId?: number }>({ canClean: true, statusIds: [1] });

  const { data, isLoading, isError, refetch } = useStaffOptions({
    canClean: filters.canClean,
    statusIds: filters.statusIds,
    excludePlanId: filters.excludePlanId,
  });

  const options = React.useMemo(
    () => (data?.options ?? []).map((o) => ({ label: o.label, value: String(o.id) })),
    [data]
  );

  return (
    <div className="container mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">UserMultiSelect Demo</h1>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="can-clean"
            checked={filters.canClean}
            onCheckedChange={(v) => setFilters((f) => ({ ...f, canClean: Boolean(v) }))}
          />
          <label htmlFor="can-clean" className="text-sm">Can clean only</label>
        </div>
      </div>

      {isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
          Failed to load options.
          <Button variant="secondary" onClick={() => refetch()}>Retry</Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-60" />
          <Skeleton className="h-6 w-80" />
        </div>
      ) : (
        <UserMultiSelect
          label="Users"
          placeholder="Search users..."
          options={options}
          value={selected}
          onChange={setSelected}
          canClean={filters.canClean}
          statusIds={filters.statusIds}
          excludePlanId={filters.excludePlanId}
          loadOptions={({ q, canClean, statusIds, excludePlanId }) => {
            // Update local filters based on component search and props
            setFilters((f) => ({ ...f, canClean: canClean ?? f.canClean, statusIds: statusIds ?? f.statusIds, excludePlanId }));
            // Note: q is used by the hook via the component if parent wires it to useStaffOptions
          }}
          onClearNotice={(count, labels) => {
            // eslint-disable-next-line no-console
            console.log(`Removed ${count} selections due to option changes:`, labels);
          }}
        />
      )}

      <div className="rounded-md border p-3">
        <div className="text-sm font-medium">Current selection</div>
        <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(selected, null, 2)}</pre>
      </div>
    </div>
  );
}


