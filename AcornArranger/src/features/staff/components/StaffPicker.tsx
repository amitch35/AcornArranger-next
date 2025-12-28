"use client";

import * as React from "react";
import { useQueries } from "@tanstack/react-query";
import { useStaffOptions } from "@/lib/options/useStaffOptions";
import { fetchStaffDetail, getStaffDisplayName } from "@/src/features/staff/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type StaffPickerValue = number[];

type StaffPickerProps = {
  label?: string;
  placeholder?: string;
  value: StaffPickerValue;
  onChange: (next: StaffPickerValue) => void;
  disabled?: boolean;
  className?: string;

  // Filters (default per Task 3.7)
  statusIds?: number[]; // default [1]
  canClean?: boolean; // default true
  canLeadTeam?: boolean;
  excludePlanId?: number;
};

type StaffOption = {
  id: string; // user_id
  label: string;
  status?: "Active" | "Inactive" | "Unverified";
};

function getStatusBadgeVariant(status: StaffOption["status"]) {
  switch (status) {
    case "Active":
      return "default";
    case "Inactive":
      return "secondary";
    case "Unverified":
      return "outline";
    default:
      return "outline";
  }
}

export function StaffPicker({
  label = "Staff",
  placeholder = "Search staff...",
  value,
  onChange,
  disabled,
  className,
  statusIds = [1],
  canClean = true,
  canLeadTeam,
  excludePlanId,
}: StaffPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const [q, setQ] = React.useState<string | undefined>(undefined);

  // Debounce q for remote search
  React.useEffect(() => {
    const t = setTimeout(() => setQ(searchValue.trim() || undefined), 300);
    return () => clearTimeout(t);
  }, [searchValue]);

  const selectedIds = React.useMemo(() => value.map(String), [value]);
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  const { data, isLoading, isError, refetch } = useStaffOptions({
    q,
    statusIds,
    canClean,
    canLeadTeam,
    excludePlanId,
    pageSize: 50,
    page: 1,
  });

  // Convert option list to strings for UI
  const baseOptions: StaffOption[] = React.useMemo(() => {
    const raw = data?.options ?? [];
    return raw.map((o) => ({
      id: String(o.id),
      label: String(o.label),
    }));
  }, [data]);

  // If any selected staff are non-active (or simply missing from active-filtered options),
  // fetch their details and show them distinctly rather than dropping selection.
  const baseIdSet = React.useMemo(() => new Set(baseOptions.map((o) => o.id)), [baseOptions]);
  const missingSelected = React.useMemo(
    () => selectedIds.filter((id) => !baseIdSet.has(id)),
    [selectedIds, baseIdSet]
  );

  const missingQueries = useQueries({
    queries: missingSelected.map((id) => ({
      queryKey: ["staff", id],
      queryFn: () => fetchStaffDetail(id),
      enabled: Boolean(id),
    })),
  });

  const missingOptions: StaffOption[] = React.useMemo(() => {
    return missingQueries
      .map((q, idx) => {
        const id = missingSelected[idx];
        if (!id) return null;
        const staff = q.data as any | undefined;
        if (!staff) {
          // Still show the ID so the selection remains visible
          return { id, label: id, status: undefined };
        }
        const name = getStaffDisplayName(staff) || String(staff.user_id ?? id);
        const status = staff?.status?.status as StaffOption["status"] | undefined;
        return { id, label: name, status };
      })
      .filter(Boolean) as StaffOption[];
  }, [missingQueries, missingSelected]);

  const options: StaffOption[] = React.useMemo(() => {
    if (missingOptions.length === 0) return baseOptions;
    // Put missing (often non-active) selections at the top so they remain obvious.
    const merged = [...missingOptions, ...baseOptions];
    // De-dupe by id
    const seen = new Set<string>();
    return merged.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
  }, [baseOptions, missingOptions]);

  const selectedLabels = React.useMemo(
    () => options.filter((o) => selectedSet.has(o.id)).map((o) => o.label),
    [options, selectedSet]
  );

  const toggle = (id: string) => {
    const next = selectedSet.has(id)
      ? value.filter((v) => String(v) !== id)
      : [...value, Number(id)];
    onChange(next);
  };

  const clearAll = () => onChange([]);

  const summary =
    selectedLabels.length === 0
      ? label
      : selectedLabels.length === 1
        ? `${label}: ${selectedLabels[0]}`
        : `${label}: ${selectedLabels.length} selected`;

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              aria-haspopup="listbox"
              aria-expanded={open}
              disabled={disabled}
              className="gap-2"
            >
              {summary}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[420px] p-0" align="start">
            <Command>
              {statusIds.length === 1 && statusIds[0] === 1 ? (
                <div className="flex items-center justify-end px-3 pt-3">
                  <Badge variant="outline" className="h-5 px-2 text-[11px] text-muted-foreground">
                    Showing Active staff only
                  </Badge>
                </div>
              ) : null}
              <CommandInput
                placeholder={placeholder}
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandList role="listbox">
                <CommandEmpty>
                  {isError ? (
                    <div className="flex items-center justify-between gap-2 px-2">
                      <span>Failed to load staff.</span>
                      <Button size="sm" variant="secondary" onClick={() => refetch()}>
                        Retry
                      </Button>
                    </div>
                  ) : (
                    "No staff found."
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {options.map((opt) => {
                    const checked = selectedSet.has(opt.id);
                    const isNonActive = opt.status && opt.status !== "Active";

                    return (
                      <CommandItem
                        key={opt.id}
                        value={opt.label}
                        onSelect={() => toggle(opt.id)}
                        aria-selected={checked}
                        role="option"
                        className={cn(isNonActive && "opacity-70")}
                      >
                        <div className="mr-2 flex h-4 w-4 items-center justify-center">
                          {checked ? <Check className="h-4 w-4" /> : <Checkbox checked={checked} aria-hidden />}
                        </div>
                        <span className="truncate">{opt.label}</span>
                        {opt.status && (
                          <Badge
                            variant={getStatusBadgeVariant(opt.status)}
                            className={cn("ml-auto", isNonActive && "border-muted-foreground/30")}
                          >
                            {opt.status}
                          </Badge>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button
          variant="secondary"
          disabled={value.length === 0 || disabled}
          onClick={clearAll}
          aria-label="Clear selected staff"
        >
          Clear
        </Button>
      </div>

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {selectedIds.map((id) => {
            const opt = options.find((o) => o.id === id);
            const labelText = opt?.label ?? id;
            const status = opt?.status;
            const isNonActive = status && status !== "Active";

            return (
              <Badge
                key={id}
                variant={isNonActive ? "outline" : "secondary"}
                className={cn("gap-1", isNonActive && "text-muted-foreground")}
              >
                {labelText}
                {status && (
                  <span className="ml-1 text-[10px] uppercase tracking-wide">
                    {status}
                  </span>
                )}
                <button
                  aria-label={`Remove staff ${labelText}`}
                  className="inline-flex items-center"
                  onClick={() => toggle(id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default StaffPicker;

