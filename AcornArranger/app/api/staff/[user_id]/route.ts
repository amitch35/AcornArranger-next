import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/apiGuard";
import { deriveCapabilities } from "@/src/features/staff/schemas";

/**
 * Staff Detail API endpoint
 * 
 * Returns a single staff member with joined role and status data
 * Includes computed capabilities array
 * 
 * GET /api/staff/123
 */

export const GET = withAuth(async (
  _req: NextRequest,
  { params }: { params: { user_id: string } }
) => {
  try {
    const userId = Number(params.user_id);
    
    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        { error: "Invalid user_id" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Full staff select with all fields and joins
    const select = `
      user_id,
      name,
      first_name,
      last_name,
      hb_user_id,
      role:roles(role_id:id,title,description,priority,can_clean,can_lead_team),
      status:staff_status_key(status_id,status)
    `;

    const { data, error, status } = await supabase
      .from("rc_staff")
      .select(select)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status });
    }

    if (!data) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    // Compute capabilities from role flags
    const capabilities = deriveCapabilities(
      data.role as any // Type assertion for joined data
    );

    // Return staff with capabilities
    const response = {
      ...data,
      capabilities,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
});

// Reject non-GET methods
export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function PATCH() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
