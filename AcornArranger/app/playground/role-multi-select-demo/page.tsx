"use client";

import * as React from "react";
import RoleMultiSelect from "@/components/filters/RoleMultiSelect";
import { useRoleOptions } from "@/lib/options/useRoleOptions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  const [selected, setSelected] = React.useState<string[]>([]);
  const { data, isLoading, isError, refetch } = useRoleOptions();

  const options = React.useMemo(
    () => (data?.options ?? []).map((o) => ({ label: o.label, value: String(o.id) })),
    [data]
  );

  return (
    <div className="container mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">RoleMultiSelect Demo</h1>
      <p className="text-sm text-muted-foreground">Options loaded from /api/options/roles via useRoleOptions().</p>

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
        <RoleMultiSelect
          label="Roles"
          placeholder="Search roles..."
          options={options}
          value={selected}
          onChange={setSelected}
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


