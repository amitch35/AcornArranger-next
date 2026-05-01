import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withMinRole } from "@/lib/apiGuard";
import {
  DashboardLifetimeMetricsSchema,
  type DashboardLifetimeMetrics,
} from "@/src/features/dashboard/schemas";

/**
 * Lifetime metrics change at most ~once per day (when a plan is sent), so we
 * cache for an hour. `private` keeps the response per-user since the route is
 * gated by a session cookie.
 */
const CACHE_HEADER = "private, max-age=3600";

export const GET = withMinRole(
  async () => {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase.rpc(
        "get_dashboard_lifetime_metrics"
      );

      if (error) {
        return NextResponse.json(
          { error: error.message ?? "Failed to load dashboard metrics" },
          { status: 500 }
        );
      }

      const parsed = DashboardLifetimeMetricsSchema.safeParse(data);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "Unexpected metrics shape returned by database",
            details: parsed.error.flatten(),
          },
          { status: 500 }
        );
      }

      return NextResponse.json(parsed.data satisfies DashboardLifetimeMetrics, {
        status: 200,
        headers: { "Cache-Control": CACHE_HEADER },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  { minRole: "authorized_user" }
);
