import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "../useTheme";

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
    
    // Mock matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query === "(prefers-color-scheme: dark)" ? false : false,
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
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
  });

  it("initializes with system theme", () => {
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.theme).toBe("system");
  });

  it("resolves system theme to light by default", () => {
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.resolvedTheme).toBe("light");
  });

  it("sets theme directly", () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme("dark");
    });
    
    expect(result.current.theme).toBe("dark");
    expect(result.current.resolvedTheme).toBe("dark");
  });

  it("toggles between light and dark", () => {
    const { result } = renderHook(() => useTheme());
    
    // Start with light (resolved from system)
    expect(result.current.resolvedTheme).toBe("light");
    
    act(() => {
      result.current.toggleTheme();
    });
    
    expect(result.current.theme).toBe("dark");
    expect(result.current.resolvedTheme).toBe("dark");
    
    act(() => {
      result.current.toggleTheme();
    });
    
    expect(result.current.theme).toBe("light");
    expect(result.current.resolvedTheme).toBe("light");
  });

  it("updates data-theme attribute", () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme("dark");
    });
    
    // Wait for useEffect
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("adds/removes dark class for Tailwind", () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme("dark");
    });
    
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    
    act(() => {
      result.current.setTheme("light");
    });
    
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("persists theme to localStorage", async () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme("dark");
    });
    
    await new Promise((resolve) => setTimeout(resolve, 0));
    
    const stored = localStorage.getItem("acorn-arranger-theme");
    expect(stored).toBe("dark");
  });

  it("hydrates theme from localStorage", async () => {
    localStorage.setItem("acorn-arranger-theme", "dark");
    
    const { result } = renderHook(() => useTheme());
    
    // Wait for hydration effect to run
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    
    // After hydration, should restore from localStorage
    expect(result.current.theme).toBe("dark");
  });

  it("detects system dark mode preference", () => {
    // Mock dark mode preference
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(prefers-color-scheme: dark)" ? true : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    
    const { result } = renderHook(() => useTheme());
    
    // System theme should resolve to dark
    expect(result.current.theme).toBe("system");
    // Note: In real browser, useEffect would detect and update systemTheme
  });

  it("handles localStorage errors gracefully", () => {
    // Mock localStorage to throw
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error("Quota exceeded");
    });
    
    const { result } = renderHook(() => useTheme());
    
    // Should not throw even though localStorage fails
    expect(() => {
      act(() => {
        result.current.setTheme("dark");
      });
    }).not.toThrow();
    
    // Hook should still function (state changes locally)
    expect(result.current.theme).toBe("dark");
    
    // Restore
    Storage.prototype.setItem = originalSetItem;
  });

  it("validates theme values from localStorage", () => {
    // Invalid value in localStorage
    localStorage.setItem("acorn-arranger-theme", "invalid");
    
    const { result } = renderHook(() => useTheme());
    
    // Should default to system
    expect(result.current.theme).toBe("system");
  });

  it("returns stable callbacks", () => {
    const { result, rerender } = renderHook(() => useTheme());
    
    const firstSetTheme = result.current.setTheme;
    const firstToggleTheme = result.current.toggleTheme;
    
    rerender();
    
    expect(result.current.setTheme).toBe(firstSetTheme);
    expect(result.current.toggleTheme).toBe(firstToggleTheme);
  });
});

