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

    render(
      <RoleMultiSelect
        label="Roles"
        options={[
          { value: "1", label: "Housekeeper" },
          { value: "2", label: "Lead Housekeeper" },
        ]}
        value={["999", "2"]}
        onChange={onChange}
        showBadges={false}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(onChange).toHaveBeenCalledWith(["2"]);
  });
});

