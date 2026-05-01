import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/apiGuard", () => ({
  withAuth: (handler: any) => async (req: any, ctx: any) => {
    const params =
      ctx?.params && typeof ctx.params.then === "function"
        ? await ctx.params
        : ctx?.params;
    return handler(req, { role: "owner", params });
  },
  withMinRole: (handler: any) => async (req: any, ctx: any) => {
    const params =
      ctx?.params && typeof ctx.params.then === "function"
        ? await ctx.params
        : ctx?.params;
    return handler(req, { role: "owner", params });
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { GET } from "../route";

function makeMetrics(overrides?: Partial<Record<string, unknown>>) {
  return {
    totals: {
      distinct_properties_cleaned: 12,
      distinct_staff_used: 5,
      days_with_sent_plan: 30,
      distinct_day_appointment_pairs: 240,
      earliest_plan_date: "2025-01-01",
      latest_plan_date: "2026-01-31",
    },
    appointments_per_day: {
      stats: {
        min_per_day: 1,
        p25: 4,
        median: 8,
        p75: 12,
        p95: 18,
        max_per_day: 22,
        mean_per_day: 8.5,
      },
      histogram: [
        { n_appts: 1, days: 2 },
        { n_appts: 8, days: 10 },
        { n_appts: 22, days: 1 },
      ],
    },
    team_size_distribution: [
      { team_size: 1, plans: 12 },
      { team_size: 2, plans: 18 },
    ],
    teams_per_day_distribution: [
      { teams_per_day: 1, days: 20 },
      { teams_per_day: 3, days: 10 },
    ],
    ...overrides,
  };
}

function makeRpcMock(result: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue({
    data: result.data ?? null,
    error: result.error ?? null,
  });
  return { rpc };
}

describe("GET /api/dashboard/metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the parsed metrics with status 200", async () => {
    const metrics = makeMetrics();
    vi.mocked(createClient).mockResolvedValue(
      makeRpcMock({ data: metrics }) as any
    );

    const req = new NextRequest("http://localhost/api/dashboard/metrics");
    const res = await GET(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totals.distinct_properties_cleaned).toBe(12);
    expect(body.appointments_per_day.histogram).toHaveLength(3);
    expect(body.team_size_distribution).toHaveLength(2);
    expect(body.teams_per_day_distribution).toHaveLength(2);
  });

  it("calls the get_dashboard_lifetime_metrics RPC with no arguments", async () => {
    const mock = makeRpcMock({ data: makeMetrics() });
    vi.mocked(createClient).mockResolvedValue(mock as any);

    const req = new NextRequest("http://localhost/api/dashboard/metrics");
    await GET(req, { params: Promise.resolve({}) });

    expect(mock.rpc).toHaveBeenCalledWith("get_dashboard_lifetime_metrics");
  });

  it("includes a 1-hour private Cache-Control header on success", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeRpcMock({ data: makeMetrics() }) as any
    );

    const req = new NextRequest("http://localhost/api/dashboard/metrics");
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
  });

  it("returns 500 with the message when the RPC errors", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeRpcMock({ data: null, error: { message: "DB exploded" } }) as any
    );

    const req = new NextRequest("http://localhost/api/dashboard/metrics");
    const res = await GET(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB exploded");
  });

  it("returns 500 when the RPC returns a malformed shape", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeRpcMock({ data: { totals: { distinct_properties_cleaned: "twelve" } } }) as any
    );

    const req = new NextRequest("http://localhost/api/dashboard/metrics");
    const res = await GET(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatch(/unexpected metrics shape/i);
  });

  it("returns 500 if createClient throws", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("Connection refused"));

    const req = new NextRequest("http://localhost/api/dashboard/metrics");
    const res = await GET(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("Connection refused");
  });
});
