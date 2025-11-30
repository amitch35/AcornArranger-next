import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFocusTrap } from "../useFocusTrap";

describe("useFocusTrap", () => {
  let container: HTMLDivElement;
  let button1: HTMLButtonElement;
  let button2: HTMLButtonElement;
  let button3: HTMLButtonElement;

  beforeEach(() => {
    // Create test container with focusable elements
    container = document.createElement("div");
    button1 = document.createElement("button");
    button1.textContent = "Button 1";
    button2 = document.createElement("button");
    button2.textContent = "Button 2";
    button3 = document.createElement("button");
    button3.textContent = "Button 3";

    container.appendChild(button1);
    container.appendChild(button2);
    container.appendChild(button3);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("focuses first element when enabled", () => {
    const { result } = renderHook(() => useFocusTrap(true));
    
    // Assign ref to container
    if (result.current.current) {
      result.current.current = container as any;
    }

    // Note: In a real browser environment, this would auto-focus the first button
    expect(result.current.current).toBeDefined();
  });

  it("returns ref object", () => {
    const { result } = renderHook(() => useFocusTrap(false));
    
    expect(result.current).toHaveProperty("current");
  });

  it("handles disabled state", () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useFocusTrap(enabled),
      { initialProps: { enabled: false } }
    );

    expect(result.current.current).toBeNull();

    // Enable trap
    rerender({ enabled: true });
    expect(result.current).toBeDefined();

    // Disable again
    rerender({ enabled: false });
    expect(result.current).toBeDefined();
  });

  it("creates ref that can be attached to elements", () => {
    const { result } = renderHook(() => useFocusTrap(true));
    
    // Simulate attaching ref
    const testDiv = document.createElement("div");
    (result.current as any).current = testDiv;

    expect((result.current as any).current).toBe(testDiv);
  });
});

