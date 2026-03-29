"use client";

import * as React from "react";
import { UserX, UserCheck, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { ShiftIssue } from "../hooks/useShiftStatus";
import type { StaffShift } from "../schemas";

export type ShiftStatusBarProps = {
  staffOnPlansWithoutShifts: ShiftIssue[];
  shiftsNotOnPlans: ShiftIssue[];
  unmatchedShifts: StaffShift[];
  isLoading?: boolean;
};

function IssueList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: { label: string }[];
  emptyLabel: string;
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li
              key={i}
              className="rounded-md bg-muted px-2 py-1 text-sm"
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ShiftStatusBar({
  staffOnPlansWithoutShifts,
  shiftsNotOnPlans,
  unmatchedShifts,
  isLoading = false,
}: ShiftStatusBarProps) {
  const [open, setOpen] = React.useState(false);

  const totalIssues =
    staffOnPlansWithoutShifts.length +
    shiftsNotOnPlans.length +
    unmatchedShifts.length;

  const allClear = totalIssues === 0;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2" aria-label="Loading shift status">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-6 w-28" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {allClear ? (
          <Badge
            variant="outline"
            className="gap-1.5 text-xs text-green-600 border-green-300"
            aria-label="Shifts look good"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Shifts look good
          </Badge>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 hover:bg-transparent"
            onClick={() => setOpen(true)}
            aria-label={`${totalIssues} shift issue${totalIssues !== 1 ? "s" : ""} — click to review`}
          >
            <span className="flex flex-wrap items-center gap-2">
              <Badge
                variant={staffOnPlansWithoutShifts.length > 0 ? "destructive" : "secondary"}
                className="gap-1.5 text-xs"
                aria-label={`${staffOnPlansWithoutShifts.length} staff on plans without Homebase shifts`}
              >
                <UserX className="h-3.5 w-3.5" />
                {staffOnPlansWithoutShifts.length} no shift
              </Badge>
              <Badge
                variant={shiftsNotOnPlans.length > 0 ? "destructive" : "secondary"}
                className="gap-1.5 text-xs"
                aria-label={`${shiftsNotOnPlans.length} Homebase shifts not assigned to any plan`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                {shiftsNotOnPlans.length} unplanned
              </Badge>
              <Badge
                variant={unmatchedShifts.length > 0 ? "destructive" : "secondary"}
                className="gap-1.5 text-xs"
                aria-label={`${unmatchedShifts.length} Homebase shifts that could not be matched to a staff record`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {unmatchedShifts.length} unmatched
              </Badge>
            </span>
          </Button>
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-80 sm:max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Shift Status</SheetTitle>
            <SheetDescription>
              Comparing Homebase shifts against today&apos;s plans.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-4 pb-6">
            <IssueList
              title="On Plans — No Homebase Shift"
              items={staffOnPlansWithoutShifts.map((s) => ({ label: s.name }))}
              emptyLabel="All plan staff have matching shifts."
            />
            <IssueList
              title="Homebase Shifts — Not on Any Plan"
              items={shiftsNotOnPlans.map((s) => ({ label: s.name }))}
              emptyLabel="All Homebase shifts are covered by a plan."
            />
            <IssueList
              title="Unmatched Shifts"
              items={unmatchedShifts.map((s) => ({
                label: `${s.shift.first_name} ${s.shift.last_name}`,
              }))}
              emptyLabel="No unmatched shifts."
            />
            {unmatchedShifts.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Unmatched shifts have a Homebase name that doesn&apos;t
                correspond to any staff record in AcornArranger. Update the
                staff record&apos;s Homebase link to resolve this.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
