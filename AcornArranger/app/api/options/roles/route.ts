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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


