import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { HomebaseShiftSuggestions } from "../HomebaseShiftSuggestions";
import type { StaffShift } from "../../schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeShift(userId: number, name: string): StaffShift {
  const [first, ...rest] = name.split(" ");
  return {
    matched: true,
    user_id: userId,
    name,
    shift: {
      user_id: 1000 + userId,
      first_name: first ?? name,
      last_name: rest.join(" "),
      role: "Housekeeper",
    },
  };
}

const ALICE = makeShift(1, "Alice");
const BOB = makeShift(2, "Bob");
const CAROL = makeShift(3, "Carol");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HomebaseShiftSuggestions", () => {
  describe("rendering", () => {
    it("renders a chip for each matched shift", () => {
      render(
        <HomebaseShiftSuggestions
          matchedShifts={[ALICE, BOB, CAROL]}
          availableStaff={[]}
          onUseHomebaseStaff={vi.fn()}
          onToggleStaff={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: "Alice" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Bob" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Carol" })).toBeDefined();
    });

    it("shows empty state message when no matched shifts are provided", () => {
      render(
        <HomebaseShiftSuggestions
          matchedShifts={[]}
          availableStaff={[]}
          onUseHomebaseStaff={vi.fn()}
          onToggleStaff={vi.fn()}
        />
      );

      expect(screen.getByText(/no homebase shifts found/i)).toBeDefined();
    });

    it("renders the 'Use Homebase Staff' button", () => {
      render(
        <HomebaseShiftSuggestions
          matchedShifts={[ALICE]}
          availableStaff={[]}
          onUseHomebaseStaff={vi.fn()}
          onToggleStaff={vi.fn()}
        />
      );

      expect(
        screen.getByRole("button", { name: /use homebase staff/i })
      ).toBeDefined();
    });
  });

  describe("selected state", () => {
    it("marks chips as pressed (aria-pressed=true) for staff in availableStaff", () => {
      render(
        <HomebaseShiftSuggestions
          matchedShifts={[ALICE, BOB]}
          availableStaff={[1]} // Alice selected
          onUseHomebaseStaff={vi.fn()}
          onToggleStaff={vi.fn()}
        />
      );

      const aliceBtn = screen.getByRole("button", { name: "Alice" });
      const bobBtn = screen.getByRole("button", { name: "Bob" });

      expect(aliceBtn.getAttribute("aria-pressed")).toBe("true");
      expect(bobBtn.getAttribute("aria-pressed")).toBe("false");
    });
  });

  describe("interactions", () => {
    it("calls onToggleStaff with the correct user_id when a chip is clicked", () => {
      const onToggle = vi.fn();
      render(
        <HomebaseShiftSuggestions
          matchedShifts={[ALICE, BOB]}
          availableStaff={[]}
          onUseHomebaseStaff={vi.fn()}
          onToggleStaff={onToggle}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Bob" }));

      expect(onToggle).toHaveBeenCalledOnce();
      expect(onToggle).toHaveBeenCalledWith(2);
    });

    it("calls onUseHomebaseStaff with all matched user_ids when the button is clicked", () => {
      const onUse = vi.fn();
      render(
        <HomebaseShiftSuggestions
          matchedShifts={[ALICE, BOB, CAROL]}
          availableStaff={[]}
          onUseHomebaseStaff={onUse}
          onToggleStaff={vi.fn()}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: /use homebase staff/i })
      );

      expect(onUse).toHaveBeenCalledOnce();
      expect(onUse).toHaveBeenCalledWith([1, 2, 3]);
    });

    it("does not include null user_ids in the onUseHomebaseStaff call", () => {
      const onUse = vi.fn();
      const unmatchedLookalike: StaffShift = {
        matched: true,
        user_id: null,
        name: null,
        shift: { user_id: 9999, first_name: "Ghost", last_name: "", role: "Housekeeper" },
      };

      render(
        <HomebaseShiftSuggestions
          matchedShifts={[ALICE, unmatchedLookalike]}
          availableStaff={[]}
          onUseHomebaseStaff={onUse}
          onToggleStaff={vi.fn()}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: /use homebase staff/i })
      );

      expect(onUse).toHaveBeenCalledWith([1]); // only Alice's user_id
    });
  });
});
