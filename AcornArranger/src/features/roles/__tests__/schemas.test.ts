import { describe, expect, it } from "vitest";
import { RoleUpdatePayloadSchema } from "../schemas";

describe("RoleUpdatePayloadSchema", () => {
  it("accepts priority only", () => {
    const r = RoleUpdatePayloadSchema.safeParse({ priority: 100 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ priority: 100 });
  });

  it("accepts can_lead_team only", () => {
    const r = RoleUpdatePayloadSchema.safeParse({ can_lead_team: true });
    expect(r.success).toBe(true);
  });

  it("accepts can_clean only", () => {
    const r = RoleUpdatePayloadSchema.safeParse({ can_clean: false });
    expect(r.success).toBe(true);
  });

  it("accepts multiple fields", () => {
    const r = RoleUpdatePayloadSchema.safeParse({
      priority: 500,
      can_lead_team: true,
      can_clean: true,
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty object", () => {
    const r = RoleUpdatePayloadSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejects unknown keys", () => {
    const r = RoleUpdatePayloadSchema.safeParse({
      priority: 1,
      title: "hijack",
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-integer priority", () => {
    const r = RoleUpdatePayloadSchema.safeParse({ priority: 1.5 });
    expect(r.success).toBe(false);
  });
});
