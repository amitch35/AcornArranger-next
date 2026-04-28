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
};

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

  const baseOptions: StaffOption[] = React.useMemo(() => {
    const raw = data?.options ?? [];
    return raw.map((o) => ({ id: String(o.id), label: String(o.label) }));
  }, [data]);

  // Cache labels for any id we have ever seen in the options list. This lets
  // selected staff that scroll out of the current 50-row page (e.g. because the
  // user typed a search term, or because the active-status filter excludes
  // them) keep their human-readable label without firing a detail request per
  // selection. Names are stable enough that revalidating on every keystroke
  // isn't worth the network cost.
  //
  // Populated during render so the same render that introduces a new option
  // can also use its label for chips. Idempotent ref mutation is a documented
  // pattern for derived caches.
  const labelCacheRef = React.useRef<Map<string, string>>(new Map());
  for (const o of baseOptions) {
    labelCacheRef.current.set(o.id, o.label);
  }

  // Mount-time / page-reload safety net: if `value` includes ids that have
  // never appeared in any options payload (e.g. an inactive staff member that
  // is still selected while the picker filters to Active only), fetch their
  // detail in parallel so the chip can show a name instead of a bare user_id.
  //
  // The `!labelCacheRef.current.has(id)` guard means in-session selections
  // picked from the visible list never trigger a network request — the loop
  // above has already cached them. React Query's per-id cache also dedupes
  // across mounts so navigating back to a page with the same selection is
  // free.
  const missingSelectedIds = React.useMemo(
    () => selectedIds.filter((id) => !labelCacheRef.current.has(id)),
    // baseOptions is intentionally a dep: it triggers re-evaluation right
    // after the cache loop above has populated newly-arrived labels.
    [selectedIds, baseOptions]
  );

  const detailQueries = useQueries({
    queries: missingSelectedIds.map((id) => ({
      queryKey: ["staff", id],
      queryFn: () => fetchStaffDetail(id),
      enabled: Boolean(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  for (let i = 0; i < detailQueries.length; i++) {
    const id = missingSelectedIds[i];
    const result = detailQueries[i];
    const staff = result?.data as
      | { user_id?: number | string; name?: string | null; first_name?: string | null; last_name?: string | null }
      | undefined;
    if (!id || !staff) continue;
    const resolved = getStaffDisplayName(staff) || String(staff.user_id ?? id);
    if (resolved) labelCacheRef.current.set(id, resolved);
  }

  const getLabel = React.useCallback(
    (id: string) => labelCacheRef.current.get(id) ?? id,
    []
  );

  // Recomputed every render rather than memoized: the cache is mutated in
  // place during render (above), so a stable dep array would leave chip
  // labels stale after a detail query resolves. The work is O(value.length)
  // over short string lookups — negligible compared to the popover render.
  const selectedLabels = selectedIds.map((id) => getLabel(id));

  const toggle = (id: string) => {
    const next = selectedSet.has(id)
      ? value.filter((v) => String(v) !== id)
      : [...value, Number(id)];
    onChange(next);
  };

  const clearAll = () => onChange([]);

  const selectAll = () => {
    const allIds = baseOptions.map((o) => Number(o.id));
    const merged = Array.from(new Set([...value, ...allIds]));
    onChange(merged);
  };

  const allSelected =
    baseOptions.length > 0 && baseOptions.every((o) => selectedSet.has(o.id));

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
              <div className="flex items-center justify-between px-3 pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  disabled={isLoading || baseOptions.length === 0 || allSelected}
                  onClick={(e) => {
                    e.preventDefault();
                    selectAll();
                  }}
                >
                  Select All
                </Button>
                {statusIds.length === 1 && statusIds[0] === 1 ? (
                  <Badge variant="outline" className="h-5 px-2 text-[11px] text-muted-foreground">
                    Showing Active staff only
                  </Badge>
                ) : null}
              </div>
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
                  {baseOptions.map((opt) => {
                    const checked = selectedSet.has(opt.id);

                    return (
                      <CommandItem
                        key={opt.id}
                        value={opt.label}
                        onSelect={() => toggle(opt.id)}
                        aria-selected={checked}
                        role="option"
                      >
                        <div className="mr-2 flex h-4 w-4 items-center justify-center">
                          {checked ? <Check className="h-4 w-4" /> : <Checkbox checked={checked} aria-hidden />}
                        </div>
                        <span className="truncate">{opt.label}</span>
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
            const labelText = getLabel(id);

            return (
              <Badge key={id} variant="secondary" className="gap-1">
                {labelText}
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
