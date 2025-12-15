import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBreadcrumbs } from "../useBreadcrumbs";

describe("useBreadcrumbs", () => {
  describe("Root and Simple Paths", () => {
    it("returns only Dashboard for /dashboard", () => {
      const { result } = renderHook(() => useBreadcrumbs("/dashboard"));

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/dashboard" },
      ]);
    });

    it("generates breadcrumbs for /dashboard/appointments", () => {
      const { result } = renderHook(() => useBreadcrumbs("/dashboard/appointments"));

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/dashboard" },
        { label: "Appointments", href: "/dashboard/appointments" },
      ]);
    });

    it("generates breadcrumbs for /dashboard/properties", () => {
      const { result } = renderHook(() => useBreadcrumbs("/dashboard/properties"));

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/dashboard" },
        { label: "Properties", href: "/dashboard/properties" },
      ]);
    });
  });

  describe("Deep Paths with Async Resolvers", () => {
    it("generates breadcrumbs with loading state for dynamic routes", () => {
      const { result } = renderHook(() =>
        useBreadcrumbs("/dashboard/appointments/123")
      );

      // Dynamic segments should show loading initially
      expect(result.current).toEqual([
        { label: "Dashboard", href: "/dashboard" },
        { label: "Appointments", href: "/dashboard/appointments" },
        { label: "Loading...", href: "/dashboard/appointments/123", isLoading: true },
      ]);
    });

    it("generates breadcrumbs with loading state and static segments", () => {
      const { result } = renderHook(() =>
        useBreadcrumbs("/dashboard/properties/456/edit")
      );

      // Dynamic ID segment shows loading, static "edit" shows immediately
      expect(result.current).toEqual([
        { label: "Dashboard", href: "/dashboard" },
        { label: "Properties", href: "/dashboard/properties" },
        { label: "Loading...", href: "/dashboard/properties/456", isLoading: true },
        { label: "Edit", href: "/dashboard/properties/456/edit" },
      ]);
    });
  });

  describe("Title Casing", () => {
    it("converts hyphenated segments to title case", () => {
      const { result } = renderHook(() =>
        useBreadcrumbs("/user-settings")
      );

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/dashboard" },
        { label: "User Settings", href: "/user-settings" },
      ]);
    });
  });

  describe("Edge Cases", () => {
    it("handles trailing slashes", () => {
      const { result } = renderHook(() =>
        useBreadcrumbs("/dashboard/appointments/")
      );

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/dashboard" },
        { label: "Appointments", href: "/dashboard/appointments" },
      ]);
    });

    it("handles paths without /dashboard prefix", () => {
      const { result } = renderHook(() => useBreadcrumbs("/appointments"));
      // We still always include Dashboard as the root crumb, and then fall back
      // to title-casing for unknown roots.
      expect(result.current).toEqual([
        { label: "Dashboard", href: "/dashboard" },
        { label: "Appointments", href: "/appointments" },
      ]);
    });
  });

  describe("Memoization", () => {
    it("returns same reference for same pathname", () => {
      const { result, rerender } = renderHook(
        ({ pathname }) => useBreadcrumbs(pathname),
        { initialProps: { pathname: "/dashboard/appointments" } }
      );

      const firstResult = result.current;
      rerender({ pathname: "/dashboard/appointments" });
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });

    it("returns different reference for different pathname", () => {
      const { result, rerender } = renderHook(
        ({ pathname }) => useBreadcrumbs(pathname),
        { initialProps: { pathname: "/dashboard/appointments" } }
      );

      const firstResult = result.current;
      rerender({ pathname: "/dashboard/properties" });
      const secondResult = result.current;

      expect(firstResult).not.toBe(secondResult);
    });
  });
});

