"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronDown, Check, X } from "lucide-react";

export type UserOption = { label: string; value: string };

type UserMultiSelectProps = {
  label?: string;
  placeholder?: string;
  options: UserOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  showBadges?: boolean;
  onClearNotice?: (removedCount: number, removedLabels: string[]) => void;
  // Filtering inputs (forwarded to loadOptions or parent-controlled fetch)
  canClean?: boolean; // default true
  statusIds?: number[]; // default [1]
  excludePlanId?: number;
  // Optional remote loading support
  loadOptions?: (filters: { q?: string; canClean?: boolean; statusIds?: number[]; excludePlanId?: number }) => void;
};

export function UserMultiSelect({
  label = "Users",
  placeholder = "Search users...",
  options,
  value,
  onChange,
  disabled,
  id,
  className,
  showBadges = true,
  onClearNotice,
  canClean = true,
  statusIds = [1],
  excludePlanId,
  loadOptions,
}: UserMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const buttonId = id ?? React.useId();
  const [searchValue, setSearchValue] = React.useState("");

  const selectedSet = React.useMemo(() => new Set(value), [value]);
  const selectedLabels = React.useMemo(
    () => options.filter((o) => selectedSet.has(o.value)).map((o) => o.label),
    [options, selectedSet]
  );

  const toggle = (val: string) => {
    const exists = selectedSet.has(val);
    const next = exists ? value.filter((v) => v !== val) : [...value, val];
    onChange(next);
  };

  const clearAll = () => {
    if (value.length === 0) return;
    onChange([]);
    onClearNotice?.(value.length, selectedLabels.slice(0, 3));
  };

  // Prune selections no longer present in options
  React.useEffect(() => {
    if (value.length === 0) return;
    const validSet = new Set(options.map((o) => o.value));
    const invalid = value.filter((v) => !validSet.has(v));
    if (invalid.length > 0) {
      const next = value.filter((v) => validSet.has(v));
      onChange(next);
      const removedLabels = options
        .filter((o) => invalid.includes(o.value))
        .map((o) => o.label);
      onClearNotice?.(invalid.length, removedLabels.slice(0, 3));
    }
  }, [options]);

  // Remote search support: debounce and call loadOptions
  React.useEffect(() => {
    if (!loadOptions) return;
    const controller = setTimeout(() => {
      loadOptions({ q: searchValue || undefined, canClean, statusIds, excludePlanId });
    }, 300);
    return () => clearTimeout(controller);
  }, [searchValue, canClean, statusIds.join(","), excludePlanId]);

  const selectedSummary = selectedLabels.length === 0
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
              id={buttonId}
              variant="outline"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={`${buttonId}-content`}
              disabled={disabled}
              className="gap-2"
            >
              {selectedSummary}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent id={`${buttonId}-content`} className="w-[360px] p-0" align="start">
            <Command>
              <CommandInput placeholder={placeholder} value={searchValue} onValueChange={setSearchValue} />
              <CommandList role="listbox">
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  {options.map((opt) => {
                    const checked = selectedSet.has(opt.value);
                    return (
                      <CommandItem
                        key={opt.value}
                        value={opt.label}
                        onSelect={() => toggle(opt.value)}
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

        <Button variant="secondary" disabled={value.length === 0 || disabled} onClick={clearAll} aria-label="Clear selected users">
          Clear
        </Button>
      </div>

      {showBadges && value.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {value.map((val) => {
            const labelText = options.find((o) => o.value === val)?.label ?? val;
            return (
              <Badge key={val} variant="secondary" className="gap-1">
                {labelText}
                <button
                  aria-label={`Remove user ${labelText}`}
                  className="inline-flex items-center"
                  onClick={() => toggle(val)}
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

export default UserMultiSelect;


