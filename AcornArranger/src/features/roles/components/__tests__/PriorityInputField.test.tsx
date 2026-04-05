import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PriorityInputField } from "../PriorityInputField";

describe("PriorityInputField", () => {
  it("calls onCommit on blur when the value changed", () => {
    const onCommit = vi.fn();
    render(
      <PriorityInputField roleId={1} priority={100} onCommit={onCommit} />
    );
    const input = screen.getByRole("textbox", { name: /priority/i });
    fireEvent.change(input, { target: { value: "50" } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(50);
  });

  it("does not call onCommit on blur when the value is unchanged", () => {
    const onCommit = vi.fn();
    render(
      <PriorityInputField roleId={1} priority={100} onCommit={onCommit} />
    );
    const input = screen.getByRole("textbox", { name: /priority/i });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("calls onCommit when Enter is pressed after a change", () => {
    const onCommit = vi.fn();
    render(
      <PriorityInputField roleId={1} priority={100} onCommit={onCommit} />
    );
    const input = screen.getByRole("textbox", { name: /priority/i });
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(42);
  });

  it("resets invalid draft to server priority on blur without calling onCommit", () => {
    const onCommit = vi.fn();
    render(
      <PriorityInputField roleId={1} priority={200} onCommit={onCommit} />
    );
    const input = screen.getByRole("textbox", {
      name: /priority/i,
    }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "not-a-number" } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("200");
  });

  it("does not call onCommit when disabled", () => {
    const onCommit = vi.fn();
    render(
      <PriorityInputField
        roleId={1}
        priority={10}
        disabled
        onCommit={onCommit}
      />
    );
    const input = screen.getByRole("textbox", { name: /priority/i });
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.blur(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("syncs draft when priority prop updates", () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <PriorityInputField roleId={1} priority={100} onCommit={onCommit} />
    );
    const input = screen.getByRole("textbox", {
      name: /priority/i,
    }) as HTMLInputElement;
    expect(input.value).toBe("100");
    rerender(
      <PriorityInputField roleId={1} priority={150} onCommit={onCommit} />
    );
    expect(input.value).toBe("150");
  });
});
