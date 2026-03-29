import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withMinRole } from "@/lib/apiGuard";

export const POST = withMinRole(
  async (
    req: NextRequest,
    context: { params?: { plan_id: string; appointment_id: string } }
  ) => {
    try {
      const params = context.params;
      if (!params?.plan_id || !params?.appointment_id) {
        return NextResponse.json(
          { error: "plan_id and appointment_id are required" },
          { status: 400 }
        );
      }

      const planId = Number(params.plan_id);
      const appointmentId = Number(params.appointment_id);
      if (!Number.isInteger(planId) || !Number.isInteger(appointmentId)) {
        return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
      }

      const supabase = await createClient();

      const { error } = await supabase.rpc("plan_add_appointment", {
        appointment_to_add: appointmentId,
        target_plan: planId,
      });

      if (error) {
        return NextResponse.json(
          {
            code: "APPOINTMENT_ADD_ERROR",
            message: error.message,
            details: error.details,
          },
          { status: 400 }
        );
      }

      return new Response(null, { status: 204 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        { code: "APPOINTMENT_ADD_ERROR", message },
        { status: 500 }
      );
    }
  },
  { minRole: "authorized_user" }
);

export const DELETE = withMinRole(
  async (
    req: NextRequest,
    context: { params?: { plan_id: string; appointment_id: string } }
  ) => {
    try {
      const params = context.params;
      if (!params?.plan_id || !params?.appointment_id) {
        return NextResponse.json(
          { error: "plan_id and appointment_id are required" },
          { status: 400 }
        );
      }

      const planId = Number(params.plan_id);
      const appointmentId = Number(params.appointment_id);
      if (!Number.isInteger(planId) || !Number.isInteger(appointmentId)) {
        return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
      }

      const supabase = await createClient();

      const { error } = await supabase.rpc("plan_remove_appointment", {
        appointment_to_remove: appointmentId,
        target_plan: planId,
      });

      if (error) {
        return NextResponse.json(
          {
            code: "APPOINTMENT_REMOVE_ERROR",
            message: error.message,
            details: error.details,
          },
          { status: 400 }
        );
      }

      return new Response(null, { status: 204 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        { code: "APPOINTMENT_REMOVE_ERROR", message },
        { status: 500 }
      );
    }
  },
  { minRole: "authorized_user" }
);
