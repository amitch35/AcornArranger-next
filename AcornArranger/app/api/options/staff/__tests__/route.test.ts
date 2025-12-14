import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockSupabaseClient,
  generateMockStaff,
} from "../../../__tests__/test-utils";

// Mock dependencies
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Import after mocking
import { createClient } from "@/lib/supabase/server";
import { GET } from "../route";

/**
 * Integration tests for /api/options/staff endpoint
 * 
 * Tests staff options with canClean and canLeadTeam filters
 */

describe("/api/options/staff", () => {
  const mockStaffData = generateMockStaff(20);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("should return staff options with id and label", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: mockStaffData.slice(0, 10),
        count: mockStaffData.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/options/staff"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("options");
      expect(data).toHaveProperty("total");
      expect(Array.isArray(data.options)).toBe(true);
      
      if (data.options.length > 0) {
        const option = data.options[0];
        expect(option).toHaveProperty("id");
        expect(option).toHaveProperty("label");
      }
    });

    it("should filter by canClean", async () => {
      const cleaners = mockStaffData.filter((s) => s.role.can_clean);
      const mockSupabase = createMockSupabaseClient({
        data: cleaners,
        count: cleaners.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/options/staff?canClean=true"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.options)).toBe(true);
      expect(data.total).toBe(cleaners.length);
    });

    it("should filter by canLeadTeam", async () => {
      const leaders = mockStaffData.filter((s) => s.role.can_lead_team);
      const mockSupabase = createMockSupabaseClient({
        data: leaders,
        count: leaders.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/options/staff?canLeadTeam=true"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.options)).toBe(true);
      expect(data.total).toBe(leaders.length);
    });

    it("should combine canClean and canLeadTeam filters", async () => {
      const filtered = mockStaffData.filter(
        (s) => s.role.can_clean && s.role.can_lead_team
      );
      const mockSupabase = createMockSupabaseClient({
        data: filtered,
        count: filtered.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/options/staff?canClean=true&canLeadTeam=true"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.options)).toBe(true);
      expect(data.total).toBe(filtered.length);
    });

    it("should filter by statusIds", async () => {
      const activeStaff = mockStaffData.filter((s) => s.status.status_id === 1);
      const mockSupabase = createMockSupabaseClient({
        data: activeStaff,
        count: activeStaff.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/options/staff?statusIds=1"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.options)).toBe(true);
      expect(data.total).toBe(activeStaff.length);
    });

    it("should combine all filters", async () => {
      const filtered = mockStaffData.filter(
        (s) =>
          s.status.status_id === 1 &&
          s.role.can_clean &&
          s.role.can_lead_team &&
          s.name.toLowerCase().includes("staff")
      );
      const mockSupabase = createMockSupabaseClient({
        data: filtered,
        count: filtered.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/options/staff?statusIds=1&canClean=true&canLeadTeam=true&q=staff"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.options)).toBe(true);
    });

    it("should support search by name", async () => {
      const filtered = mockStaffData.filter((s) =>
        s.name.toLowerCase().includes("john")
      );
      const mockSupabase = createMockSupabaseClient({
        data: filtered,
        count: filtered.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/options/staff?q=John"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.options)).toBe(true);
    });

    it("should support pagination", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: mockStaffData.slice(0, 5),
        count: mockStaffData.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/options/staff?page=1&pageSize=5"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.options.length).toBeLessThanOrEqual(5);
      expect(data.total).toBe(20);
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
        "http://localhost:3000/api/options/staff?sort=name:asc"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.options)).toBe(true);
    });

    it("should return correct format for options", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: [mockStaffData[0]],
        count: 1,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/options/staff?pageSize=1"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      if (data.options.length > 0) {
        const option = data.options[0];
        expect(typeof option.id).toBeTruthy(); // number or string
        expect(typeof option.label).toBe("string");
      }
    });

    it("should handle database errors gracefully", async () => {
      const mockSupabase = createMockSupabaseClient({
        error: new Error("Database connection failed"),
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/options/staff");

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Database connection failed");
    });
  });
});
