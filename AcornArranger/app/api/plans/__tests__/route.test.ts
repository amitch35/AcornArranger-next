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

/**
 * Build a Supabase-style thenable query mock.
 * All filter/ordering methods are chainable; awaiting resolves with the given result.
 */
function makePlanQuery(result: {
  data?: any[] | null;
  error?: { message: string } | null;
  status?: number;
  count?: number;
}) {
  const q: any = {};
  for (const m of ["eq", "filter", "gte", "lte", "range", "order", "select"]) {
    q[m] = vi.fn(() => q);
  }
  q.then = (resolve: any, reject?: any) =>
    Promise.resolve({
      data: result.data ?? [],
      error: result.error ?? null,
      status: result.status ?? 200,
      count: result.count ?? 0,
    }).then(resolve, reject);
  return q;
}

function makeMockPlan(overrides?: Partial<{ plan_id: number; team: number }>) {
  return {
    plan_id: overrides?.plan_id ?? 1,
    plan_date: "2025-01-15",
    team: overrides?.team ?? 1,
    appointments: [],
    staff: [],
  };
}

describe("GET /api/plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an array of plans with status 200", async () => {
    const plans = [makeMockPlan({ plan_id: 1 }), makeMockPlan({ plan_id: 2, team: 2 })];
    const q = makePlanQuery({ data: plans, count: 2 });
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => ({ select: vi.fn(() => q) })) } as any);

    const req = new NextRequest("http://localhost/api/plans?from_plan_date=2025-01-15");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
  });

  it("includes a Content-Range header", async () => {
    const plans = [makeMockPlan()];
    const q = makePlanQuery({ data: plans, count: 1 });
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => ({ select: vi.fn(() => q) })) } as any);

    const req = new NextRequest("http://localhost/api/plans?from_plan_date=2025-01-15");
    const res = await GET(req);

    expect(res.headers.get("Content-Range")).toMatch(/^plans /);
  });

  it("defaults per_page to 50 and page to 0", async () => {
    const q = makePlanQuery({ data: [], count: 0 });
    const mockFrom = vi.fn(() => ({ select: vi.fn(() => q) }));
    vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as any);

    const req = new NextRequest("http://localhost/api/plans");
    await GET(req);

    // range(0, 49) should be called for default per_page=50, page=0
    expect(q.range).toHaveBeenCalledWith(0, 49);
  });

  it("respects page and per_page query params", async () => {
    const q = makePlanQuery({ data: [], count: 0 });
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => ({ select: vi.fn(() => q) })) } as any);

    const req = new NextRequest("http://localhost/api/plans?page=2&per_page=10");
    await GET(req);

    expect(q.range).toHaveBeenCalledWith(20, 29);
  });

  it("returns 200 with empty array when no plans found", async () => {
    const q = makePlanQuery({ data: [], count: 0 });
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => ({ select: vi.fn(() => q) })) } as any);

    const req = new NextRequest("http://localhost/api/plans?from_plan_date=2099-01-01");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it("applies from_plan_date filter as both gte and lte when only from_plan_date is provided", async () => {
    const q = makePlanQuery({ data: [], count: 0 });
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => ({ select: vi.fn(() => q) })) } as any);

    const req = new NextRequest("http://localhost/api/plans?from_plan_date=2025-01-15");
    await GET(req);

    expect(q.gte).toHaveBeenCalledWith("plan_date", "2025-01-15");
    expect(q.lte).toHaveBeenCalledWith("plan_date", "2025-01-15");
  });

  it("applies only gte when from_plan_date and to_plan_date are both provided", async () => {
    const q = makePlanQuery({ data: [], count: 0 });
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => ({ select: vi.fn(() => q) })) } as any);

    const req = new NextRequest(
      "http://localhost/api/plans?from_plan_date=2025-01-01&to_plan_date=2025-01-31"
    );
    await GET(req);

    expect(q.gte).toHaveBeenCalledWith("plan_date", "2025-01-01");
    expect(q.lte).toHaveBeenCalledWith("plan_date", "2025-01-31");
  });

  it("returns a JSON error and passes through status on database error", async () => {
    const q = makePlanQuery({
      data: null,
      error: { message: "DB failure" },
      status: 500,
    });
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => ({ select: vi.fn(() => q) })) } as any);

    const req = new NextRequest("http://localhost/api/plans");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB failure");
  });

  it("returns 500 if createClient throws", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("Connection refused"));

    const req = new NextRequest("http://localhost/api/plans");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("Connection refused");
  });
});
