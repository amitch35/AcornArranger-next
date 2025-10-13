"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, X } from "lucide-react";

export type FilterOption = { id: string; label: string };
export type FilterGroup = {
  id: string;
  label: string;
  options: FilterOption[];
  searchPlaceholder?: string;
};

export type FilterState = Record<string, string[]>;

type FilterBarProps = {
  groups: FilterGroup[];
  value: FilterState;
  onChange: (next: FilterState) => void;
  onApply?: () => void;
  onReset?: () => void;
  advancedContent?: React.ReactNode;
  title?: string;
  extraHasActive?: boolean;
};

export function FilterBar({ groups, value, onChange, onApply, onReset, advancedContent, title = "Filters", extraHasActive = false }: FilterBarProps) {
  const [openGroupId, setOpenGroupId] = React.useState<string | null>(null);
  const [advanced, setAdvanced] = React.useState(false);

  const toggleOption = (groupId: string, optionId: string) => {
    const current = value[groupId] ?? [];
    const exists = current.includes(optionId);
    const nextForGroup = exists ? current.filter((v) => v !== optionId) : [...current, optionId];
    onChange({ ...value, [groupId]: nextForGroup });
  };

  const clearOption = (groupId: string, optionId: string) => {
    const current = value[groupId] ?? [];
    onChange({ ...value, [groupId]: current.filter((v) => v !== optionId) });
  };

  const clearAll = () => {
    const cleared: FilterState = {};
    for (const g of groups) cleared[g.id] = [];
    onChange(cleared);
    onReset?.();
  };

  const hasActive = groups.some((g) => (value[g.id] ?? []).length > 0) || !!extraHasActive;

  return (
    <div className="flex w-full flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <Separator orientation="vertical" className="mx-1 h-6" />
        {groups.map((group) => {
          const open = openGroupId === group.id;
          return (
            <Popover key={group.id} open={open} onOpenChange={(o) => setOpenGroupId(o ? group.id : null)}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  aria-expanded={open}
                  aria-haspopup="listbox"
                  aria-controls={`${group.id}-content`}
                  className="gap-2"
                >
                  {group.label}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent id={`${group.id}-content`} align="start" className="p-0">
                <Command>
                  <CommandInput placeholder={group.searchPlaceholder ?? `Search ${group.label.toLowerCase()}...`} />
                  <CommandList role="listbox">
                    <CommandEmpty>No options found.</CommandEmpty>
                    <CommandGroup>
                      {group.options.map((opt) => (
                        <CommandItem
                          key={opt.id}
                          value={opt.id}
                          onSelect={() => toggleOption(group.id, opt.id)}
                          aria-selected={(value[group.id] ?? []).includes(opt.id)}
                          role="option"
                        >
                          {opt.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          );
        })}

        <Separator orientation="vertical" className="mx-1 h-6" />

        <div className="flex flex-wrap items-center gap-2">
          {groups.flatMap((group) => (value[group.id] ?? []).map((id) => {
            const label = group.options.find((o) => o.id === id)?.label ?? id;
            const key = `${group.id}:${id}`;
            return (
              <Badge key={key} variant="secondary" className="gap-1">
                {label}
                <button
                  aria-label={`Remove filter ${group.label}=${label}`}
                  className="inline-flex items-center"
                  onClick={() => clearOption(group.id, id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          }))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" onClick={clearAll} disabled={!hasActive} aria-label="Clear all filters">
            Clear filters
          </Button>
        </div>
      </div>

      <Collapsible open={advanced} onOpenChange={setAdvanced}>
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="px-2">
              Advanced
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="space-y-2 p-2">
          {advancedContent ?? (
            <div className="text-sm text-muted-foreground">No advanced options.</div>
          )}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">Advanced changes are applied when you click Apply.</div>
            <Button onClick={onApply} aria-label="Apply advanced filters">Apply advanced</Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

