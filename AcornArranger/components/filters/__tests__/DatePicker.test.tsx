import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DatePicker } from "../DatePicker";

// Simplify the Calendar to avoid rendering overhead in unit tests.
vi.mock("@/components/ui/calendar", () => ({
  default: ({ onSelect }: { onSelect: (d: Date) => void }) => (
    <button data-testid="calendar-select" onClick={() => onSelect(new Date(2025, 0, 20))}>
      Calendar
    </button>
  ),
}));

// Wednesday 2025-01-15 → getDay() === 3
const FIXED_DATE = new Date(2025, 0, 15);

describe("DatePicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function openPopover(onChange = vi.fn()) {
    render(<DatePicker value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Date:/i }));
  }

  describe("relative presets", () => {
    it("Yesterday calls onChange with the previous day", () => {
      const onChange = vi.fn();
      openPopover(onChange);
      fireEvent.click(screen.getByRole("button", { name: "Yesterday" }));
      expect(onChange).toHaveBeenCalledOnce();
      const result = onChange.mock.calls[0][0] as Date;
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(14);
    });

    it("Today calls onChange with today's date", () => {
      const onChange = vi.fn();
      openPopover(onChange);
      fireEvent.click(screen.getByRole("button", { name: "Today" }));
      expect(onChange).toHaveBeenCalledOnce();
      const result = onChange.mock.calls[0][0] as Date;
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
    });

    it("Tomorrow calls onChange with the next day", () => {
      const onChange = vi.fn();
      openPopover(onChange);
      fireEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
      expect(onChange).toHaveBeenCalledOnce();
      const result = onChange.mock.calls[0][0] as Date;
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(16);
    });

    it("Clear calls onChange with undefined", () => {
      const onChange = vi.fn();
      openPopover(onChange);
      fireEvent.click(screen.getByRole("button", { name: "Clear date" }));
      expect(onChange).toHaveBeenCalledWith(undefined);
    });
  });

  describe("day-of-week presets (system date = Wednesday Jan 15 2025)", () => {
    it("Wednesday (today's day) selects +7 days from today → Jan 22", () => {
      const onChange = vi.fn();
      openPopover(onChange);
      fireEvent.click(screen.getByRole("button", { name: /Wednesday/ }));
      const result = onChange.mock.calls[0][0] as Date;
      expect(result.getDate()).toBe(22);
      expect(result.getMonth()).toBe(0);
    });

    it("Thursday (next day in week) selects Jan 16", () => {
      const onChange = vi.fn();
      openPopover(onChange);
      fireEvent.click(screen.getByRole("button", { name: /Thursday/ }));
      const result = onChange.mock.calls[0][0] as Date;
      expect(result.getDate()).toBe(16);
    });

    it("Saturday (two days ahead in week) selects Jan 18", () => {
      const onChange = vi.fn();
      openPopover(onChange);
      fireEvent.click(screen.getByRole("button", { name: /Saturday/ }));
      const result = onChange.mock.calls[0][0] as Date;
      expect(result.getDate()).toBe(18);
    });

    it("Sunday (start of week — past) selects Jan 12", () => {
      const onChange = vi.fn();
      openPopover(onChange);
      fireEvent.click(screen.getByRole("button", { name: /Sunday/ }));
      const result = onChange.mock.calls[0][0] as Date;
      expect(result.getDate()).toBe(12);
    });

    it("Monday selects Jan 13 (two days before today in this week)", () => {
      const onChange = vi.fn();
      openPopover(onChange);
      fireEvent.click(screen.getByRole("button", { name: /Monday/ }));
      const result = onChange.mock.calls[0][0] as Date;
      expect(result.getDate()).toBe(13);
    });

    it("Tuesday selects Jan 14 (yesterday, still in this week)", () => {
      const onChange = vi.fn();
      openPopover(onChange);
      fireEvent.click(screen.getByRole("button", { name: /Tuesday/ }));
      const result = onChange.mock.calls[0][0] as Date;
      expect(result.getDate()).toBe(14);
    });

    it("Friday selects Jan 17", () => {
      const onChange = vi.fn();
      openPopover(onChange);
      fireEvent.click(screen.getByRole("button", { name: /Friday/ }));
      const result = onChange.mock.calls[0][0] as Date;
      expect(result.getDate()).toBe(17);
    });
  });

  describe("display", () => {
    it("shows 'Select date' when no value is provided", () => {
      render(<DatePicker value={undefined} onChange={vi.fn()} />);
      expect(screen.getByRole("button", { name: /Date: Select date/i })).toBeDefined();
    });

    it("shows the formatted date when a value is provided", () => {
      const date = new Date(2025, 0, 15);
      render(<DatePicker value={date} onChange={vi.fn()} />);
      expect(screen.getByRole("button").textContent).toContain("1/15/2025");
    });

    it("shows +7d indicator on today's day of week button", () => {
      render(<DatePicker value={undefined} onChange={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /Date:/i }));
      const wednesdayBtn = screen.getByRole("button", { name: /Wednesday/ });
      expect(wednesdayBtn.textContent).toContain("+7d");
    });

    it("does not show +7d indicator on other day buttons", () => {
      render(<DatePicker value={undefined} onChange={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /Date:/i }));
      const thursdayBtn = screen.getByRole("button", { name: /Thursday/ });
      expect(thursdayBtn.textContent).not.toContain("+7d");
    });
  });

  it("calendar selection calls onChange with the chosen date", () => {
    const onChange = vi.fn();
    render(<DatePicker value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Date:/i }));
    fireEvent.click(screen.getByTestId("calendar-select"));
    expect(onChange).toHaveBeenCalledWith(new Date(2025, 0, 20));
  });
});
