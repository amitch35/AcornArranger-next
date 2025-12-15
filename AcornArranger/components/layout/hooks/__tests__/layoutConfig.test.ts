import { describe, it, expect } from "vitest";
import {
  isPathActive,
  extractParams,
  findBreadcrumbResolver,
  getVisibleNavItems,
  navigationConfig,
  type UserContext,
  type NavigationItem,
} from "../../layoutConfig";
import { Home } from "lucide-react";

describe("layoutConfig utilities", () => {
  describe("isPathActive", () => {
    it("matches exact paths", () => {
      expect(isPathActive("/dashboard", "/dashboard")).toBe(true);
      expect(isPathActive("/dashboard/appointments", "/dashboard/appointments")).toBe(true);
    });

    it("matches prefix paths (except root)", () => {
      expect(isPathActive("/dashboard/appointments/123", "/dashboard/appointments")).toBe(true);
      expect(isPathActive("/dashboard/properties/456/edit", "/dashboard/properties")).toBe(true);
    });

    it("does not match unrelated paths", () => {
      expect(isPathActive("/dashboard/appointments", "/dashboard/properties")).toBe(false);
      expect(isPathActive("/dashboard/staff", "/dashboard/schedule")).toBe(false);
    });

    it("does not match root with prefix", () => {
      // Root should only match exactly, not as prefix
      expect(isPathActive("/dashboard/appointments", "/dashboard")).toBe(false);
    });

    it("normalizes trailing slashes for matching", () => {
      // Trailing slashes are normalized, so these should match
      expect(isPathActive("/dashboard/appointments/", "/dashboard/appointments")).toBe(true);
      expect(isPathActive("/dashboard/appointments", "/dashboard/appointments/")).toBe(true);
    });
  });

  describe("extractParams", () => {
    it("extracts single parameter", () => {
      const pattern = /^\/dashboard\/properties\/([^\/]+)$/;
      const params = extractParams("/dashboard/properties/123", pattern);

      expect(params).toEqual({
        "0": "123",
        id: "123",
      });
    });

    it("extracts multiple parameters", () => {
      const pattern = /^\/dashboard\/appointments\/([^\/]+)\/edit$/;
      const params = extractParams("/dashboard/appointments/456/edit", pattern);

      expect(params).toEqual({
        "0": "456",
        id: "456",
      });
    });

    it("returns empty object for non-matching path", () => {
      const pattern = /^\/dashboard\/properties\/([^\/]+)$/;
      const params = extractParams("/dashboard/appointments/123", pattern);

      expect(params).toEqual({});
    });

    it("handles named capture groups", () => {
      const pattern = /^\/(?<entity>[^\/]+)\/(?<id>[^\/]+)$/;
      const params = extractParams("/properties/789", pattern);

      expect(params.entity).toBe("properties");
      expect(params.id).toBe("789");
    });
  });

  describe("findBreadcrumbResolver", () => {
    it("finds resolver for matching path", () => {
      const resolver = findBreadcrumbResolver("/dashboard/properties/123");
      expect(resolver).toBeDefined();
      expect(resolver?.pattern).toBeDefined();
    });

    it("returns undefined for non-matching path", () => {
      const resolver = findBreadcrumbResolver("/some/random/path");
      expect(resolver).toBeUndefined();
    });

    it("finds resolver for staff paths", () => {
      const resolver = findBreadcrumbResolver("/dashboard/staff/456");
      expect(resolver).toBeDefined();
    });

    it("finds resolver for appointment paths", () => {
      const resolver = findBreadcrumbResolver("/dashboard/appointments/789");
      expect(resolver).toBeDefined();
    });
  });

  describe("getVisibleNavItems", () => {
    const testItems: NavigationItem[] = [
      {
        label: "Public",
        href: "/public",
        icon: Home,
        // No visibility predicate - always visible
      },
      {
        label: "Auth Required",
        href: "/auth",
        icon: Home,
        visible: (user) => user.isAuthenticated,
      },
      {
        label: "Admin Only",
        href: "/admin",
        icon: Home,
        visible: (user) => user.roles?.includes("admin") ?? false,
      },
    ];

    it("shows all items with no visibility predicates", () => {
      const user: UserContext = { isAuthenticated: false };
      const visible = getVisibleNavItems([testItems[0]], user);

      expect(visible).toHaveLength(1);
      expect(visible[0].label).toBe("Public");
    });

    it("filters items based on authentication", () => {
      const authenticatedUser: UserContext = { isAuthenticated: true };
      const visible = getVisibleNavItems(testItems, authenticatedUser);

      expect(visible).toHaveLength(2);
      expect(visible.map((i) => i.label)).toContain("Public");
      expect(visible.map((i) => i.label)).toContain("Auth Required");
      expect(visible.map((i) => i.label)).not.toContain("Admin Only");
    });

    it("filters items based on roles", () => {
      const adminUser: UserContext = {
        isAuthenticated: true,
        roles: ["admin"],
      };
      const visible = getVisibleNavItems(testItems, adminUser);

      expect(visible).toHaveLength(3);
      expect(visible.map((i) => i.label)).toContain("Admin Only");
    });

    it("shows only public items to unauthenticated users", () => {
      const unauthUser: UserContext = { isAuthenticated: false };
      const visible = getVisibleNavItems(testItems, unauthUser);

      expect(visible).toHaveLength(1);
      expect(visible[0].label).toBe("Public");
    });

    it("works with actual navigationConfig", () => {
      const user: UserContext = { isAuthenticated: true };
      const visible = getVisibleNavItems(navigationConfig, user);

      // All items should be visible to authenticated users
      expect(visible.length).toBeGreaterThan(0);
    });
  });
});

