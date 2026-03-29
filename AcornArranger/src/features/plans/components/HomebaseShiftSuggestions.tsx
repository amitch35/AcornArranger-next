"use client";

import * as React from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StaffShift } from "../schemas";

export type HomebaseShiftSuggestionsProps = {
  /** All matched Homebase shifts for the selected date */
  matchedShifts: StaffShift[];
  /** Currently selected available staff (user_ids) */
  availableStaff: number[];
  /** Replace availableStaff with all matched shift user_ids */
  onUseHomebaseStaff: (userIds: number[]) => void;
  /** Toggle a single user_id in/out of availableStaff */
  onToggleStaff: (userId: number) => void;
};

/**
 * Displays Homebase shift staff as toggleable chips for the selected date.
 * Lets users pre-populate "Available Staff" from the Homebase shift data
 * before building a plan — inverting the workflow from reactive validation
 * to proactive awareness.
 */
export function HomebaseShiftSuggestions({
  matchedShifts,
  availableStaff,
  onUseHomebaseStaff,
  onToggleStaff,
}: HomebaseShiftSuggestionsProps) {
  const selectedSet = React.useMemo(
    () => new Set(availableStaff),
    [availableStaff]
  );

  const allMatchedIds = React.useMemo(
    () =>
      matchedShifts
        .map((s) => s.user_id)
        .filter((id): id is number => id !== null),
    [matchedShifts]
  );

  if (matchedShifts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No Homebase shifts found for this date.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {matchedShifts.map((s) => {
          if (s.user_id === null) return null;
          const isSelected = selectedSet.has(s.user_id);
          return (
            <button
              key={s.user_id}
              type="button"
              onClick={() => onToggleStaff(s.user_id!)}
              aria-pressed={isSelected}
              className={cn(
                "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer select-none",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                isSelected
                  ? "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80"
                  : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {s.name ?? `${s.shift.first_name} ${s.shift.last_name}`}
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onUseHomebaseStaff(allMatchedIds)}
        className="gap-1.5 text-xs"
      >
        <Users className="h-3.5 w-3.5" />
        Use Homebase Staff
      </Button>
    </div>
  );
}
