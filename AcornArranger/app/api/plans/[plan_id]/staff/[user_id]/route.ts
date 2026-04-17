import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withMinRole } from "@/lib/apiGuard";

export const POST = withMinRole(
  async (
    req: NextRequest,
    context: { params?: { plan_id: string; user_id: string } }
  ) => {
    try {
      const params = context.params;
      if (!params?.plan_id || !params?.user_id) {
        return NextResponse.json(
          { error: "plan_id and user_id are required" },
          { status: 400 }
        );
      }

      const planId = Number(params.plan_id);
      const userId = Number(params.user_id);
      if (!Number.isInteger(planId) || !Number.isInteger(userId)) {
        return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
      }

      const supabase = await createClient();

      const { data, error, status } = await supabase.rpc("plan_add_staff", {
        staff_to_add: userId,
        target_plan: planId,
      });

      if (error) {
        return NextResponse.json(
          {
            code: "STAFF_ADD_ERROR",
            message: error.message,
            details: error.details,
            hint: error.hint,
          },
          { status: 400 }
        );
      }

      return new Response(null, { status: 204 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        { code: "STAFF_ADD_ERROR", message },
        { status: 500 }
      );
    }
  },
  { minRole: "authorized_user" }
);

export const DELETE = withMinRole(
  async (
    req: NextRequest,
    context: { params?: { plan_id: string; user_id: string } }
  ) => {
    try {
      const params = context.params;
      if (!params?.plan_id || !params?.user_id) {
        return NextResponse.json(
          { error: "plan_id and user_id are required" },
          { status: 400 }
        );
      }

      const planId = Number(params.plan_id);
      const userId = Number(params.user_id);
      if (!Number.isInteger(planId) || !Number.isInteger(userId)) {
        return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
      }

      const supabase = await createClient();

      const { error } = await supabase.rpc("plan_remove_staff", {
        staff_to_remove: userId,
        target_plan: planId,
      });

      if (error) {
        return NextResponse.json(
          {
            code: "STAFF_REMOVE_ERROR",
            message: error.message,
            details: error.details,
            hint: error.hint,
          },
          { status: 400 }
        );
      }

      return new Response(null, { status: 204 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        { code: "STAFF_REMOVE_ERROR", message },
        { status: 500 }
      );
    }
  },
  { minRole: "authorized_user" }
);
