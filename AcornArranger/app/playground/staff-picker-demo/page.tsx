"use client";

import * as React from "react";
import StaffPicker from "@/src/features/staff/components/StaffPicker";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Page() {
  const [selected, setSelected] = React.useState<number[]>([]);
  const [canClean, setCanClean] = React.useState(true);
  const [canLeadTeam, setCanLeadTeam] = React.useState(false);
  const [activeOnly, setActiveOnly] = React.useState(true);
  const [excludePlanId, setExcludePlanId] = React.useState<string>("");

  const statusIds = React.useMemo(() => (activeOnly ? [1] : [1, 2, 3]), [activeOnly]);
  const excludePlanIdNumber = excludePlanId.trim() ? Number(excludePlanId.trim()) : undefined;

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">StaffPicker Demo</h1>
        <p className="text-sm text-muted-foreground">
          Defaults to Active + Can Clean. Toggle filters to confirm behavior and how inactive selections are shown.
        </p>
      </div>

      <div className="rounded-md border p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="can-clean"
              checked={canClean}
              onCheckedChange={(v) => setCanClean(Boolean(v))}
            />
            <Label htmlFor="can-clean">Can clean only</Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="can-lead-team"
              checked={canLeadTeam}
              onCheckedChange={(v) => setCanLeadTeam(Boolean(v))}
            />
            <Label htmlFor="can-lead-team">Can lead team only</Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="active-only"
              checked={activeOnly}
              onCheckedChange={(v) => setActiveOnly(Boolean(v))}
            />
            <Label htmlFor="active-only">Active only (statusIds=[1])</Label>
          </div>

          <div className="space-y-1">
            <Label htmlFor="exclude-plan-id">Exclude plan ID</Label>
            <Input
              id="exclude-plan-id"
              inputMode="numeric"
              placeholder="(optional) e.g. 123"
              value={excludePlanId}
              onChange={(e) => setExcludePlanId(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <StaffPicker
          label="Staff"
          placeholder="Search staff..."
          value={selected}
          onChange={setSelected}
          canClean={canClean}
          canLeadTeam={canLeadTeam}
          statusIds={statusIds}
          excludePlanId={Number.isFinite(excludePlanIdNumber) ? excludePlanIdNumber : undefined}
        />

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setSelected([])} disabled={selected.length === 0}>
            Clear selection
          </Button>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <div className="text-sm font-medium">Current selection (user_id numbers)</div>
        <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
          {JSON.stringify(selected, null, 2)}
        </pre>
      </div>
    </div>
  );
}

