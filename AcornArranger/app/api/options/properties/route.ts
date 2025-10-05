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

    // Join rc_addresses only when city filter is present to avoid unnecessary joins
    const cityTrim = city ? city.trim() : undefined;
    let query = cityTrim
      ? base
          .select("properties_id,property_name,rc_addresses!inner(city)", { count: "exact" })
          .ilike("rc_addresses.city", `${cityTrim}%`)
      : base.select("properties_id,property_name", { count: "exact" });

    if (q) query = query.ilike("property_name", `%${q}%`);
    if (statusIds && statusIds.length) query = query.in("status_id", statusIds);

    const { data, error, status, count } = await query
      .order("property_name", { ascending: true })
      .range(offset, offset + Math.max(1, limit) - 1);

    if (error) return NextResponse.json({ error: error.message }, { status });
    const options = (data ?? []).map((row) => ({ id: row.properties_id!, label: row.property_name ?? String(row.properties_id) }));
    return NextResponse.json({ options, total: count ?? options.length }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}


