import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/apiGuard", () => ({
  // The real wrappers receive `{ params: Promise<...> }` from Next.js 15 and
  // hand the inner handler a resolved sync `params`. The test mock mirrors
  // that contract so callers can pass either Promise<params> or a sync object.
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
import { POST } from "../route";

function makeRpcClient(opts: {
  data?: any;
  error?: { message: string; details?: string } | null;
} = {}) {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: opts.data ?? null,
      error: opts.error ?? null,
      status: opts.error ? 400 : 200,
    }),
  };
}

describe("POST /api/plans/copy/[plan_date]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with RPC data on success", async () => {
    const copyData = [{ plan_id: 5, team: 1 }];
    vi.mocked(createClient).mockResolvedValue(makeRpcClient({ data: copyData }) as any);

    const req = new NextRequest("http://localhost/api/plans/copy/2025-01-15", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ plan_date: "2025-01-15" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(copyData);
  });

  it("calls copy_schedule_plan with the correct schedule_date", async () => {
    const client = makeRpcClient({ data: {} });
    vi.mocked(createClient).mockResolvedValue(client as any);

    const req = new NextRequest("http://localhost/api/plans/copy/2025-01-15", { method: "POST" });
    await POST(req, { params: Promise.resolve({ plan_date: "2025-01-15" }) });

    expect(client.rpc).toHaveBeenCalledWith("copy_schedule_plan", {
      schedule_date: "2025-01-15",
    });
  });

  it("returns empty object when RPC returns null data", async () => {
    vi.mocked(createClient).mockResolvedValue(makeRpcClient({ data: null }) as any);

    const req = new NextRequest("http://localhost/api/plans/copy/2025-01-15", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ plan_date: "2025-01-15" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({});
  });

  it("returns 400 with COPY_ERROR when RPC fails", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeRpcClient({ error: { message: "No plans to copy", details: "no rows" } }) as any
    );

    const req = new NextRequest("http://localhost/api/plans/copy/2025-01-15", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ plan_date: "2025-01-15" }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("COPY_ERROR");
    expect(body.message).toBe("No plans to copy");
  });

  it("returns 400 when plan_date param is missing", async () => {
    const req = new NextRequest("http://localhost/api/plans/copy/", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ plan_date: "" }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/plan_date is required/i);
  });

  it("returns 500 when createClient throws", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("DB unavailable"));

    const req = new NextRequest("http://localhost/api/plans/copy/2025-01-15", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ plan_date: "2025-01-15" }) });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("COPY_ERROR");
  });
});
