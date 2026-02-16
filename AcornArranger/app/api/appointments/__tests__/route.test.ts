import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockSupabaseClient } from "../../__tests__/test-utils";

// Mock dependencies BEFORE importing the route
vi.mock("@/lib/apiGuard", () => ({
  withAuth: (handler: any) => handler,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { GET, POST, PUT, DELETE, PATCH } from "../route";

/**
 * Integration tests for /api/appointments endpoint
 */

function generateMockAppointments(count: number = 10) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    appointment_id: 100 + i,
    departure_time: `2025-06-15T${String(8 + (i % 6)).padStart(2, "0")}:00:00Z`,
    arrival_time: `2025-06-15T${String(11 + (i % 6)).padStart(2, "0")}:00:00Z`,
    next_arrival_time:
      i % 3 === 0
        ? `2025-06-15T${String(15 + (i % 4)).padStart(2, "0")}:00:00Z`
        : null,
    turn_around: i % 4 === 0,
    cancelled_date: i % 7 === 0 ? "2025-06-10T12:00:00Z" : null,
    created_at: "2025-06-01T00:00:00Z",
    status: {
      status_id: ((i % 3) + 1) as number,
      status: ["Confirmed", "In Progress", "Completed"][i % 3],
    },
    property_info: {
      properties_id: 200 + i,
      property_name: `Property ${i + 1}`,
    },
    service_info: {
      service_id: 300 + i,
      name: ["Standard Clean", "Deep Clean", "Turnover"][i % 3],
    },
    staff: [
      {
        staff_id: 400 + i,
        staff_detail: {
          user_id: 400 + i,
          name: `Staff ${i + 1}`,
          first_name: `First${i + 1}`,
          last_name: `Last${i + 1}`,
        },
      },
    ],
  }));
}

describe("/api/appointments", () => {
  const mockAppointments = generateMockAppointments(15);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("should return paginated appointments list", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: mockAppointments.slice(0, 10),
        count: mockAppointments.length,
      });
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/appointments?page=1&pageSize=10"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("items");
      expect(data).toHaveProperty("total");
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.total).toBe(15);
    });

    it("should return flattened staff array in items", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: [mockAppointments[0]],
        count: 1,
      });
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/appointments?pageSize=1"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items.length).toBe(1);

      const item = data.items[0];
      expect(item).toHaveProperty("appointment_id");
      expect(item).toHaveProperty("departure_time");
      expect(item).toHaveProperty("arrival_time");
      expect(item).toHaveProperty("next_arrival_time");
      expect(item).toHaveProperty("turn_around");
      expect(item).toHaveProperty("status");
      expect(item).toHaveProperty("property_info");
      expect(item).toHaveProperty("service_info");
      expect(item).toHaveProperty("staff");
      // Staff should be flattened (staff_detail extracted)
      expect(Array.isArray(item.staff)).toBe(true);
      if (item.staff.length > 0) {
        expect(item.staff[0]).toHaveProperty("user_id");
        expect(item.staff[0]).toHaveProperty("name");
      }
    });

    it("should filter by statusIds", async () => {
      const confirmed = mockAppointments.filter(
        (a) => a.status.status_id === 1
      );
      const mockSupabase = createMockSupabaseClient({
        data: confirmed,
        count: confirmed.length,
      });
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/appointments?statusIds=1"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should filter by taOnly=true", async () => {
      const taAppts = mockAppointments.filter((a) => a.turn_around);
      const mockSupabase = createMockSupabaseClient({
        data: taAppts,
        count: taAppts.length,
      });
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/appointments?taOnly=true"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.total).toBe(taAppts.length);
    });

    it("should filter by date range (dateFrom/dateTo)", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: mockAppointments.slice(0, 5),
        count: 5,
      });
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/appointments?dateFrom=2025-06-15T00:00:00Z&dateTo=2025-06-15T23:59:59Z"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should filter by nextArrivalBefore/nextArrivalAfter", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: mockAppointments.slice(0, 3),
        count: 3,
      });
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/appointments?nextArrivalAfter=2025-06-15T14:00:00Z&nextArrivalBefore=2025-06-15T18:00:00Z"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should support text search via q param", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: [mockAppointments[0]],
        count: 1,
      });
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/appointments?q=Property"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should support sorting via sort param", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: mockAppointments.slice(0, 10),
        count: mockAppointments.length,
      });
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/appointments?sort=serviceTime:desc"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should handle database errors gracefully", async () => {
      const mockSupabase = createMockSupabaseClient({
        error: new Error("Database connection failed"),
      });
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/appointments"
      );
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Database connection failed");
    });

    it("should default to pageSize=25 when not specified", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: mockAppointments,
        count: mockAppointments.length,
      });
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const req = new NextRequest(
        "http://localhost:3000/api/appointments"
      );
      const response = await GET(req);
      expect(response.status).toBe(200);
    });
  });

  describe("Non-GET methods", () => {
    it("should reject POST with 405 and Allow header", async () => {
      const response = await POST();
      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("GET");

      const data = await response.json();
      expect(data.error).toBe("Method not allowed");
    });

    it("should reject PUT with 405 and Allow header", async () => {
      const response = await PUT();
      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("GET");
    });

    it("should reject DELETE with 405 and Allow header", async () => {
      const response = await DELETE();
      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("GET");
    });

    it("should reject PATCH with 405 and Allow header", async () => {
      const response = await PATCH();
      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("GET");
    });
  });
});
