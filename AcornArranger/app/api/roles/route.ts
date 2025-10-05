import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const limit = Number(searchParams.get("limit") || 50);
    const page = Number(searchParams.get("page") || 1);
    const offset = Math.max(0, (page - 1) * Math.max(1, limit));

    const supabase = await createClient();
    let query = supabase
      .from("roles")
      .select("role_id:id,title,description,priority,can_lead_team,can_clean", { count: "exact" })
      .order("priority", { ascending: true })
      .order("title", { ascending: true })
      .range(offset, offset + Math.max(1, limit) - 1);

    if (q) {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    }

    const { data, error, status, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status });
    return NextResponse.json({ items: data ?? [], total: count ?? (data?.length ?? 0) }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}





