import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/apiGuard";

/**
 * Appointments API endpoint — read-only list
 *
 * GET /api/appointments?statusIds=1,2&dateFrom=...&page=1&pageSize=25
 *
 * Column mapping (rc_appointments):
 *   departure_time = "Service Time" start (guest departs, cleaners begin)
 *   arrival_time   = "Service Time" end
 *   app_status_id  → appointment_status_key.status_id (for label)
 *   property       → rc_properties.properties_id
 *   service        → service_key.service_id
 *   Staff is many-to-many via appointments_staff
 */

function parseNumberArray(
  param: string | string[] | null
): number[] | undefined {
  if (!param) return undefined;
  const arr = Array.isArray(param) ? param : String(param).split(",");
  const nums = arr
    .map((t) => Number(String(t).trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return nums.length ? nums : undefined;
}

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const sort = searchParams.get("sort");
    const pageSize = Math.min(
      Math.max(1, Number(searchParams.get("pageSize") || 25)),
      100
    );
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const offset = (page - 1) * pageSize;

    const statusIds = parseNumberArray(searchParams.get("statusIds"));
    const serviceIds = parseNumberArray(searchParams.get("serviceIds"));
    const staffIds = parseNumberArray(searchParams.get("staffIds"));
    const propertyIds = parseNumberArray(searchParams.get("propertyIds"));
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const taOnly = searchParams.get("taOnly") === "true";
    const nextArrivalBefore = searchParams.get("nextArrivalBefore");
    const nextArrivalAfter = searchParams.get("nextArrivalAfter");

    const supabase = await createClient();

    // Build dynamic select — use !inner when filtering by related entities
    const needsStaffFilter = !!(staffIds && staffIds.length);
    const needsPropertyFilter = !!(q || (propertyIds && propertyIds.length));
    const needsServiceFilter = !!(serviceIds && serviceIds.length);
    const staffJoinType = needsStaffFilter ? "!inner" : "";
    const propertyJoinType = needsPropertyFilter ? "!inner" : "";
    const serviceJoinType = needsServiceFilter ? "!inner" : "";

    const select = `
      id,
      appointment_id,
      departure_time,
      arrival_time,
      next_arrival_time,
      turn_around,
      cancelled_date,
      created_at,
      status:appointment_status_key!app_status_id(status_id,status),
      property_info:rc_properties${propertyJoinType}!property(properties_id,property_name),
      service_info:service_key${serviceJoinType}!service(service_id,name),
      staff:appointments_staff${staffJoinType}(
        staff_id,
        staff_detail:rc_staff(user_id,name,first_name,last_name)
      )
    `;

    let query = supabase
      .from("rc_appointments")
      .select(select, { count: "exact" });

    // ---- Filters ----
    if (statusIds && statusIds.length) {
      query = query.in("app_status_id", statusIds);
    }
    if (serviceIds && serviceIds.length) {
      query = query.in("service", serviceIds);
    }
    if (propertyIds && propertyIds.length) {
      query = query.in("property", propertyIds);
    }
    if (needsStaffFilter) {
      query = query.in("appointments_staff.staff_id", staffIds!);
    }

    // Date range filters on departure_time (service time start)
    // Note: dateFrom/dateTo are YYYY-MM-DD strings
    if (dateFrom) {
      query = query.gte("departure_time", dateFrom);
    }
    if (dateTo) {
      // Append end-of-day time to include entire day (matches legacy behavior)
      query = query.lte("departure_time", `${dateTo} 23:59:59+00`);
    }

    // T/A filter
    if (taOnly) {
      query = query.eq("turn_around", true);
    }

    // Next arrival time filters
    if (nextArrivalBefore) {
      query = query.lte("next_arrival_time", nextArrivalBefore);
    }
    if (nextArrivalAfter) {
      query = query.gte("next_arrival_time", nextArrivalAfter);
    }

    // Text search: search property name via the join
    if (q) {
      query = query.ilike("rc_properties.property_name", `%${q}%`);
    }

    // ---- Sorting ----
    const { parseSortParam } = await import("@/lib/api/sort");
    const rules = parseSortParam(sort, {
      id: "appointment_id",
      serviceTime: "departure_time",
      nextArrivalTime: "next_arrival_time",
      status: "app_status_id",
    });

    const ordered = rules.length
      ? rules.reduce(
          (acc, r) => acc.order(r.column, { ascending: r.ascending }),
          query
        )
      : query
          .order("departure_time", { ascending: true })
          .order("next_arrival_time", { ascending: true })
          .order("property_name", {
            referencedTable: "rc_properties",
            ascending: true,
          })
          .order("appointment_id", { ascending: true });

    // ---- Pagination ----
    const { data, error, status, count } = await ordered.range(
      offset,
      offset + pageSize - 1
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status });
    }

    // Flatten the nested staff join into a clean array
    const items = (data ?? []).map((row: any) => ({
      id: row.id,
      appointment_id: row.appointment_id,
      departure_time: row.departure_time,
      arrival_time: row.arrival_time,
      next_arrival_time: row.next_arrival_time,
      turn_around: row.turn_around,
      cancelled_date: row.cancelled_date,
      created_at: row.created_at,
      status: row.status,
      property_info: row.property_info,
      service_info: row.service_info,
      staff: (row.staff ?? [])
        .map((s: any) => s.staff_detail)
        .filter(Boolean),
    }));

    return NextResponse.json(
      { items, total: count ?? 0 },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
});

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
