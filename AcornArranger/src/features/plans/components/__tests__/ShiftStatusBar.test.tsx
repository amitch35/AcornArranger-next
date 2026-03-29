import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShiftStatusBar } from "../ShiftStatusBar";
import type { StaffShift } from "../../schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NO_ISSUES = {
  staffOnPlansWithoutShifts: [],
  shiftsNotOnPlans: [],
  unmatchedShifts: [] as StaffShift[],
};

function makeIssues(overrides: Partial<typeof NO_ISSUES> = {}) {
  return { ...NO_ISSUES, ...overrides };
}

function makeUnmatched(firstName: string, lastName: string): StaffShift {
  return {
    matched: false,
    user_id: null,
    name: null,
    shift: { user_id: 9999, first_name: firstName, last_name: lastName, role: "Housekeeper" },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ShiftStatusBar", () => {
  describe("all-clear state (zero issues)", () => {
    it("shows the 'Shifts look good' badge when all counts are zero", () => {
      render(<ShiftStatusBar {...NO_ISSUES} />);
      expect(screen.getByLabelText(/shifts look good/i)).toBeDefined();
    });

    it("does not render a clickable button in the all-clear state", () => {
      render(<ShiftStatusBar {...NO_ISSUES} />);
      expect(screen.queryByRole("button")).toBeNull();
    });
  });

  describe("issue state (at least one count > 0)", () => {
    it("shows badge counts for each issue category", () => {
      render(
        <ShiftStatusBar
          {...makeIssues({
            staffOnPlansWithoutShifts: [{ user_id: 1, name: "Alice" }],
            shiftsNotOnPlans: [{ user_id: 2, name: "Bob" }],
            unmatchedShifts: [makeUnmatched("Charlie", "Brown")],
          })}
        />
      );

      expect(screen.getByLabelText(/1 staff on plans without homebase shifts/i)).toBeDefined();
      expect(screen.getByLabelText(/1 homebase shifts not assigned to any plan/i)).toBeDefined();
      expect(screen.getByLabelText(/1 homebase shifts that could not be matched/i)).toBeDefined();
    });

    it("renders a button that opens the Sheet when clicked", () => {
      render(
        <ShiftStatusBar
          {...makeIssues({
            staffOnPlansWithoutShifts: [{ user_id: 1, name: "Alice" }],
          })}
        />
      );

      const btn = screen.getByRole("button");
      fireEvent.click(btn);

      expect(screen.getByText(/shift status/i)).toBeDefined();
    });

    it("shows the staff name under the correct section in the Sheet", () => {
      render(
        <ShiftStatusBar
          {...makeIssues({
            staffOnPlansWithoutShifts: [{ user_id: 1, name: "Alice" }],
            shiftsNotOnPlans: [{ user_id: 2, name: "Bob" }],
            unmatchedShifts: [makeUnmatched("Charlie", "Brown")],
          })}
        />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("Alice")).toBeDefined();
      expect(screen.getByText("Bob")).toBeDefined();
      expect(screen.getByText("Charlie Brown")).toBeDefined();
    });

    it("shows empty-section messages when a category has no issues", () => {
      render(
        <ShiftStatusBar
          {...makeIssues({
            shiftsNotOnPlans: [{ user_id: 2, name: "Bob" }],
          })}
        />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText(/all plan staff have matching shifts/i)).toBeDefined();
      expect(screen.getByText(/no unmatched shifts/i)).toBeDefined();
    });
  });

  describe("loading state", () => {
    it("renders skeleton placeholders while loading", () => {
      render(<ShiftStatusBar {...NO_ISSUES} isLoading />);
      expect(screen.getByLabelText(/loading shift status/i)).toBeDefined();
      expect(screen.queryByLabelText(/shifts look good/i)).toBeNull();
    });
  });
});
