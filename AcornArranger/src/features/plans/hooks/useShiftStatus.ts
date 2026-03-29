import { useMemo } from "react";
import type { Plan } from "../schemas";
import type { StaffShift } from "../schemas";

export type ShiftIssue = {
  user_id: number;
  name: string;
};

export type ShiftStatus = {
  /** Plan staff members who have no matching Homebase shift */
  staffOnPlansWithoutShifts: ShiftIssue[];
  /** Matched Homebase shifts whose user_id is not on any plan */
  shiftsNotOnPlans: ShiftIssue[];
  /** Homebase shifts that could not be matched to an rc_staff record */
  unmatchedShifts: StaffShift[];
  /** Homebase shifts that were successfully matched to rc_staff */
  matchedShifts: StaffShift[];
  /** True when all three issue arrays are empty */
  allClear: boolean;
};

/**
 * Homebase role strings that are relevant to cleaning schedule planning.
 * Shifts for any other role (e.g. office admin, maintenance) are excluded
 * from shift-vs-plan comparison so they don't generate spurious issues.
 *
 * Mirrors the role filter in the legacy ShiftCheckModal.
 */
export const SHIFT_RELEVANT_ROLES = new Set([
  "Lead Housekeeper",
  "Housekeeper",
  "Hospitality Manager",
  "Quality Control Manager",
]);

/**
 * Computes shift-vs-plan discrepancies for a given date.
 *
 * Mirrors the legacy ShiftCheckModal.staff_shift_issues getter, adapted for
 * React with useMemo so the expensive Set construction only reruns when
 * inputs change.
 */
export function useShiftStatus(
  plans: Plan[],
  shifts: StaffShift[]
): ShiftStatus {
  return useMemo(() => computeShiftStatus(plans, shifts), [plans, shifts]);
}

/**
 * Pure computation extracted so it can be unit-tested without React.
 *
 * Filters shifts to relevant cleaning roles before comparison so that
 * office/admin Homebase shifts don't produce false positives.
 */
export function computeShiftStatus(
  plans: Plan[],
  shifts: StaffShift[]
): ShiftStatus {
  // Mirror the legacy role filter — only consider shifts for staff roles
  // that actually appear in cleaning plans.
  const relevantShifts = shifts.filter((s) =>
    SHIFT_RELEVANT_ROLES.has(s.shift.role)
  );

  const matchedShifts = relevantShifts.filter((s) => s.matched);
  const unmatchedShifts = relevantShifts.filter((s) => !s.matched);

  // All staff user_ids across every plan (deduped)
  const plannedStaff = new Map<number, string>();
  for (const plan of plans) {
    for (const member of plan.staff) {
      plannedStaff.set(member.user_id, member.staff_info?.name ?? String(member.user_id));
    }
  }

  // All matched Homebase shift user_ids (deduped)
  const scheduledStaff = new Map<number, string>();
  for (const s of matchedShifts) {
    if (s.user_id !== null) {
      scheduledStaff.set(s.user_id, s.name ?? String(s.user_id));
    }
  }

  const staffOnPlansWithoutShifts: ShiftIssue[] = [];
  for (const [user_id, name] of plannedStaff) {
    if (!scheduledStaff.has(user_id)) {
      staffOnPlansWithoutShifts.push({ user_id, name });
    }
  }

  const shiftsNotOnPlans: ShiftIssue[] = [];
  for (const [user_id, name] of scheduledStaff) {
    if (!plannedStaff.has(user_id)) {
      shiftsNotOnPlans.push({ user_id, name });
    }
  }

  return {
    staffOnPlansWithoutShifts,
    shiftsNotOnPlans,
    unmatchedShifts,
    matchedShifts,
    allClear:
      staffOnPlansWithoutShifts.length === 0 &&
      shiftsNotOnPlans.length === 0 &&
      unmatchedShifts.length === 0,
  };
}
