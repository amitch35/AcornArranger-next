"use client";

import * as React from "react";
import { FilterBar, type FilterGroup, type FilterOption, type FilterState } from "./FilterBar";
import { Input } from "@/components/ui/input";

export type AgeBucket = "<25" | "25-34" | "35-44" | "45+";

export type AgeFilterBarValue = {
  ageBuckets: AgeBucket[];
  roles?: string[];
  minAge?: number;
};

type AgeFilterBarDemoProps = {
  value: AgeFilterBarValue;
  onChange: (next: AgeFilterBarValue) => void;
  onApply?: () => void;
  onReset?: () => void;
};

const AGE_OPTIONS: { id: AgeBucket; label: string }[] = [
  { id: "<25", label: "Under 25" },
  { id: "25-34", label: "25–34" },
  { id: "35-44", label: "35–44" },
  { id: "45+", label: "45+" },
];

export function AgeFilterBarDemo({ value, onChange, onApply, onReset }: AgeFilterBarDemoProps) {
  const [stagedMinAge, setStagedMinAge] = React.useState<string>(value.minAge ? String(value.minAge) : "");

  const groups: FilterGroup[] = [
    {
      id: "ageBuckets",
      label: "Age",
      options: AGE_OPTIONS as unknown as FilterOption[],
      searchPlaceholder: "Search ages...",
    },
    {
      id: "roles",
      label: "Role",
      options: [
        { id: "Admin", label: "Admin" },
        { id: "Manager", label: "Manager" },
        { id: "Staff", label: "Staff" },
        { id: "Guest", label: "Guest" },
      ],
      searchPlaceholder: "Search roles...",
    },
  ];

  const state: FilterState = {
    ageBuckets: value.ageBuckets,
    roles: value.roles ?? [],
  };

  const handleChange = (next: FilterState) => {
    onChange({
      ageBuckets: (next.ageBuckets ?? []) as AgeBucket[],
      roles: next.roles ?? [],
      minAge: value.minAge,
    });
  };

  return (
    <FilterBar
      groups={groups}
      value={state}
      onChange={handleChange}
      extraHasActive={typeof value.minAge === "number"}
      onApply={() => {
        const parsed = stagedMinAge.trim() === "" ? undefined : Number(stagedMinAge);
        const valid = typeof parsed === "number" && !Number.isNaN(parsed) ? parsed : undefined;
        onChange({ ...value, minAge: valid });
        onApply?.();
      }}
      onReset={() => {
        setStagedMinAge("");
        onChange({ ageBuckets: [], roles: [], minAge: undefined });
        onReset?.();
      }}
      advancedContent={(
        <div className="flex items-center gap-2">
          <label htmlFor="min-age" className="text-sm text-muted-foreground">Minimum Age (apply to commit)</label>
          <Input
            id="min-age"
            type="number"
            min={0}
            value={stagedMinAge}
            onChange={(e) => setStagedMinAge(e.target.value)}
            className="h-8 w-28"
            placeholder="e.g. 30"
          />
        </div>
      )}
    />
  );
}


