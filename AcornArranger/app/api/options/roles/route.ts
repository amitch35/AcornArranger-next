import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error, status } = await supabase
      .from("roles")
      .select("id,title")
      .order("title", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status });
    }

    const options = (data ?? []).map((row) => ({ id: row.id, label: row.title ?? String(row.id) }));
    return NextResponse.json({ options }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}


