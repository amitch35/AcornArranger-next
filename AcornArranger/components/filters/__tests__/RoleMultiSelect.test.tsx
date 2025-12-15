import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { act } from "react";
import { RoleMultiSelect } from "../RoleMultiSelect";

describe("RoleMultiSelect", () => {
  it("does not prune selections while options are still empty (loading)", async () => {
    const onChange = vi.fn();

    render(
      <RoleMultiSelect
        label="Roles"
        options={[]}
        value={["2"]}
        onChange={onChange}
        showBadges={false}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("prunes invalid selections once options are available", async () => {
    const onChange = vi.fn();
    const onClearNotice = vi.fn();

    render(
      <RoleMultiSelect
        label="Roles"
        options={[
          { value: "1", label: "Housekeeper" },
          { value: "2", label: "Lead Housekeeper" },
        ]}
        value={["999", "2"]}
        onChange={onChange}
        onClearNotice={onClearNotice}
        showBadges={false}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(onChange).toHaveBeenCalledWith(["2"]);
  });

  it("reports removed labels (not IDs) when an option disappears", async () => {
    const onChange = vi.fn();
    const onClearNotice = vi.fn();

    const { rerender } = render(
      <RoleMultiSelect
        label="Roles"
        options={[
          { value: "999", label: "Housekeeper" },
          { value: "2", label: "Lead Housekeeper" },
        ]}
        value={["999", "2"]}
        onChange={onChange}
        onClearNotice={onClearNotice}
        showBadges={false}
      />
    );

    // Now the "999" option disappears from the list; selection should be pruned and notice should use label.
    rerender(
      <RoleMultiSelect
        label="Roles"
        options={[{ value: "2", label: "Lead Housekeeper" }]}
        value={["999", "2"]}
        onChange={onChange}
        onClearNotice={onClearNotice}
        showBadges={false}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(onClearNotice).toHaveBeenCalledWith(1, ["Housekeeper"]);
  });
});

