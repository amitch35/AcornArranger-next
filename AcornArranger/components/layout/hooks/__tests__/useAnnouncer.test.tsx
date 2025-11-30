import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnnouncer } from "../useAnnouncer";

describe("useAnnouncer", () => {
  let announcer: HTMLDivElement | null;

  beforeEach(() => {
    // Clean up any existing announcers
    const existing = document.querySelector('[role="status"]');
    if (existing) {
      document.body.removeChild(existing);
    }
  });

  afterEach(() => {
    // Clean up announcer after each test
    const existing = document.querySelector('[role="status"]');
    if (existing) {
      document.body.removeChild(existing);
    }
  });

  it("creates ARIA live region on mount", () => {
    const { result } = renderHook(() => useAnnouncer());

    // Wait for effect to run
    act(() => {
      // Effect runs
    });

    const liveRegion = document.querySelector('[role="status"]');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.getAttribute("aria-live")).toBe("polite");
    expect(liveRegion?.getAttribute("aria-atomic")).toBe("true");
  });

  it("announces messages", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAnnouncer());

    act(() => {
      result.current("Test announcement");
    });

    // Fast-forward timer for announcement delay
    act(() => {
      vi.advanceTimersByTime(150);
    });

    const liveRegion = document.querySelector('[role="status"]');
    expect(liveRegion?.textContent).toBe("Test announcement");

    vi.useRealTimers();
  });

  it("supports assertive politeness level", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAnnouncer());

    act(() => {
      result.current("Urgent message", "assertive");
    });

    const liveRegion = document.querySelector('[role="status"]');
    expect(liveRegion?.getAttribute("aria-live")).toBe("assertive");

    vi.useRealTimers();
  });

  it("clears previous message before announcing new one", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAnnouncer());

    // First announcement
    act(() => {
      result.current("First message");
      vi.advanceTimersByTime(150);
    });

    const liveRegion = document.querySelector('[role="status"]');
    expect(liveRegion?.textContent).toBe("First message");

    // Second announcement should clear first
    act(() => {
      result.current("Second message");
      // Content cleared immediately
      expect(liveRegion?.textContent).toBe("");
      
      // Then set after delay
      vi.advanceTimersByTime(150);
      expect(liveRegion?.textContent).toBe("Second message");
    });

    vi.useRealTimers();
  });

  it("removes live region on unmount", () => {
    const { unmount } = renderHook(() => useAnnouncer());

    let liveRegion = document.querySelector('[role="status"]');
    expect(liveRegion).toBeTruthy();

    unmount();

    liveRegion = document.querySelector('[role="status"]');
    expect(liveRegion).toBeNull();
  });

  it("handles multiple announce calls", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAnnouncer());

    act(() => {
      result.current("Message 1");
      result.current("Message 2");
      result.current("Message 3");
      vi.advanceTimersByTime(150);
    });

    const liveRegion = document.querySelector('[role="status"]');
    // Last message should win
    expect(liveRegion?.textContent).toBe("Message 3");

    vi.useRealTimers();
  });
});

