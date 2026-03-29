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
import { POST, DELETE } from "../route";

function makeRpcClient(error: { message: string; details?: string } | null = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: null, error, status: error ? 400 : 204 }),
  };
}

const validContext = { params: { plan_id: "10", appointment_id: "101" } };

describe("POST /api/plans/[plan_id]/appointment/[appointment_id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 204 on success", async () => {
    vi.mocked(createClient).mockResolvedValue(makeRpcClient() as any);

    const req = new NextRequest("http://localhost/api/plans/10/appointment/101", { method: "POST" });
    const res = await POST(req, validContext);

    expect(res.status).toBe(204);
  });

  it("calls plan_add_appointment with correct plan and appointment IDs", async () => {
    const client = makeRpcClient();
    vi.mocked(createClient).mockResolvedValue(client as any);

    const req = new NextRequest("http://localhost/api/plans/10/appointment/101", { method: "POST" });
    await POST(req, validContext);

    expect(client.rpc).toHaveBeenCalledWith("plan_add_appointment", {
      appointment_to_add: 101,
      target_plan: 10,
    });
  });

  it("returns 400 with error details when RPC fails", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeRpcClient({ message: "Appointment already on plan", details: "unique constraint" }) as any
    );

    const req = new NextRequest("http://localhost/api/plans/10/appointment/101", { method: "POST" });
    const res = await POST(req, validContext);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("APPOINTMENT_ADD_ERROR");
    expect(body.message).toBe("Appointment already on plan");
  });

  it("returns 400 when plan_id is missing", async () => {
    const req = new NextRequest("http://localhost/api/plans//appointment/101", { method: "POST" });
    const res = await POST(req, { params: { plan_id: "", appointment_id: "101" } });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns 400 when appointment_id is missing", async () => {
    const req = new NextRequest("http://localhost/api/plans/10/appointment/", { method: "POST" });
    const res = await POST(req, { params: { plan_id: "10", appointment_id: "" } });

    expect(res.status).toBe(400);
  });

  it("returns 400 for non-integer plan_id", async () => {
    const req = new NextRequest("http://localhost/api/plans/abc/appointment/101", { method: "POST" });
    const res = await POST(req, { params: { plan_id: "abc", appointment_id: "101" } });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
  });

  it("returns 500 when createClient throws", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("DB unavailable"));

    const req = new NextRequest("http://localhost/api/plans/10/appointment/101", { method: "POST" });
    const res = await POST(req, validContext);

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/plans/[plan_id]/appointment/[appointment_id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 204 on success", async () => {
    vi.mocked(createClient).mockResolvedValue(makeRpcClient() as any);

    const req = new NextRequest("http://localhost/api/plans/10/appointment/101", { method: "DELETE" });
    const res = await DELETE(req, validContext);

    expect(res.status).toBe(204);
  });

  it("calls plan_remove_appointment with correct IDs", async () => {
    const client = makeRpcClient();
    vi.mocked(createClient).mockResolvedValue(client as any);

    const req = new NextRequest("http://localhost/api/plans/10/appointment/101", { method: "DELETE" });
    await DELETE(req, validContext);

    expect(client.rpc).toHaveBeenCalledWith("plan_remove_appointment", {
      appointment_to_remove: 101,
      target_plan: 10,
    });
  });

  it("returns 400 with error details when RPC fails", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeRpcClient({ message: "Appointment not on plan" }) as any
    );

    const req = new NextRequest("http://localhost/api/plans/10/appointment/101", { method: "DELETE" });
    const res = await DELETE(req, validContext);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("APPOINTMENT_REMOVE_ERROR");
  });

  it("returns 400 when plan_id is missing", async () => {
    const req = new NextRequest("http://localhost/api/plans//appointment/101", { method: "DELETE" });
    const res = await DELETE(req, { params: { plan_id: "", appointment_id: "101" } });

    expect(res.status).toBe(400);
  });

  it("returns 400 for non-integer appointment_id", async () => {
    const req = new NextRequest("http://localhost/api/plans/10/appointment/xyz", { method: "DELETE" });
    const res = await DELETE(req, { params: { plan_id: "10", appointment_id: "xyz" } });

    expect(res.status).toBe(400);
  });
});
