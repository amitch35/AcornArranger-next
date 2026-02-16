import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/apiGuard";

/**
 * Appointment Detail API endpoint — read-only
 *
 * GET /api/appointments/:id
 *
 * Returns a single appointment with joined relations:
 * - status from appointment_status_key (via app_status_id)
 * - property_info from rc_properties (via property FK)
 * - service_info from service_key (via service FK)
 * - staff[] from appointments_staff → rc_staff (many-to-many)
 */

const APPOINTMENT_SELECT = `
  id,
  appointment_id,
  departure_time,
  arrival_time,
  next_arrival_time,
  turn_around,
  cancelled_date,
  created_at,
  status:appointment_status_key!app_status_id(status_id,status),
  property_info:rc_properties!property(properties_id,property_name),
  service_info:service_key!service(service_id,name),
  staff:appointments_staff(
    staff_id,
    staff_detail:rc_staff(user_id,name,first_name,last_name)
  )
`;

export const GET = withAuth<{ params: { id: string } }, NextRequest>(
  async (_req: NextRequest, { params }) => {
    try {
      const id = Number(params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }

      const supabase = await createClient();

      const { data, error, status } = await supabase
        .from("rc_appointments")
        .select(APPOINTMENT_SELECT)
        .eq("appointment_id", id)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status });
      }
      if (!data) {
        return NextResponse.json(
          { error: "Appointment not found" },
          { status: 404 }
        );
      }

      // Flatten the nested staff join
      const result = {
        id: data.id,
        appointment_id: data.appointment_id,
        departure_time: data.departure_time,
        arrival_time: data.arrival_time,
        next_arrival_time: data.next_arrival_time,
        turn_around: data.turn_around,
        cancelled_date: data.cancelled_date,
        created_at: data.created_at,
        status: data.status,
        property_info: data.property_info,
        service_info: data.service_info,
        staff: ((data as any).staff ?? [])
          .map((s: any) => s.staff_detail)
          .filter(Boolean),
      };

      return NextResponse.json(result, { status: 200 });
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message ?? "Unknown error" },
        { status: 500 }
      );
    }
  }
);

// Reject non-GET methods with 405
const methodNotAllowed = () =>
  new NextResponse(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { Allow: "GET", "Content-Type": "application/json" },
  });

export async function POST() {
  return methodNotAllowed();
}
export async function PUT() {
  return methodNotAllowed();
}
export async function DELETE() {
  return methodNotAllowed();
}
export async function PATCH() {
  return methodNotAllowed();
}
