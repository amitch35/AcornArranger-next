import { describe, it, expect } from "vitest";
import { computeShiftStatus, SHIFT_RELEVANT_ROLES } from "../useShiftStatus";
import type { Plan } from "../../schemas";
import type { StaffShift } from "../../schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePlan(staffIds: number[], planId = 1): Plan {
  return {
    plan_id: planId,
    plan_date: "2026-03-29",
    team: planId,
    appointments: [],
    staff: staffIds.map((id) => ({
      user_id: id,
      staff_info: { user_id: id, name: `Staff ${id}` },
    })),
  };
}

function makeMatchedShift(userId: number, name = `Staff ${userId}`): StaffShift {
  return {
    matched: true,
    user_id: userId,
    name,
    shift: {
      user_id: 1000 + userId,
      first_name: name.split(" ")[0] ?? name,
      last_name: name.split(" ")[1] ?? "",
      role: "Housekeeper",
    },
  };
}

function makeShiftWithRole(userId: number, role: string, matched = true): StaffShift {
  return {
    matched,
    user_id: matched ? userId : null,
    name: matched ? `Staff ${userId}` : null,
    shift: {
      user_id: 1000 + userId,
      first_name: "Staff",
      last_name: String(userId),
      role,
    },
  };
}

function makeUnmatchedShift(hbUserId: number, firstName: string, lastName: string): StaffShift {
  return {
    matched: false,
    user_id: null,
    name: null,
    shift: {
      user_id: hbUserId,
      first_name: firstName,
      last_name: lastName,
      role: "Housekeeper",
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("computeShiftStatus", () => {
  it("returns all-clear when plans and shifts match perfectly", () => {
    const plans = [makePlan([1, 2])];
    const shifts = [makeMatchedShift(1), makeMatchedShift(2)];

    const result = computeShiftStatus(plans, shifts);

    expect(result.staffOnPlansWithoutShifts).toHaveLength(0);
    expect(result.shiftsNotOnPlans).toHaveLength(0);
    expect(result.unmatchedShifts).toHaveLength(0);
    expect(result.allClear).toBe(true);
  });

  it("returns all-clear and empty arrays when there are no plans and no shifts", () => {
    const result = computeShiftStatus([], []);

    expect(result.staffOnPlansWithoutShifts).toHaveLength(0);
    expect(result.shiftsNotOnPlans).toHaveLength(0);
    expect(result.unmatchedShifts).toHaveLength(0);
    expect(result.allClear).toBe(true);
  });

  it("flags staff on a plan who have no matching Homebase shift", () => {
    const plans = [makePlan([1, 2])];
    const shifts = [makeMatchedShift(1)]; // staff 2 has no shift

    const result = computeShiftStatus(plans, shifts);

    expect(result.staffOnPlansWithoutShifts).toHaveLength(1);
    expect(result.staffOnPlansWithoutShifts[0].user_id).toBe(2);
    expect(result.allClear).toBe(false);
  });

  it("flags a matched Homebase shift whose user_id is not on any plan", () => {
    const plans = [makePlan([1])];
    const shifts = [makeMatchedShift(1), makeMatchedShift(3)]; // staff 3 not in plans

    const result = computeShiftStatus(plans, shifts);

    expect(result.shiftsNotOnPlans).toHaveLength(1);
    expect(result.shiftsNotOnPlans[0].user_id).toBe(3);
    expect(result.allClear).toBe(false);
  });

  it("puts unmatched shifts (matched: false) in unmatchedShifts regardless of plans", () => {
    const plans = [makePlan([1])];
    const shifts = [makeMatchedShift(1), makeUnmatchedShift(9999, "Unknown", "Person")];

    const result = computeShiftStatus(plans, shifts);

    expect(result.unmatchedShifts).toHaveLength(1);
    expect(result.unmatchedShifts[0].shift.first_name).toBe("Unknown");
    expect(result.allClear).toBe(false);
  });

  it("considers staff spread across multiple plans", () => {
    const plans = [makePlan([1], 1), makePlan([2], 2), makePlan([3], 3)];
    const shifts = [makeMatchedShift(1), makeMatchedShift(2), makeMatchedShift(3)];

    const result = computeShiftStatus(plans, shifts);

    expect(result.staffOnPlansWithoutShifts).toHaveLength(0);
    expect(result.shiftsNotOnPlans).toHaveLength(0);
    expect(result.allClear).toBe(true);
  });

  it("deduplicates staff who appear on more than one plan", () => {
    // Staff 1 appears on both plans — should only count once
    const plans = [makePlan([1, 2], 1), makePlan([1, 3], 2)];
    const shifts = [makeMatchedShift(1), makeMatchedShift(2), makeMatchedShift(3)];

    const result = computeShiftStatus(plans, shifts);

    expect(result.staffOnPlansWithoutShifts).toHaveLength(0);
    expect(result.allClear).toBe(true);
  });

  it("populates matchedShifts with only the matched entries", () => {
    const shifts = [
      makeMatchedShift(1),
      makeMatchedShift(2),
      makeUnmatchedShift(9999, "Ghost", "User"),
    ];

    const result = computeShiftStatus([], shifts);

    expect(result.matchedShifts).toHaveLength(2);
    expect(result.unmatchedShifts).toHaveLength(1);
  });

  it("handles plans with no staff without errors", () => {
    const plans = [makePlan([], 1)];
    const shifts = [makeMatchedShift(1)];

    const result = computeShiftStatus(plans, shifts);

    expect(result.staffOnPlansWithoutShifts).toHaveLength(0);
    expect(result.shiftsNotOnPlans).toHaveLength(1);
  });
});

describe("computeShiftStatus — role filtering", () => {
  it("excludes shifts whose role is not in SHIFT_RELEVANT_ROLES", () => {
    // Staff 1 has a shift but it's for an office role — should not appear in any issue list
    const plans = [makePlan([])]; // no planned staff either
    const shifts = [makeShiftWithRole(1, "Office Manager")];

    const result = computeShiftStatus(plans, shifts);

    expect(result.shiftsNotOnPlans).toHaveLength(0);
    expect(result.matchedShifts).toHaveLength(0);
    expect(result.allClear).toBe(true);
  });

  it("includes all four relevant roles", () => {
    const relevantRoleShifts = [
      makeShiftWithRole(1, "Housekeeper"),
      makeShiftWithRole(2, "Lead Housekeeper"),
      makeShiftWithRole(3, "Hospitality Manager"),
      makeShiftWithRole(4, "Quality Control Manager"),
    ];

    const result = computeShiftStatus([], relevantRoleShifts);

    // All four shifts are relevant, none planned → all four in shiftsNotOnPlans
    expect(result.shiftsNotOnPlans).toHaveLength(4);
    expect(result.matchedShifts).toHaveLength(4);
  });

  it("filters irrelevant roles before the match/unmatched split", () => {
    // An unmatched shift with an irrelevant role should NOT appear in unmatchedShifts
    const shifts = [makeShiftWithRole(99, "Maintenance", false)];

    const result = computeShiftStatus([], shifts);

    expect(result.unmatchedShifts).toHaveLength(0);
    expect(result.allClear).toBe(true);
  });

  it("only counts a staff member as missing a shift if no relevant-role shift exists for them", () => {
    // Staff 1 has an office shift (irrelevant) and is on a plan → should still appear as missing
    const plans = [makePlan([1])];
    const shifts = [makeShiftWithRole(1, "Office Manager")];

    const result = computeShiftStatus(plans, shifts);

    expect(result.staffOnPlansWithoutShifts).toHaveLength(1);
    expect(result.staffOnPlansWithoutShifts[0].user_id).toBe(1);
  });

  it("SHIFT_RELEVANT_ROLES contains exactly the four expected roles", () => {
    expect(SHIFT_RELEVANT_ROLES.has("Housekeeper")).toBe(true);
    expect(SHIFT_RELEVANT_ROLES.has("Lead Housekeeper")).toBe(true);
    expect(SHIFT_RELEVANT_ROLES.has("Hospitality Manager")).toBe(true);
    expect(SHIFT_RELEVANT_ROLES.has("Quality Control Manager")).toBe(true);
    expect(SHIFT_RELEVANT_ROLES.size).toBe(4);
  });
});
