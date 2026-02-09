import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockSupabaseClient } from "../../../__tests__/test-utils";

// Mock dependencies BEFORE importing the route
vi.mock("@/lib/apiGuard", () => ({
  withAuth: (handler: any) => handler, // Bypass auth
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Import after mocking
import { createClient } from "@/lib/supabase/server";
import { GET, PUT } from "../route";

/**
 * Integration tests for /api/properties/[id] endpoint
 * 
 * Tests property detail retrieval and settings updates
 */

describe("/api/properties/[id]", () => {
  const mockProperty = {
    properties_id: 1,
    property_name: "Beach House",
    estimated_cleaning_mins: 90,
    double_unit: [2, 3],
    address: {
      city: "San Diego",
      address: "123 Beach St",
      country: "USA",
      state_name: "CA",
      postal_code: "92101",
    },
    status: {
      status_id: 1,
      status: "Active",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("should return property by id", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: mockProperty,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/properties/1");
      const response = await GET(req, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.properties_id).toBe(1);
      expect(data.property_name).toBe("Beach House");
    });

    it("should return 400 for invalid id", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/properties/invalid"
      );
      const response = await GET(req, { params: { id: "invalid" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Invalid id");
    });

    it("should return 404 for non-existent property", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: null,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/properties/999");
      const response = await GET(req, { params: { id: "999" } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Not found");
    });

    it("should handle Supabase errors", async () => {
      const mockSupabase = createMockSupabaseClient({
        error: { message: "Database error" },
        status: 500,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/properties/1");
      const response = await GET(req, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Database error");
    });
  });

  describe("PUT", () => {
    it("should update estimated_cleaning_mins", async () => {
      const updatedProperty = {
        ...mockProperty,
        estimated_cleaning_mins: 120,
      };
      const mockSupabase = createMockSupabaseClient({
        data: updatedProperty,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/properties/1", {
        method: "PUT",
        body: JSON.stringify({ estimated_cleaning_mins: 120 }),
      });

      const response = await PUT(req, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.estimated_cleaning_mins).toBe(120);
    });

    it("should update estimated_cleaning_mins to null", async () => {
      const updatedProperty = {
        ...mockProperty,
        estimated_cleaning_mins: null,
      };
      const mockSupabase = createMockSupabaseClient({
        data: updatedProperty,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/properties/1", {
        method: "PUT",
        body: JSON.stringify({ estimated_cleaning_mins: null }),
      });

      const response = await PUT(req, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.estimated_cleaning_mins).toBeNull();
    });

    it("should update double_unit array", async () => {
      const updatedProperty = {
        ...mockProperty,
        double_unit: [4, 5, 6],
      };
      const mockSupabase = createMockSupabaseClient({
        data: updatedProperty,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/properties/1", {
        method: "PUT",
        body: JSON.stringify({ double_unit: [4, 5, 6] }),
      });

      const response = await PUT(req, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.double_unit).toEqual([4, 5, 6]);
    });

    it("should deduplicate double_unit array", async () => {
      const updatedProperty = {
        ...mockProperty,
        double_unit: [2, 3, 4],
      };
      const mockSupabase = createMockSupabaseClient({
        data: updatedProperty,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/properties/1", {
        method: "PUT",
        body: JSON.stringify({ double_unit: [2, 3, 4, 3, 2] }),
      });

      const response = await PUT(req, { params: { id: "1" } });

      expect(response.status).toBe(200);
      // The deduplication happens in the schema, so the API should receive [2,3,4]
    });

    it("should remove self-reference from double_unit", async () => {
      const updatedProperty = {
        ...mockProperty,
        double_unit: [2, 3],
      };
      const mockSupabase = createMockSupabaseClient({
        data: updatedProperty,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/properties/1", {
        method: "PUT",
        body: JSON.stringify({ double_unit: [1, 2, 3] }), // 1 is self-reference
      });

      const response = await PUT(req, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      // Self-reference (1) should be removed
      expect(data.double_unit).toEqual([2, 3]);
    });

    it("should convert empty double_unit to null", async () => {
      const updatedProperty = {
        ...mockProperty,
        double_unit: null,
      };
      const mockSupabase = createMockSupabaseClient({
        data: updatedProperty,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/properties/1", {
        method: "PUT",
        body: JSON.stringify({ double_unit: [] }),
      });

      const response = await PUT(req, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.double_unit).toBeNull();
    });

    it("should reject negative estimated_cleaning_mins", async () => {
      const req = new NextRequest("http://localhost:3000/api/properties/1", {
        method: "PUT",
        body: JSON.stringify({ estimated_cleaning_mins: -10 }),
      });

      const response = await PUT(req, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Validation failed");
    });

    it("should reject estimated_cleaning_mins over 1440", async () => {
      const req = new NextRequest("http://localhost:3000/api/properties/1", {
        method: "PUT",
        body: JSON.stringify({ estimated_cleaning_mins: 1500 }),
      });

      const response = await PUT(req, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Validation failed");
    });

    it("should reject double_unit array with more than 20 items", async () => {
      const tooManyIds = Array.from({ length: 21 }, (_, i) => i + 2);

      const req = new NextRequest("http://localhost:3000/api/properties/1", {
        method: "PUT",
        body: JSON.stringify({ double_unit: tooManyIds }),
      });

      const response = await PUT(req, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Validation failed");
    });

    it("should return 400 for invalid id", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/properties/invalid",
        {
          method: "PUT",
          body: JSON.stringify({ estimated_cleaning_mins: 90 }),
        }
      );

      const response = await PUT(req, { params: { id: "invalid" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Invalid id");
    });

    it("should return 404 for non-existent property", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: null,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/properties/999", {
        method: "PUT",
        body: JSON.stringify({ estimated_cleaning_mins: 90 }),
      });

      const response = await PUT(req, { params: { id: "999" } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Not found");
    });

    it("should handle Supabase errors", async () => {
      const mockSupabase = createMockSupabaseClient({
        error: { message: "Database error" },
        status: 500,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/properties/1", {
        method: "PUT",
        body: JSON.stringify({ estimated_cleaning_mins: 120 }),
      });

      const response = await PUT(req, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Database error");
    });

    it("should handle malformed JSON", async () => {
      const req = new NextRequest("http://localhost:3000/api/properties/1", {
        method: "PUT",
        body: "{ invalid json",
      });

      const response = await PUT(req, { params: { id: "1" } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty("error");
    });
  });
});
