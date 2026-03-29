import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withMinRole } from "@/lib/apiGuard";
import type { StaffShift } from "@/src/features/plans/schemas";

export const GET = withMinRole(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { error: "Missing required query param: date" },
        { status: 400 }
      );
    }

    try {
      const supabase = await createClient();

      const { data, error } = await supabase.rpc("get_staff_shifts", {
        date_from: date,
        date_to: date,
      });

      if (error) {
        console.error("get_staff_shifts RPC error:", error.message);
        return NextResponse.json([] as StaffShift[], { status: 200 });
      }

      return NextResponse.json((data ?? []) as StaffShift[], { status: 200 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  { minRole: "authorized_user" }
);
