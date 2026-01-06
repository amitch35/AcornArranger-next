"use client";

import * as React from "react";
import PropertyMultiSelect from "@/components/filters/PropertyMultiSelect";
import { usePropertyOptions } from "@/lib/options/usePropertyOptions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export default function Page() {
  const [selected, setSelected] = React.useState<string[]>([]);
  const [filters, setFilters] = React.useState<{ q: string; city: string; onlyActive: boolean }>({ q: "", city: "", onlyActive: false });

  const { data, isLoading, isError, refetch } = usePropertyOptions({
    q: filters.q || undefined,
    city: filters.city || undefined,
    statusIds: filters.onlyActive ? [1] : undefined,
    limit: 1000, // Fetch all properties for dropdown (no pagination)
  });

  const options = React.useMemo(
    () => (data?.options ?? []).map((o) => ({ label: o.label, value: String(o.id) })),
    [data]
  );

  return (
    <div className="container mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">PropertyMultiSelect Demo</h1>
      <p className="text-sm text-muted-foreground">Options loaded from /api/options/properties via usePropertyOptions().</p>

      {isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
          Failed to load options.
          <Button variant="secondary" onClick={() => refetch()}>Retry</Button>
        </div>
      )}

      {/* Controls to demonstrate city filter and active-only toggle */}
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm">City filter</label>
          <Input
            placeholder="e.g. San"
            value={filters.city}
            onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="only-active"
            checked={filters.onlyActive}
            onCheckedChange={(v) => setFilters((f) => ({ ...f, onlyActive: Boolean(v) }))}
          />
          <label htmlFor="only-active" className="text-sm">Only active</label>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-60" />
          <Skeleton className="h-6 w-80" />
        </div>
      ) : (
        <PropertyMultiSelect
          label="Properties"
          placeholder="Search properties..."
          options={options}
          value={selected}
          onChange={setSelected}
          // Pass filters so the component can request updates
          city={filters.city || undefined}
          onlyActive={filters.onlyActive}
          loadOptions={({ q, city }) => {
            // Update q from internal search input; city is forwarded (already controlled above)
            setFilters((f) => ({ ...f, q: q ?? "", city: city ?? f.city }));
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

