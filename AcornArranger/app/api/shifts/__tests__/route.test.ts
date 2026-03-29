import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/apiGuard", () => ({
  withMinRole: (handler: any) => handler,
  withAuth: (handler: any) => handler,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { GET } from "../route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeShift(userId: number) {
  return {
    matched: true,
    user_id: userId,
    name: `Staff ${userId}`,
    shift: {
      user_id: 1000 + userId,
      first_name: "Staff",
      last_name: String(userId),
      role: "Housekeeper",
    },
  };
}

function makeRpcMock(result: { data?: any; error?: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue({
    data: result.data ?? null,
    error: result.error ?? null,
  });
  return { rpc };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/shifts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when the date query param is missing", async () => {
    const req = new NextRequest("http://localhost/api/shifts");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/date/i);
  });

  it("returns StaffShift[] with status 200 on success", async () => {
    const shifts = [makeShift(1), makeShift(2)];
    vi.mocked(createClient).mockResolvedValue(makeRpcMock({ data: shifts }) as any);

    const req = new NextRequest("http://localhost/api/shifts?date=2026-03-29");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0].user_id).toBe(1);
  });

  it("passes date_from and date_to both equal to the provided date", async () => {
    const mock = makeRpcMock({ data: [] });
    vi.mocked(createClient).mockResolvedValue(mock as any);

    const req = new NextRequest("http://localhost/api/shifts?date=2026-03-29");
    await GET(req);

    expect(mock.rpc).toHaveBeenCalledWith("get_staff_shifts", {
      date_from: "2026-03-29",
      date_to: "2026-03-29",
    });
  });

  it("returns empty array with 200 when the RPC returns an error (Homebase unreachable)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeRpcMock({ data: null, error: { message: "Homebase API timeout" } }) as any
    );

    const req = new NextRequest("http://localhost/api/shifts?date=2026-03-29");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it("returns empty array with 200 when the RPC returns null data", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeRpcMock({ data: null }) as any
    );

    const req = new NextRequest("http://localhost/api/shifts?date=2026-03-29");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it("returns 500 if createClient throws", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("Connection refused"));

    const req = new NextRequest("http://localhost/api/shifts?date=2026-03-29");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("Connection refused");
  });
});
