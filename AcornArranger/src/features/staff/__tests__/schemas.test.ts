import { describe, it, expect } from "vitest";
import {
  RoleSchema,
  StatusSchema,
  StaffSchema,
  StaffListResponseSchema,
  StaffDetailResponseSchema,
  deriveCapabilities,
  hasCapability,
  formatStaffName,
  type Role,
  type Staff,
} from "../schemas";
import { StaffFiltersSchema } from "@/lib/filters/schemas";

describe("Staff Schemas", () => {
  describe("RoleSchema", () => {
    it("should parse valid role object", () => {
      const validRole = {
        id: 1,
        title: "Housekeeper",
        description: "Cleans properties",
        priority: 3,
        can_lead_team: false,
        can_clean: true,
      };

      const result = RoleSchema.safeParse(validRole);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(1);
        expect(result.data.title).toBe("Housekeeper");
        expect(result.data.can_clean).toBe(true);
        expect(result.data.can_lead_team).toBe(false);
      }
    });

    it("should apply defaults for priority and boolean flags", () => {
      const minimalRole = {
        id: 2,
        title: "Manager",
      };

      const result = RoleSchema.safeParse(minimalRole);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe(500);
        expect(result.data.can_lead_team).toBe(false);
        expect(result.data.can_clean).toBe(false);
      }
    });

    it("should reject invalid role (missing required fields)", () => {
      const invalidRole = {
        id: 1,
        // missing title
      };

      const result = RoleSchema.safeParse(invalidRole);
      expect(result.success).toBe(false);
    });

    it("should reject negative id", () => {
      const invalidRole = {
        id: -1,
        title: "Invalid",
      };

      const result = RoleSchema.safeParse(invalidRole);
      expect(result.success).toBe(false);
    });
  });

  describe("StatusSchema", () => {
    it("should parse all valid status types", () => {
      const statuses = [
        { status_id: 1, status: "Active" as const },
        { status_id: 2, status: "Inactive" as const },
        { status_id: 3, status: "Unverified" as const },
      ];

      statuses.forEach((status) => {
        const result = StatusSchema.safeParse(status);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status_id).toBe(status.status_id);
          expect(result.data.status).toBe(status.status);
        }
      });
    });

    it("should reject invalid status string", () => {
      const invalidStatus = {
        status_id: 1,
        status: "Unknown",
      };

      const result = StatusSchema.safeParse(invalidStatus);
      expect(result.success).toBe(false);
    });

    it("should reject non-positive status_id", () => {
      const invalidStatus = {
        status_id: 0,
        status: "Active",
      };

      const result = StatusSchema.safeParse(invalidStatus);
      expect(result.success).toBe(false);
    });
  });

  describe("StaffSchema", () => {
    it("should parse complete staff object", () => {
      const validStaff = {
        user_id: 123,
        name: "John Doe",
        first_name: "John",
        last_name: "Doe",
        role: {
          id: 1,
          title: "Housekeeper",
          priority: 3,
          can_lead_team: false,
          can_clean: true,
        },
        status: {
          status_id: 1,
          status: "Active" as const,
        },
        hb_user_id: 456,
      };

      const result = StaffSchema.safeParse(validStaff);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user_id).toBe(123);
        expect(result.data.name).toBe("John Doe");
        expect(result.data.role?.title).toBe("Housekeeper");
        expect(result.data.status?.status).toBe("Active");
        expect(result.data.hb_user_id).toBe(456);
      }
    });

    it("should parse minimal staff object (only user_id)", () => {
      const minimalStaff = {
        user_id: 789,
      };

      const result = StaffSchema.safeParse(minimalStaff);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user_id).toBe(789);
        expect(result.data.name).toBeUndefined();
        expect(result.data.role).toBeUndefined();
        expect(result.data.status).toBeUndefined();
      }
    });

    it("should accept null values for optional fields", () => {
      const staffWithNulls = {
        user_id: 100,
        name: null,
        first_name: null,
        last_name: null,
        role: null,
        status: null,
        hb_user_id: null,
      };

      const result = StaffSchema.safeParse(staffWithNulls);
      expect(result.success).toBe(true);
    });

    it("should reject missing user_id", () => {
      const invalidStaff = {
        name: "Jane Doe",
      };

      const result = StaffSchema.safeParse(invalidStaff);
      expect(result.success).toBe(false);
    });

    it("should reject non-positive user_id", () => {
      const invalidStaff = {
        user_id: -1,
        name: "Invalid Staff",
      };

      const result = StaffSchema.safeParse(invalidStaff);
      expect(result.success).toBe(false);
    });
  });

  describe("StaffListResponseSchema", () => {
    it("should parse valid list response", () => {
      const validResponse = {
        items: [
          { user_id: 1, name: "Staff 1" },
          { user_id: 2, name: "Staff 2" },
        ],
        total: 2,
      };

      const result = StaffListResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(2);
        expect(result.data.total).toBe(2);
      }
    });

    it("should accept empty list", () => {
      const emptyResponse = {
        items: [],
        total: 0,
      };

      const result = StaffListResponseSchema.safeParse(emptyResponse);
      expect(result.success).toBe(true);
    });

    it("should reject negative total", () => {
      const invalidResponse = {
        items: [],
        total: -1,
      };

      const result = StaffListResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe("StaffDetailResponseSchema", () => {
    it("should parse staff with capabilities", () => {
      const staffDetail = {
        user_id: 1,
        name: "John Doe",
        role: {
          id: 1,
          title: "Lead Housekeeper",
          priority: 2,
          can_lead_team: true,
          can_clean: true,
        },
        status: {
          status_id: 1,
          status: "Active" as const,
        },
        capabilities: ["can_clean", "can_lead_team"],
      };

      const result = StaffDetailResponseSchema.safeParse(staffDetail);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.capabilities).toEqual(["can_clean", "can_lead_team"]);
      }
    });
  });

  describe("StaffFiltersSchema", () => {
    it("should parse filters with canClean and canLeadTeam", () => {
      const filters = {
        q: "John",
        page: 1,
        pageSize: 25,
        sort: "name:asc",
        statusIds: [1, 2],
        roleIds: [1, 2, 3],
        canClean: true,
        canLeadTeam: false,
      };

      const result = StaffFiltersSchema.safeParse(filters);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.canClean).toBe(true);
        expect(result.data.canLeadTeam).toBe(false);
        expect(result.data.roleIds).toEqual([1, 2, 3]);
      }
    });

    it("should accept filters without capability flags", () => {
      const filters = {
        q: "Jane",
        page: 1,
        pageSize: 10,
        statusIds: [1],
      };

      const result = StaffFiltersSchema.safeParse(filters);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.canClean).toBeUndefined();
        expect(result.data.canLeadTeam).toBeUndefined();
      }
    });

    it("should apply default values for base fields", () => {
      const minimalFilters = {};

      const result = StaffFiltersSchema.safeParse(minimalFilters);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.q).toBe("");
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(25);
        expect(result.data.sort).toBe("");
        expect(result.data.statusIds).toEqual([]);
        expect(result.data.roleIds).toEqual([]);
      }
    });
  });

  describe("deriveCapabilities", () => {
    it("should return both capabilities when both flags are true", () => {
      const role: Role = {
        id: 1,
        title: "Lead Housekeeper",
        priority: 2,
        can_lead_team: true,
        can_clean: true,
      };

      const capabilities = deriveCapabilities(role);
      expect(capabilities).toEqual(["can_clean", "can_lead_team"]);
    });

    it("should return only can_clean when can_lead_team is false", () => {
      const role: Role = {
        id: 1,
        title: "Housekeeper",
        priority: 3,
        can_lead_team: false,
        can_clean: true,
      };

      const capabilities = deriveCapabilities(role);
      expect(capabilities).toEqual(["can_clean"]);
    });

    it("should return only can_lead_team when can_clean is false", () => {
      const role: Role = {
        id: 1,
        title: "Manager",
        priority: 4,
        can_lead_team: true,
        can_clean: false,
      };

      const capabilities = deriveCapabilities(role);
      expect(capabilities).toEqual(["can_lead_team"]);
    });

    it("should return empty array when both flags are false", () => {
      const role: Role = {
        id: 1,
        title: "Administrator",
        priority: 5,
        can_lead_team: false,
        can_clean: false,
      };

      const capabilities = deriveCapabilities(role);
      expect(capabilities).toEqual([]);
    });

    it("should return empty array for null role", () => {
      const capabilities = deriveCapabilities(null);
      expect(capabilities).toEqual([]);
    });

    it("should return empty array for undefined role", () => {
      const capabilities = deriveCapabilities(undefined);
      expect(capabilities).toEqual([]);
    });
  });

  describe("hasCapability", () => {
    it("should return true when staff has can_clean capability", () => {
      const staff: Staff = {
        user_id: 1,
        role: {
          id: 1,
          title: "Housekeeper",
          priority: 3,
          can_lead_team: false,
          can_clean: true,
        },
      };

      expect(hasCapability(staff, "can_clean")).toBe(true);
      expect(hasCapability(staff, "can_lead_team")).toBe(false);
    });

    it("should return true when staff has can_lead_team capability", () => {
      const staff: Staff = {
        user_id: 1,
        role: {
          id: 1,
          title: "Lead Housekeeper",
          priority: 2,
          can_lead_team: true,
          can_clean: true,
        },
      };

      expect(hasCapability(staff, "can_clean")).toBe(true);
      expect(hasCapability(staff, "can_lead_team")).toBe(true);
    });

    it("should return false when staff has no role", () => {
      const staff: Staff = {
        user_id: 1,
        role: null,
      };

      expect(hasCapability(staff, "can_clean")).toBe(false);
      expect(hasCapability(staff, "can_lead_team")).toBe(false);
    });

    it("should return false when staff role is undefined", () => {
      const staff: Staff = {
        user_id: 1,
      };

      expect(hasCapability(staff, "can_clean")).toBe(false);
      expect(hasCapability(staff, "can_lead_team")).toBe(false);
    });
  });

  describe("formatStaffName", () => {
    it("should use name field when available", () => {
      const staff: Staff = {
        user_id: 1,
        name: "John Doe",
        first_name: "John",
        last_name: "Doe",
      };

      expect(formatStaffName(staff)).toBe("John Doe");
    });

    it("should combine first_name and last_name when name is not available", () => {
      const staff: Staff = {
        user_id: 1,
        first_name: "Jane",
        last_name: "Smith",
      };

      expect(formatStaffName(staff)).toBe("Jane Smith");
    });

    it("should use only first_name when last_name is not available", () => {
      const staff: Staff = {
        user_id: 1,
        first_name: "Alice",
      };

      expect(formatStaffName(staff)).toBe("Alice");
    });

    it("should fall back to user_id when no name fields are available", () => {
      const staff: Staff = {
        user_id: 123,
      };

      expect(formatStaffName(staff)).toBe("Staff 123");
    });

    it("should prefer name over first_name/last_name combination", () => {
      const staff: Staff = {
        user_id: 1,
        name: "Johnny Doe",
        first_name: "John",
        last_name: "Doe",
      };

      expect(formatStaffName(staff)).toBe("Johnny Doe");
    });
  });
});
