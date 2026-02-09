import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/apiGuard";
import {
  PropertyUpdatePayloadSchema,
  removeSelfReference,
} from "@/src/features/properties/schemas";

const PROPERTY_SELECT = `
  properties_id,
  property_name,
  estimated_cleaning_mins,
  double_unit,
  address:rc_addresses ( city,address,country,state_name,postal_code ),
  status:property_status_key ( status,status_id )
`;

export const GET = withAuth(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const id = Number(params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }

      const supabase = await createClient();
      const { data, error, status } = await supabase
        .from("rc_properties")
        .select(PROPERTY_SELECT)
        .eq("properties_id", id)
        .maybeSingle();

      if (error)
        return NextResponse.json({ error: error.message }, { status });
      if (!data)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(data, { status: 200 });
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message ?? "Unknown error" },
        { status: 500 }
      );
    }
  }
);

export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const id = Number(params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }

      // Parse and validate request body
      const body = await req.json();
      const parseResult = PropertyUpdatePayloadSchema.safeParse(body);

      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Validation failed", issues: parseResult.error.issues },
          { status: 400 }
        );
      }

      const payload = parseResult.data;

      // Remove self-reference from double_unit if present
      if (payload.double_unit && payload.double_unit.length > 0) {
        payload.double_unit = removeSelfReference(payload.double_unit, id);
      }

      // Convert empty double_unit array to null for DB storage
      if (payload.double_unit && payload.double_unit.length === 0) {
        payload.double_unit = undefined; // Omit from update, or explicitly set to null
      }

      const supabase = await createClient();

      // Build update object
      const updateData: {
        estimated_cleaning_mins?: number | null;
        double_unit?: number[] | null;
      } = {};

      if ("estimated_cleaning_mins" in payload) {
        updateData.estimated_cleaning_mins = payload.estimated_cleaning_mins;
      }

      if ("double_unit" in payload) {
        updateData.double_unit =
          payload.double_unit && payload.double_unit.length > 0
            ? payload.double_unit
            : null;
      }

      // Update the property
      const { data, error, status } = await supabase
        .from("rc_properties")
        .update(updateData)
        .eq("properties_id", id)
        .select(PROPERTY_SELECT)
        .maybeSingle();

      if (error)
        return NextResponse.json({ error: error.message }, { status });
      if (!data)
        return NextResponse.json({ error: "Not found" }, { status: 404 });

      return NextResponse.json(data, { status: 200 });
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message ?? "Unknown error" },
        { status: 500 }
      );
    }
  }
);





