import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockSupabaseClient,
  generateMockStaff,
} from "../../../__tests__/test-utils";

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
 * Integration tests for /api/staff/[user_id] endpoint
 * 
 * Tests single staff detail with capabilities
 */

describe("/api/staff/[user_id]", () => {
  const mockStaffData = generateMockStaff(5);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("should return staff detail with capabilities", async () => {
      const staffMember = mockStaffData[0];
      const mockSupabase = createMockSupabaseClient({
        data: [staffMember],
        count: 1,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/staff/1");
      const params = { user_id: "1" };

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("user_id");
      expect(data).toHaveProperty("capabilities");
      expect(Array.isArray(data.capabilities)).toBe(true);
    });

    it("should derive capabilities from role flags", async () => {
      const staffMember = {
        ...mockStaffData[1], // Lead Housekeeper
        role: {
          id: 2,
          title: "Lead Housekeeper",
          description: null,
          priority: 2,
          can_clean: true,
          can_lead_team: true,
        },
      };

      const mockSupabase = createMockSupabaseClient({
        data: [staffMember],
        count: 1,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/staff/2");
      const params = { user_id: "2" };

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.capabilities).toContain("can_clean");
      expect(data.capabilities).toContain("can_lead_team");
    });

    it("should return all required fields", async () => {
      const staffMember = mockStaffData[0];
      const mockSupabase = createMockSupabaseClient({
        data: [staffMember],
        count: 1,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/staff/1");
      const params = { user_id: "1" };

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("user_id");
      expect(typeof data.user_id).toBe("number");
      expect(data).toHaveProperty("name");
      expect(data).toHaveProperty("first_name");
      expect(data).toHaveProperty("last_name");
      expect(data).toHaveProperty("role");
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("capabilities");
    });

    it("should return 404 for non-existent user_id", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: [],
        count: 0,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/staff/999999");
      const params = { user_id: "999999" };

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Staff not found");
    });

    it("should return 400 for invalid user_id", async () => {
      const req = new NextRequest("http://localhost:3000/api/staff/invalid");
      const params = { user_id: "invalid" };

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid user_id");
    });

    it("should return 400 for negative user_id", async () => {
      const req = new NextRequest("http://localhost:3000/api/staff/-1");
      const params = { user_id: "-1" };

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid user_id");
    });

    it("should return 400 for zero user_id", async () => {
      const req = new NextRequest("http://localhost:3000/api/staff/0");
      const params = { user_id: "0" };

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid user_id");
    });

    it("should include role details when available", async () => {
      const staffMember = mockStaffData[0];
      const mockSupabase = createMockSupabaseClient({
        data: [staffMember],
        count: 1,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/staff/1");
      const params = { user_id: "1" };

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      
      if (data.role) {
        expect(data.role).toHaveProperty("id");
        expect(data.role).toHaveProperty("title");
        expect(data.role).toHaveProperty("priority");
        expect(data.role).toHaveProperty("can_clean");
        expect(data.role).toHaveProperty("can_lead_team");
      }
    });

    it("should include status details when available", async () => {
      const staffMember = mockStaffData[0];
      const mockSupabase = createMockSupabaseClient({
        data: [staffMember],
        count: 1,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/staff/1");
      const params = { user_id: "1" };

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      
      if (data.status) {
        expect(data.status).toHaveProperty("status_id");
        expect(data.status).toHaveProperty("status");
        expect(["Active", "Inactive", "Unverified"]).toContain(data.status.status);
      }
    });

    it("should handle database errors gracefully", async () => {
      const mockSupabase = createMockSupabaseClient({
        error: new Error("Database error"),
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/staff/1");
      const params = { user_id: "1" };

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Database error");
    });

    it("should return empty capabilities array for staff with no role", async () => {
      const staffMember = {
        ...mockStaffData[0],
        role: null,
      };
      const mockSupabase = createMockSupabaseClient({
        data: [staffMember],
        count: 1,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/staff/1");
      const params = { user_id: "1" };

      const response = await GET(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.capabilities).toEqual([]);
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
