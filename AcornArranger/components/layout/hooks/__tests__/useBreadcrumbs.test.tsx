import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBreadcrumbs } from "../useBreadcrumbs";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("useBreadcrumbs", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("Root and Simple Paths", () => {
    it("returns only Dashboard for /dashboard", () => {
      const { result } = renderHook(() => useBreadcrumbs("/dashboard"), {
        wrapper: createWrapper(),
      });

      expect(result.current).toEqual([{ label: "Dashboard", href: "/dashboard" }]);
    });

    it("generates breadcrumbs for /dashboard/appointments", () => {
      const { result } = renderHook(() => useBreadcrumbs("/dashboard/appointments"), {
        wrapper: createWrapper(),
      });

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/dashboard" },
        { label: "Appointments", href: "/dashboard/appointments" },
      ]);
    });

    it("generates breadcrumbs for /dashboard/properties", () => {
      const { result } = renderHook(() => useBreadcrumbs("/dashboard/properties"), {
        wrapper: createWrapper(),
      });

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/dashboard" },
        { label: "Properties", href: "/dashboard/properties" },
      ]);
    });
  });

  describe("Deep Paths with Async Resolvers (React Query)", () => {
    it("shows a stable fallback immediately for appointments", async () => {
      const { result } = renderHook(() => useBreadcrumbs("/dashboard/appointments/123"), {
        wrapper: createWrapper(),
      });

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/dashboard" },
        { label: "Appointments", href: "/dashboard/appointments" },
        { label: "Appointment 123", href: "/dashboard/appointments/123", isLoading: true },
      ]);

      await waitFor(() => {
        expect(result.current[2]?.isLoading).toBe(false);
      });
    });

    it("shows a stable fallback immediately for properties and resolves loading state", async () => {
      const { result } = renderHook(() => useBreadcrumbs("/dashboard/properties/456/edit"), {
        wrapper: createWrapper(),
      });

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/dashboard" },
        { label: "Properties", href: "/dashboard/properties" },
        { label: "Property 456", href: "/dashboard/properties/456", isLoading: true },
        { label: "Edit", href: "/dashboard/properties/456/edit" },
      ]);

      await waitFor(() => {
        expect(result.current[2]?.isLoading).toBe(false);
      });
    });

    it("shows Staff {id} immediately and then resolves to the staff name", async () => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/staff/123")) {
          return new Response(
            JSON.stringify({
              user_id: 123,
              name: "Jane Doe",
              first_name: "Jane",
              last_name: "Doe",
              role: null,
              status: null,
              hb_user_id: null,
              capabilities: [],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      });

      globalThis.fetch = fetchMock as any;

      const { result } = renderHook(() => useBreadcrumbs("/dashboard/staff/123"), {
        wrapper: createWrapper(),
      });

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/dashboard" },
        { label: "Staff", href: "/dashboard/staff" },
        { label: "Staff 123", href: "/dashboard/staff/123", isLoading: true },
      ]);

      await waitFor(() => {
        expect(result.current[2]?.label).toBe("Jane Doe");
        expect(result.current[2]?.isLoading).toBe(false);
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Title Casing", () => {
    it("converts hyphenated segments to title case", () => {
      const { result } = renderHook(() => useBreadcrumbs("/user-settings"), {
        wrapper: createWrapper(),
      });

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/dashboard" },
        { label: "User Settings", href: "/user-settings" },
      ]);
    });
  });

  describe("Edge Cases", () => {
    it("handles trailing slashes", () => {
      const { result } = renderHook(() => useBreadcrumbs("/dashboard/appointments/"), {
        wrapper: createWrapper(),
      });

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/dashboard" },
        { label: "Appointments", href: "/dashboard/appointments" },
      ]);
    });

    it("handles paths without /dashboard prefix", () => {
      const { result } = renderHook(() => useBreadcrumbs("/appointments"), {
        wrapper: createWrapper(),
      });

      expect(result.current).toEqual([
        { label: "Dashboard", href: "/dashboard" },
        { label: "Appointments", href: "/appointments" },
      ]);
    });
  });
});

