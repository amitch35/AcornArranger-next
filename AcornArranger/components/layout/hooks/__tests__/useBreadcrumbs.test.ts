import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBreadcrumbs } from "../useBreadcrumbs";

describe("useBreadcrumbs", () => {
  describe("Root and Simple Paths", () => {
    it("returns only Dashboard for /protected", () => {
      const { result } = renderHook(() => useBreadcrumbs("/protected"));

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/protected" },
      ]);
    });

    it("generates breadcrumbs for /protected/appointments", () => {
      const { result } = renderHook(() => useBreadcrumbs("/protected/appointments"));

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/protected" },
        { label: "Appointments", href: "/protected/appointments" },
      ]);
    });

    it("generates breadcrumbs for /protected/properties", () => {
      const { result } = renderHook(() => useBreadcrumbs("/protected/properties"));

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/protected" },
        { label: "Properties", href: "/protected/properties" },
      ]);
    });
  });

  describe("Deep Paths", () => {
    it("generates breadcrumbs for /protected/appointments/123", () => {
      const { result } = renderHook(() =>
        useBreadcrumbs("/protected/appointments/123")
      );

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/protected" },
        { label: "Appointments", href: "/protected/appointments" },
        { label: "123", href: "/protected/appointments/123" },
      ]);
    });

    it("generates breadcrumbs for /protected/properties/456/edit", () => {
      const { result } = renderHook(() =>
        useBreadcrumbs("/protected/properties/456/edit")
      );

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/protected" },
        { label: "Properties", href: "/protected/properties" },
        { label: "456", href: "/protected/properties/456" },
        { label: "Edit", href: "/protected/properties/456/edit" },
      ]);
    });
  });

  describe("Title Casing", () => {
    it("converts hyphenated segments to title case", () => {
      const { result } = renderHook(() =>
        useBreadcrumbs("/protected/user-settings")
      );

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/protected" },
        { label: "User Settings", href: "/protected/user-settings" },
      ]);
    });
  });

  describe("Edge Cases", () => {
    it("handles trailing slashes", () => {
      const { result } = renderHook(() =>
        useBreadcrumbs("/protected/appointments/")
      );

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/protected" },
        { label: "Appointments", href: "/protected/appointments" },
      ]);
    });

    it("handles paths without /protected prefix", () => {
      const { result } = renderHook(() => useBreadcrumbs("/appointments"));

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/protected" },
        { label: "Appointments", href: "/appointments" },
      ]);
    });
  });

  describe("Memoization", () => {
    it("returns same reference for same pathname", () => {
      const { result, rerender } = renderHook(
        ({ pathname }) => useBreadcrumbs(pathname),
        { initialProps: { pathname: "/protected/appointments" } }
      );

      const firstResult = result.current;
      rerender({ pathname: "/protected/appointments" });
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });

    it("returns different reference for different pathname", () => {
      const { result, rerender } = renderHook(
        ({ pathname }) => useBreadcrumbs(pathname),
        { initialProps: { pathname: "/protected/appointments" } }
      );

      const firstResult = result.current;
      rerender({ pathname: "/protected/properties" });
      const secondResult = result.current;

      expect(firstResult).not.toBe(secondResult);
    });
  });
});

