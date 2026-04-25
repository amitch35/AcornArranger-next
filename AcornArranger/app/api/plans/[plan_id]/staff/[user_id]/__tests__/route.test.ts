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
import { POST, DELETE } from "../route";

function makeRpcClient(error: { message: string; details?: string } | null = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: null, error, status: error ? 400 : 204 }),
  };
}

const validContext = { params: Promise.resolve({ plan_id: "10", user_id: "42" }) };

describe("POST /api/plans/[plan_id]/staff/[user_id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 204 on success", async () => {
    vi.mocked(createClient).mockResolvedValue(makeRpcClient() as any);

    const req = new NextRequest("http://localhost/api/plans/10/staff/42", { method: "POST" });
    const res = await POST(req, validContext);

    expect(res.status).toBe(204);
  });

  it("calls plan_add_staff with correct plan and user IDs", async () => {
    const client = makeRpcClient();
    vi.mocked(createClient).mockResolvedValue(client as any);

    const req = new NextRequest("http://localhost/api/plans/10/staff/42", { method: "POST" });
    await POST(req, validContext);

    expect(client.rpc).toHaveBeenCalledWith("plan_add_staff", {
      staff_to_add: 42,
      target_plan: 10,
    });
  });

  it("returns 400 with error details when RPC fails", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeRpcClient({ message: "Staff already on plan" }) as any
    );

    const req = new NextRequest("http://localhost/api/plans/10/staff/42", { method: "POST" });
    const res = await POST(req, validContext);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("STAFF_ADD_ERROR");
    expect(body.message).toBe("Staff already on plan");
  });

  it("returns 400 when plan_id is missing", async () => {
    const req = new NextRequest("http://localhost/api/plans//staff/42", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ plan_id: "", user_id: "42" }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns 400 when user_id is missing", async () => {
    const req = new NextRequest("http://localhost/api/plans/10/staff/", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ plan_id: "10", user_id: "" }) });

    expect(res.status).toBe(400);
  });

  it("returns 400 for non-integer plan_id", async () => {
    const req = new NextRequest("http://localhost/api/plans/abc/staff/42", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ plan_id: "abc", user_id: "42" }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
  });

  it("returns 500 when createClient throws", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("DB unavailable"));

    const req = new NextRequest("http://localhost/api/plans/10/staff/42", { method: "POST" });
    const res = await POST(req, validContext);

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/plans/[plan_id]/staff/[user_id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 204 on success", async () => {
    vi.mocked(createClient).mockResolvedValue(makeRpcClient() as any);

    const req = new NextRequest("http://localhost/api/plans/10/staff/42", { method: "DELETE" });
    const res = await DELETE(req, validContext);

    expect(res.status).toBe(204);
  });

  it("calls plan_remove_staff with correct IDs", async () => {
    const client = makeRpcClient();
    vi.mocked(createClient).mockResolvedValue(client as any);

    const req = new NextRequest("http://localhost/api/plans/10/staff/42", { method: "DELETE" });
    await DELETE(req, validContext);

    expect(client.rpc).toHaveBeenCalledWith("plan_remove_staff", {
      staff_to_remove: 42,
      target_plan: 10,
    });
  });

  it("returns 400 with error details when RPC fails", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeRpcClient({ message: "Staff not found on plan" }) as any
    );

    const req = new NextRequest("http://localhost/api/plans/10/staff/42", { method: "DELETE" });
    const res = await DELETE(req, validContext);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("STAFF_REMOVE_ERROR");
  });

  it("returns 400 when plan_id is missing", async () => {
    const req = new NextRequest("http://localhost/api/plans//staff/42", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ plan_id: "", user_id: "42" }) });

    expect(res.status).toBe(400);
  });

  it("returns 400 for non-integer user_id", async () => {
    const req = new NextRequest("http://localhost/api/plans/10/staff/xyz", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ plan_id: "10", user_id: "xyz" }) });

    expect(res.status).toBe(400);
  });
});
