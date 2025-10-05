import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error, status } = await supabase
      .from("appointment_status_key")
      .select("status_id,status")
      .order("status_id", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status });
    }

    const options = (data ?? []).map((row) => ({ id: row.status_id, label: row.status ?? String(row.status_id) }));
    return NextResponse.json({ options }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}


