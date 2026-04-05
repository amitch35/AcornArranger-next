import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/apiGuard";
import { RoleUpdatePayloadSchema } from "@/src/features/roles/schemas";

const ROLE_SELECT = "id,title,description,priority,can_lead_team,can_clean";

export const GET = withAuth<{ params: Promise<{ id: string }> }, NextRequest>(
  async (_req: NextRequest, { params }) => {
    try {
      const resolved = await params;
      const id = Number(resolved.id);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }

      const supabase = await createClient();
      const { data, error, status } = await supabase
        .from("roles")
        .select(ROLE_SELECT)
        .eq("id", id)
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status });
      if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(data, { status: 200 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
);

export const PUT = withAuth<{ params: Promise<{ id: string }> }, NextRequest>(
  async (req: NextRequest, { params }) => {
    try {
      const resolved = await params;
      const id = Number(resolved.id);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }

      const body = await req.json();
      const parsed = RoleUpdatePayloadSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", issues: parsed.error.issues },
          { status: 400 }
        );
      }

      const payload = parsed.data;
      const updateData: Record<string, unknown> = {};
      if ("priority" in payload) updateData.priority = payload.priority;
      if ("can_lead_team" in payload) updateData.can_lead_team = payload.can_lead_team;
      if ("can_clean" in payload) updateData.can_clean = payload.can_clean;

      const supabase = await createClient();
      const { data, error, status } = await supabase
        .from("roles")
        .update(updateData)
        .eq("id", id)
        .select(ROLE_SELECT)
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status });
      if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

      return NextResponse.json(data, { status: 200 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
);
