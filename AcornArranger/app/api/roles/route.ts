import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const sort = searchParams.get("sort");
    const pageSize = Number(searchParams.get("pageSize") || 50);
    const page = Number(searchParams.get("page") || 1);
    const offset = Math.max(0, (page - 1) * Math.max(1, pageSize));

    const supabase = await createClient();
    let query = supabase
      .from("roles")
      .select("role_id:id,title,description,priority,can_lead_team,can_clean", { count: "exact" })
      ;

    if (q) {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    }

    // Dynamic sort (fallback to priority asc, title asc)
    const { parseSortParam } = await import("@/lib/api/sort");
    const rules = parseSortParam(sort, {
      id: "id",
      title: "title",
      description: "description",
      priority: "priority",
      canLeadTeam: "can_lead_team",
      canClean: "can_clean",
    });
    const ordered = rules.length
      ? rules.reduce((q, r) => q.order(r.column, { ascending: r.ascending }), query)
      : query.order("priority", { ascending: true }).order("title", { ascending: true });

    const { data, error, status, count } = await ordered.range(offset, offset + Math.max(1, pageSize) - 1);
    if (error) return NextResponse.json({ error: error.message }, { status });
    return NextResponse.json({ items: data ?? [], total: count ?? (data?.length ?? 0) }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}





