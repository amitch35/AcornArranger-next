import { z } from "zod";

/**
 * Lifetime ("program-wide") metrics returned by `get_dashboard_lifetime_metrics`.
 *
 * The RPC returns one JSON object with four sections:
 * - `totals`: headline counts and the earliest/latest plan dates.
 * - `appointments_per_day`: summary stats + a `(n_appts, days)` histogram of
 *   how many appointments each sent-plan day carried.
 * - `team_size_distribution`: `(team_size, plans)` rollup of staff-per-plan.
 * - `teams_per_day_distribution`: `(teams_per_day, days)` rollup of distinct
 *   plans running on the same calendar date.
 *
 * All numeric counts are non-negative integers. Percentile / mean fields can be
 * fractional; everything is clamped to zero when the database has no sent
 * plans yet (see the `coalesce(..., 0)` calls in the RPC).
 */

export const LifetimeTotalsSchema = z.object({
  distinct_properties_cleaned: z.number().int().nonnegative(),
  distinct_staff_used: z.number().int().nonnegative(),
  days_with_sent_plan: z.number().int().nonnegative(),
  distinct_day_appointment_pairs: z.number().int().nonnegative(),
  earliest_plan_date: z.string().nullable(),
  latest_plan_date: z.string().nullable(),
});

export type LifetimeTotals = z.infer<typeof LifetimeTotalsSchema>;

export const AppointmentsPerDayStatsSchema = z.object({
  min_per_day: z.number().nonnegative(),
  p25: z.number().nonnegative(),
  median: z.number().nonnegative(),
  p75: z.number().nonnegative(),
  p95: z.number().nonnegative(),
  max_per_day: z.number().nonnegative(),
  mean_per_day: z.number().nonnegative(),
});

export type AppointmentsPerDayStats = z.infer<typeof AppointmentsPerDayStatsSchema>;

export const AppointmentsPerDayHistogramEntrySchema = z.object({
  n_appts: z.number().int().nonnegative(),
  days: z.number().int().nonnegative(),
});

export const AppointmentsPerDaySchema = z.object({
  stats: AppointmentsPerDayStatsSchema,
  histogram: z.array(AppointmentsPerDayHistogramEntrySchema),
});

export type AppointmentsPerDay = z.infer<typeof AppointmentsPerDaySchema>;

export const TeamSizeBucketSchema = z.object({
  team_size: z.number().int().nonnegative(),
  plans: z.number().int().nonnegative(),
});

export type TeamSizeBucket = z.infer<typeof TeamSizeBucketSchema>;

export const TeamsPerDayBucketSchema = z.object({
  teams_per_day: z.number().int().nonnegative(),
  days: z.number().int().nonnegative(),
});

export type TeamsPerDayBucket = z.infer<typeof TeamsPerDayBucketSchema>;

export const DashboardLifetimeMetricsSchema = z.object({
  totals: LifetimeTotalsSchema,
  appointments_per_day: AppointmentsPerDaySchema,
  team_size_distribution: z.array(TeamSizeBucketSchema),
  teams_per_day_distribution: z.array(TeamsPerDayBucketSchema),
});

export type DashboardLifetimeMetrics = z.infer<typeof DashboardLifetimeMetricsSchema>;
