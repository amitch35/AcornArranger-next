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
    const city = searchParams.get("city");
    const statusIds = parseNumberArray(searchParams.get("filter_status_ids"));

    const supabase = await createClient();
    const base = supabase.from("rc_properties");

    // Detail entity response aligned with legacy spec: include address and status joins
    const select = `
      properties_id,
      property_name,
      estimated_cleaning_mins,
      double_unit,
      address:rc_addresses ( city,address,country,state_name,postal_code ),
      status:property_status_key ( status,status_id )
    `;

    const cityTrim = city ? city.trim() : undefined;
    let query = cityTrim
      ? base.select(select, { count: "exact" }).ilike("rc_addresses.city", `${cityTrim}%`)
      : base.select(select, { count: "exact" });

    if (q) query = query.ilike("property_name", `%${q}%`);
    if (statusIds && statusIds.length) query = query.in("status_id", statusIds);

    const { data, error, status, count } = await query
      .order("property_name", { ascending: true })
      .range(offset, offset + Math.max(1, limit) - 1);

    if (error) return NextResponse.json({ error: error.message }, { status });
    return NextResponse.json({ items: data ?? [], total: count ?? (data?.length ?? 0) }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}





