import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSidebarState } from "../useSidebarState";

describe("useSidebarState", () => {
  beforeEach(() => {
    localStorage.clear();
    // Mock matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("initializes with default collapsed state (false)", () => {
    const { result } = renderHook(() => useSidebarState());
    
    expect(result.current.collapsed).toBe(false);
  });

  it("accepts custom default collapsed state", () => {
    const { result } = renderHook(() =>
      useSidebarState({ defaultCollapsed: true })
    );
    
    expect(result.current.collapsed).toBe(true);
  });

  it("toggles collapsed state", () => {
    const { result } = renderHook(() => useSidebarState());
    
    expect(result.current.collapsed).toBe(false);
    
    act(() => {
      result.current.toggle();
    });
    
    expect(result.current.collapsed).toBe(true);
    
    act(() => {
      result.current.toggle();
    });
    
    expect(result.current.collapsed).toBe(false);
  });

  it("sets collapsed state directly", () => {
    const { result } = renderHook(() => useSidebarState());
    
    act(() => {
      result.current.setCollapsed(true);
    });
    
    expect(result.current.collapsed).toBe(true);
    
    act(() => {
      result.current.setCollapsed(false);
    });
    
    expect(result.current.collapsed).toBe(false);
  });

  it("persists state to localStorage", async () => {
    const { result } = renderHook(() => useSidebarState());
    
    act(() => {
      result.current.toggle();
    });
    
    // Wait for useEffect to run
    await new Promise((resolve) => setTimeout(resolve, 0));
    
    const stored = localStorage.getItem("acorn-arranger-sidebar-collapsed");
    expect(stored).toBe("true");
  });

  it("hydrates state from localStorage", async () => {
    // Pre-populate localStorage
    localStorage.setItem("acorn-arranger-sidebar-collapsed", "true");
    
    const { result } = renderHook(() => useSidebarState());
    
    // Wait for hydration effect to run
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    
    // After hydration, should restore from localStorage
    expect(result.current.collapsed).toBe(true);
  });

  it("uses custom storage key", async () => {
    const customKey = "custom-sidebar-key";
    const { result } = renderHook(() =>
      useSidebarState({ storageKey: customKey })
    );
    
    act(() => {
      result.current.toggle();
    });
    
    await new Promise((resolve) => setTimeout(resolve, 0));
    
    const stored = localStorage.getItem(customKey);
    expect(stored).toBe("true");
  });

  it("detects prefers-reduced-motion", () => {
    const { result } = renderHook(() => useSidebarState());
    
    // Initially false (mocked matchMedia returns false)
    expect(result.current.prefersReducedMotion).toBe(false);
  });

  it("handles localStorage errors gracefully", async () => {
    // Mock localStorage to throw
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error("Quota exceeded");
    });
    
    const { result } = renderHook(() => useSidebarState());
    
    // Should not throw even though localStorage fails
    expect(() => {
      act(() => {
        result.current.toggle();
      });
    }).not.toThrow();
    
    // Hook should still function (state changes locally)
    expect(result.current.collapsed).toBe(true);
    
    // Restore
    Storage.prototype.setItem = originalSetItem;
  });

  it("returns stable callbacks", () => {
    const { result, rerender } = renderHook(() => useSidebarState());
    
    const firstToggle = result.current.toggle;
    const firstSetCollapsed = result.current.setCollapsed;
    
    rerender();
    
    expect(result.current.toggle).toBe(firstToggle);
    expect(result.current.setCollapsed).toBe(firstSetCollapsed);
  });
});

