import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockSupabaseClient,
  generateMockStaff,
} from "../../__tests__/test-utils";

// Mock dependencies BEFORE importing the route
vi.mock("@/lib/apiGuard", () => ({
  withAuth: (handler: any) => handler, // Bypass auth
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Import after mocking
import { createClient } from "@/lib/supabase/server";
import { GET, POST, PUT, DELETE, PATCH } from "../route";

/**
 * Integration tests for /api/staff endpoint
 * 
 * Tests full staff list with filtering, sorting, and pagination
 */

describe("/api/staff", () => {
  const mockStaffData = generateMockStaff(28);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("should return paginated staff list", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: mockStaffData.slice(0, 10),
        count: mockStaffData.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/staff?page=1&pageSize=10"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("items");
      expect(data).toHaveProperty("total");
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items).toHaveLength(10);
      expect(data.total).toBe(28);
    });

    it("should filter by statusIds", async () => {
      const activeStaff = mockStaffData.filter((s) => s.status.status_id === 1);
      const mockSupabase = createMockSupabaseClient({
        data: activeStaff,
        count: activeStaff.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/staff?statusIds=1"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.total).toBe(activeStaff.length);
    });

    it("should filter by multiple statusIds", async () => {
      const filteredStaff = mockStaffData.filter(
        (s) => s.status.status_id === 1 || s.status.status_id === 2
      );
      const mockSupabase = createMockSupabaseClient({
        data: filteredStaff,
        count: filteredStaff.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/staff?statusIds=1,2"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should filter by roleIds", async () => {
      const filteredStaff = mockStaffData.filter((s) => s.role.id === 1);
      const mockSupabase = createMockSupabaseClient({
        data: filteredStaff,
        count: filteredStaff.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/staff?roleIds=1,2"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should filter by canClean", async () => {
      const cleaners = mockStaffData.filter((s) => s.role.can_clean);
      const mockSupabase = createMockSupabaseClient({
        data: cleaners,
        count: cleaners.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/staff?canClean=true"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.total).toBe(cleaners.length);
      
      // Verify all returned staff can clean
      data.items.forEach((staff: any) => {
        if (staff.role) {
          expect(staff.role.can_clean).toBe(true);
        }
      });
    });

    it("should filter by canLeadTeam", async () => {
      const leaders = mockStaffData.filter((s) => s.role.can_lead_team);
      const mockSupabase = createMockSupabaseClient({
        data: leaders,
        count: leaders.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/staff?canLeadTeam=true"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.total).toBe(leaders.length);
      
      // Verify all returned staff can lead team
      data.items.forEach((staff: any) => {
        if (staff.role) {
          expect(staff.role.can_lead_team).toBe(true);
        }
      });
    });

    it("should combine multiple filters", async () => {
      const filtered = mockStaffData.filter(
        (s) =>
          s.status.status_id === 1 &&
          s.role.can_clean &&
          s.role.can_lead_team
      );
      const mockSupabase = createMockSupabaseClient({
        data: filtered,
        count: filtered.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/staff?statusIds=1&canClean=true&canLeadTeam=true"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should search by name", async () => {
      const filtered = mockStaffData.filter((s) =>
        s.name.toLowerCase().includes("staff")
      );
      const mockSupabase = createMockSupabaseClient({
        data: filtered,
        count: filtered.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/staff?q=staff"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should support sorting", async () => {
      const sorted = [...mockStaffData].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      const mockSupabase = createMockSupabaseClient({
        data: sorted.slice(0, 10),
        count: sorted.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/staff?sort=name:asc"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should respect pagination", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: mockStaffData.slice(0, 5),
        count: mockStaffData.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/staff?page=1&pageSize=5"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items.length).toBeLessThanOrEqual(5);
      expect(data.total).toBe(28);
    });

    it("should return all required fields", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: [mockStaffData[0]],
        count: 1,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/staff?pageSize=1"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      if (data.items.length > 0) {
        const staff = data.items[0];
        expect(staff).toHaveProperty("user_id");
        expect(typeof staff.user_id).toBe("number");
        expect(staff).toHaveProperty("name");
        expect(staff).toHaveProperty("first_name");
        expect(staff).toHaveProperty("last_name");
        expect(staff).toHaveProperty("role");
        expect(staff).toHaveProperty("status");
      }
    });

    it("should handle database errors gracefully", async () => {
      const mockSupabase = createMockSupabaseClient({
        error: new Error("Database error"),
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/staff");

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Database error");
    });
  });

  describe("Non-GET methods", () => {
    it("should reject POST requests", async () => {
      const response = await POST();
      expect(response.status).toBe(405);
      
      const data = await response.json();
      expect(data.error).toBe("Method not allowed");
    });

    it("should reject PUT requests", async () => {
      const response = await PUT();
      expect(response.status).toBe(405);
      
      const data = await response.json();
      expect(data.error).toBe("Method not allowed");
    });

    it("should reject DELETE requests", async () => {
      const response = await DELETE();
      expect(response.status).toBe(405);
      
      const data = await response.json();
      expect(data.error).toBe("Method not allowed");
    });

    it("should reject PATCH requests", async () => {
      const response = await PATCH();
      expect(response.status).toBe(405);
      
      const data = await response.json();
      expect(data.error).toBe("Method not allowed");
    });
  });
});
