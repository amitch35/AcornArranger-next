import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const supabase = await createClient();
    const select = `
      properties_id,
      property_name,
      estimated_cleaning_mins,
      double_unit,
      address:rc_addresses ( city,address,country,state_name,postal_code ),
      status:property_status_key ( status,status_id )
    `;

    const { data, error, status } = await supabase
      .from("rc_properties")
      .select(select)
      .eq("properties_id", id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}





