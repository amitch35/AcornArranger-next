import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PropertyMultiSelect } from "../PropertyMultiSelect";
import type { PropertyOption } from "../PropertyMultiSelect";

const mockOptions: PropertyOption[] = [
  { value: "1", label: "Ocean View Villa" },
  { value: "2", label: "Mountain Retreat" },
  { value: "3", label: "Downtown Loft" },
  { value: "4", label: "Beach House" },
  { value: "5", label: "Lake Cabin" },
];

describe("PropertyMultiSelect", () => {
  describe("Basic Rendering & Selection", () => {
    it("renders with default label when no selection", () => {
      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={[]}
          onChange={() => {}}
        />
      );
      expect(screen.getByText("Properties")).toBeInTheDocument();
    });

    it("displays selected count when multiple items selected", () => {
      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={["1", "2"]}
          onChange={() => {}}
        />
      );
      expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
    });

    it("displays single selection label", () => {
      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={["1"]}
          onChange={() => {}}
        />
      );
      // Check button text (summary shows "Properties: Ocean View Villa")
      expect(screen.getByText(/properties: ocean view villa/i)).toBeInTheDocument();
    });

    it("calls onChange when toggling selection", () => {
      const onChange = vi.fn();
      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={[]}
          onChange={onChange}
        />
      );

      const trigger = screen.getAllByRole("button")[0];
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole("option", { name: /ocean view villa/i }));

      expect(onChange).toHaveBeenCalledWith(["1"]);
    });

    it("removes item when toggling selected option", () => {
      const onChange = vi.fn();
      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={["1", "2"]}
          onChange={onChange}
        />
      );

      const trigger = screen.getAllByRole("button")[0];
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole("option", { name: /ocean view villa/i }));

      expect(onChange).toHaveBeenCalledWith(["2"]);
    });
  });

  describe("Badge/Chip Display", () => {
    it("displays chips for selected items by default", () => {
      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={["1", "3"]}
          onChange={() => {}}
        />
      );

      expect(screen.getByText("Ocean View Villa")).toBeInTheDocument();
      expect(screen.getByText("Downtown Loft")).toBeInTheDocument();
    });

    it("hides chips when showBadges is false", () => {
      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={["1", "3"]}
          onChange={() => {}}
          showBadges={false}
        />
      );

      expect(screen.queryByText("Ocean View Villa")).not.toBeInTheDocument();
      expect(screen.queryByText("Downtown Loft")).not.toBeInTheDocument();
    });

    it("removes item when clicking X on chip", () => {
      const onChange = vi.fn();
      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={["1", "2"]}
          onChange={onChange}
        />
      );

      const removeButtons = screen.getAllByRole("button", { name: /remove property/i });
      fireEvent.click(removeButtons[0]);

      expect(onChange).toHaveBeenCalledWith(["2"]);
    });
  });

  describe("Clear All", () => {
    it("clears all selections when Clear button clicked", () => {
      const onChange = vi.fn();
      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={["1", "2", "3"]}
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /clear selected properties/i }));

      expect(onChange).toHaveBeenCalledWith([]);
    });

    it("disables Clear button when no selections", () => {
      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={[]}
          onChange={() => {}}
        />
      );

      const clearButton = screen.getByRole("button", { name: /clear selected properties/i });
      expect(clearButton).toBeDisabled();
    });

    it("calls onClearNotice with removed count and labels", () => {
      const onClearNotice = vi.fn();
      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={["1", "2", "3"]}
          onChange={() => {}}
          onClearNotice={onClearNotice}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /clear selected properties/i }));

      expect(onClearNotice).toHaveBeenCalledWith(3, ["Ocean View Villa", "Mountain Retreat", "Downtown Loft"]);
    });
  });

  describe("Selection Pruning", () => {
    it("removes selections when options list changes and IDs no longer exist", () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <PropertyMultiSelect
          options={mockOptions}
          value={["1", "2", "99"]}
          onChange={onChange}
        />
      );

      // Options change, removing ID "1"
      const newOptions = mockOptions.filter((o) => o.value !== "1");
      rerender(
        <PropertyMultiSelect
          options={newOptions}
          value={["1", "2", "99"]}
          onChange={onChange}
        />
      );

      // Should prune "1" and "99"
      expect(onChange).toHaveBeenCalledWith(["2"]);
    });

    it("calls onClearNotice when pruning selections", () => {
      const onClearNotice = vi.fn();
      const { rerender } = render(
        <PropertyMultiSelect
          options={mockOptions}
          value={["1", "2"]}
          onChange={() => {}}
          onClearNotice={onClearNotice}
        />
      );

      const newOptions = mockOptions.filter((o) => o.value !== "1");
      rerender(
        <PropertyMultiSelect
          options={newOptions}
          value={["1", "2"]}
          onChange={() => {}}
          onClearNotice={onClearNotice}
        />
      );

      // When option is removed, label can't be retrieved, so empty array is passed
      expect(onClearNotice).toHaveBeenCalledWith(1, []);
    });
  });

  describe("Remote Loading Support", () => {
    it("calls loadOptions with search query after debounce", async () => {
      vi.useFakeTimers();
      const loadOptions = vi.fn();

      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={[]}
          onChange={() => {}}
          loadOptions={loadOptions}
        />
      );

      const trigger = screen.getAllByRole("button")[0];
      fireEvent.click(trigger);
      const searchInput = screen.getByPlaceholderText(/search properties/i);
      fireEvent.change(searchInput, { target: { value: "villa" } });

      // Before debounce
      expect(loadOptions).not.toHaveBeenCalled();

      // After debounce
      vi.advanceTimersByTime(300);
      expect(loadOptions).toHaveBeenCalledWith({ q: "villa", city: undefined, statusIds: undefined });

      vi.useRealTimers();
    });

    it("forwards city filter to loadOptions", async () => {
      vi.useFakeTimers();
      const loadOptions = vi.fn();

      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={[]}
          onChange={() => {}}
          loadOptions={loadOptions}
          city="San Diego"
        />
      );

      vi.advanceTimersByTime(300);
      expect(loadOptions).toHaveBeenCalledWith({ q: undefined, city: "San Diego", statusIds: undefined });

      vi.useRealTimers();
    });

    it("maps onlyActive to statusIds=[1]", async () => {
      vi.useFakeTimers();
      const loadOptions = vi.fn();

      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={[]}
          onChange={() => {}}
          loadOptions={loadOptions}
          onlyActive
        />
      );

      vi.advanceTimersByTime(300);
      expect(loadOptions).toHaveBeenCalledWith({ q: undefined, city: undefined, statusIds: [1] });

      vi.useRealTimers();
    });
  });

  describe("Disabled State", () => {
    it("disables trigger button when disabled prop is true", () => {
      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={[]}
          onChange={() => {}}
          disabled
        />
      );

      const trigger = screen.getAllByRole("button")[0];
      expect(trigger).toBeDisabled();
    });

    it("disables Clear button when disabled prop is true", () => {
      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={["1"]}
          onChange={() => {}}
          disabled
        />
      );

      const clearButton = screen.getByRole("button", { name: /clear selected properties/i });
      expect(clearButton).toBeDisabled();
    });
  });

  describe("Custom Props", () => {
    it("uses custom label", () => {
      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={[]}
          onChange={() => {}}
          label="Rental Units"
        />
      );

      expect(screen.getByText("Rental Units")).toBeInTheDocument();
    });

    it("uses custom placeholder", () => {
      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={[]}
          onChange={() => {}}
          placeholder="Find a property..."
        />
      );

      const trigger = screen.getAllByRole("button")[0];
      fireEvent.click(trigger);
      expect(screen.getByPlaceholderText("Find a property...")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(
        <PropertyMultiSelect
          options={mockOptions}
          value={[]}
          onChange={() => {}}
          className="custom-class"
        />
      );

      expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty options array", () => {
      render(
        <PropertyMultiSelect
          options={[]}
          value={[]}
          onChange={() => {}}
        />
      );

      const trigger = screen.getAllByRole("button")[0]; // Get first button (trigger, not Clear)
      fireEvent.click(trigger);
      expect(screen.getByText(/no properties found/i)).toBeInTheDocument();
    });

    it("displays value as label when option not found", () => {
      render(
        <PropertyMultiSelect
          options={mockOptions}
          value={["999"]}
          onChange={() => {}}
        />
      );

      expect(screen.getByText("999")).toBeInTheDocument();
    });
  });
});
