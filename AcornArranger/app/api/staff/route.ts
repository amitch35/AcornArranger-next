import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/apiGuard";

/**
 * Staff API endpoint - Full staff list with filtering
 * 
 * Returns complete staff objects with joined role and status data
 * Supports filtering by statusIds, roleIds, canClean, canLeadTeam
 * 
 * GET /api/staff?q=John&statusIds=1&canClean=true&page=1&pageSize=25
 */

function parseNumberArray(param: string | string[] | null): number[] | undefined {
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
    const pageSize = Number(searchParams.get("pageSize") || 25);
    const page = Number(searchParams.get("page") || 1);
    const offset = Math.max(0, (page - 1) * Math.max(1, pageSize));
    const statusIds = parseNumberArray(searchParams.get("statusIds"));
    const roleIds = parseNumberArray(searchParams.get("roleIds"));
    const canClean = searchParams.get("canClean");
    const canLeadTeam = searchParams.get("canLeadTeam");

    const supabase = await createClient();

    // Use inner join if filtering by role capabilities
    const needsRoleFilter = canClean === "true" || canLeadTeam === "true" || (roleIds && roleIds.length > 0);
    // NOTE: rc_staff uses `role` as the FK column (per generated types + legacy code),
    // but roles primary key is exposed as `role_id`. We alias it to `id` in the embedded
    // object for API consistency with our Zod schemas.
    const roleSelect = `roles${needsRoleFilter ? "!inner" : ""}(role_id:id,title,description,priority,can_clean,can_lead_team)`;
    
    // Full staff select with all fields and joins
    const select = `
      user_id,
      name,
      first_name,
      last_name,
      hb_user_id,
      ${roleSelect},
      status:staff_status_key(status_id,status)
    `;

    let query = supabase
      .from("rc_staff")
      .select(select, { count: "exact" });

    // Apply filters
    if (q) {
      query = query.ilike("name", `%${q}%`);
    }

    if (statusIds && statusIds.length) {
      query = query.in("status_id", statusIds);
    }

    if (roleIds && roleIds.length) {
      // Filter by the FK column on rc_staff itself (this is *not* roles.role_id).
      // If the schema ever changes to `role_id`, PostgREST will return an error (not silently ignore).
      query = query.in("role", roleIds);
    }

    if (canClean === "true") {
      query = query.eq("roles.can_clean", true);
    }

    if (canLeadTeam === "true") {
      query = query.eq("roles.can_lead_team", true);
    }

    // Apply sorting
    const { parseSortParam } = await import("@/lib/api/sort");
    const rules = parseSortParam(sort, {
      id: "user_id",
      name: "name",
      firstName: "first_name",
      lastName: "last_name",
      status: "status_id",
      role: "role",
    });
    
    const ordered = rules.length
      ? rules.reduce((q, r) => q.order(r.column, { ascending: r.ascending }), query)
      : query.order("status_id", { ascending: true }).order("name", { ascending: true });

    const { data, error, status, count } = await ordered.range(
      offset,
      offset + Math.max(1, pageSize) - 1
    );

    if (error) return NextResponse.json({ error: error.message }, { status });
    
    return NextResponse.json(
      { 
        items: data ?? [], 
        total: count ?? 0 
      },
      { status: 200 }
    );
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
