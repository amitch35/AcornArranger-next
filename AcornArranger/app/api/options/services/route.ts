import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error, status } = await supabase
      .from("service_key")
      .select("service_id,name")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status });
    }

    const options = (data ?? []).map((row) => ({
      id: row.service_id,
      label: row.name ?? String(row.service_id),
    }));
    return NextResponse.json({ options }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
