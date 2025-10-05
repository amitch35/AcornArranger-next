import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
 

function parseNumberArray(param: string | string[] | null): number[] | undefined {
  if (!param) return undefined;
  const arr = Array.isArray(param) ? param : String(param).split(",");
  const nums = arr
    .map((t) => Number(String(t).trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return nums.length ? nums : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const limit = Number(searchParams.get("limit") || 50);
    const page = Number(searchParams.get("page") || 1);
    const offset = Math.max(0, (page - 1) * Math.max(1, limit));
    const statusIds = parseNumberArray(searchParams.get("filter_status_ids"));
    const canClean = searchParams.get("filter_can_clean");
    const excludePlanId = searchParams.get("exclude_plan_id");

    const supabase = await createClient();

    const roleSelect = `roles${canClean === "true" ? "!inner" : ""}(id,title,can_clean)`;
    let query = supabase
      .from("rc_staff")
      .select(
        `user_id,name,${roleSelect}, status:staff_status_key(status_id,status)`,
        { count: "exact" }
      );

    if (q) {
      query = query.ilike("name", `%${q}%`);
    }

    if (statusIds && statusIds.length) {
      query = query.in("status_id", statusIds);
    }

    if (canClean === "true") {
      query = query.eq("roles.can_clean", true);
    }

    if (excludePlanId) {
      const { data: planStaff, error: psError } = await supabase
        .from("plan_staff")
        .select("staff_id")
        .eq("plan_id", Number(excludePlanId))
        .eq("valid", true);

      if (psError) {
        return NextResponse.json({ error: psError.message }, { status: 500 });
      }
      const excludedIds = (planStaff ?? []).map((r) => r.staff_id).filter(Boolean);
      if (excludedIds.length) {
        query = query.not("user_id", "in", `(${excludedIds.join(",")})`);
      }
    }

    const { data, error, status, count } = await query
      .order("status_id", { ascending: true })
      .order("name", { ascending: true })
      .range(offset, offset + Math.max(1, limit) - 1);

    if (error) return NextResponse.json({ error: error.message }, { status });
    const rows = (data ?? []) as unknown as Array<{ user_id: number | string | null; name: string | null }>;
    const options = rows.map((row) => ({ id: row.user_id as number | string, label: row.name ?? String(row.user_id) }));
    return NextResponse.json({ options, total: count ?? 0 }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}


