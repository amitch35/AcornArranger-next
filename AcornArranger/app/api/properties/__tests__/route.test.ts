import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockSupabaseClient,
  generateMockProperties,
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
import { GET } from "../route";

/**
 * Integration tests for /api/properties endpoint
 * 
 * Tests full property list with filtering, sorting, and pagination
 */

describe("/api/properties", () => {
  const mockPropertiesData = generateMockProperties(30);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("should return paginated property list", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: mockPropertiesData.slice(0, 10),
        count: mockPropertiesData.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/properties?page=1&pageSize=10"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("items");
      expect(data).toHaveProperty("total");
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items).toHaveLength(10);
      expect(data.total).toBe(30);
    });

    it("should filter by search query", async () => {
      const filteredProperties = mockPropertiesData.filter((p) =>
        p.property_name.toLowerCase().includes("beach")
      );
      const mockSupabase = createMockSupabaseClient({
        data: filteredProperties,
        count: filteredProperties.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/properties?q=beach"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should filter by city", async () => {
      const filteredProperties = mockPropertiesData.filter(
        (p) => p.address?.city?.startsWith("San")
      );
      const mockSupabase = createMockSupabaseClient({
        data: filteredProperties,
        count: filteredProperties.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/properties?city=San"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should filter by statusIds", async () => {
      const activeProperties = mockPropertiesData.filter(
        (p) => p.status?.status_id === 1
      );
      const mockSupabase = createMockSupabaseClient({
        data: activeProperties,
        count: activeProperties.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/properties?statusIds=1"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should filter by cleaningTimeMin", async () => {
      const filteredProperties = mockPropertiesData.filter(
        (p) =>
          p.estimated_cleaning_mins !== null &&
          p.estimated_cleaning_mins >= 60
      );
      const mockSupabase = createMockSupabaseClient({
        data: filteredProperties,
        count: filteredProperties.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/properties?cleaningTimeMin=60"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
      // Verify all returned properties meet the minimum
      data.items.forEach((item: any) => {
        expect(item.estimated_cleaning_mins).toBeGreaterThanOrEqual(60);
      });
    });

    it("should filter by cleaningTimeMax", async () => {
      const filteredProperties = mockPropertiesData.filter(
        (p) =>
          p.estimated_cleaning_mins !== null &&
          p.estimated_cleaning_mins <= 120
      );
      const mockSupabase = createMockSupabaseClient({
        data: filteredProperties,
        count: filteredProperties.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/properties?cleaningTimeMax=120"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
      // Verify all returned properties meet the maximum
      data.items.forEach((item: any) => {
        expect(item.estimated_cleaning_mins).toBeLessThanOrEqual(120);
      });
    });

    it("should filter by cleaningTimeMin and cleaningTimeMax (range)", async () => {
      const filteredProperties = mockPropertiesData.filter(
        (p) =>
          p.estimated_cleaning_mins !== null &&
          p.estimated_cleaning_mins >= 60 &&
          p.estimated_cleaning_mins <= 120
      );
      const mockSupabase = createMockSupabaseClient({
        data: filteredProperties,
        count: filteredProperties.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/properties?cleaningTimeMin=60&cleaningTimeMax=120"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
      // Verify all returned properties are in the range
      data.items.forEach((item: any) => {
        expect(item.estimated_cleaning_mins).toBeGreaterThanOrEqual(60);
        expect(item.estimated_cleaning_mins).toBeLessThanOrEqual(120);
      });
    });

    it("should exclude null cleaning times when filtering by range", async () => {
      const filteredProperties = mockPropertiesData.filter(
        (p) =>
          p.estimated_cleaning_mins !== null &&
          p.estimated_cleaning_mins >= 60 &&
          p.estimated_cleaning_mins <= 120
      );
      const mockSupabase = createMockSupabaseClient({
        data: filteredProperties,
        count: filteredProperties.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/properties?cleaningTimeMin=60&cleaningTimeMax=120"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Ensure no null values in results
      data.items.forEach((item: any) => {
        expect(item.estimated_cleaning_mins).not.toBeNull();
      });
    });

    it("should apply sorting", async () => {
      const sortedProperties = [...mockPropertiesData].sort((a, b) =>
        a.property_name.localeCompare(b.property_name)
      );
      const mockSupabase = createMockSupabaseClient({
        data: sortedProperties.slice(0, 10),
        count: sortedProperties.length,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/properties?sort=name&page=1&pageSize=10"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should handle Supabase errors", async () => {
      const mockSupabase = createMockSupabaseClient({
        error: { message: "Database error" },
        status: 500,
      });

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/properties");

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Database error");
    });

    it("should handle unexpected errors", async () => {
      vi.mocked(createClient).mockRejectedValue(
        new Error("Connection failed")
      );

      const req = new NextRequest("http://localhost:3000/api/properties");

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty("error");
    });
  });
});
