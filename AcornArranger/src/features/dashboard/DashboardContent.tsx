"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Home,
  Inbox,
  ListChecks,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { WeeklyChart, type WeeklyChartPoint } from "./WeeklyChart";
import { LifetimeMetricsCharts } from "./LifetimeMetricsCharts";
import {
  DashboardLifetimeMetricsSchema,
  type DashboardLifetimeMetrics,
} from "./schemas";
import {
  eachDayInWeek,
  formatLocalDate,
  getWeekRangeContaining,
  today,
  weekdayIndexMonSun,
} from "@/lib/date/week";
import type { AppointmentRow } from "@/src/features/appointments/schemas";
import type { StaffShift } from "@/src/features/plans/schemas";
import { resolveDefaultServiceIds } from "@/src/features/appointments/serviceDefaults";
import { ServiceMultiSelect } from "@/components/filters/ServiceMultiSelect";

const DASHBOARD_STALE_TIME = 30 * 60 * 1000; // 30 minutes
const LIFETIME_STALE_TIME = 24 * 60 * 60 * 1000; // 24 hours
/** Statuses we treat as "live" workload on the dashboard — excludes Cancelled (5). */
const ACTIVE_STATUSES = "1,2,3,4";
/** Unscheduled backlog only: Unconfirmed (1) and Confirmed (2). */
const UNSCHEDULED_STATUSES = "1,2";

type AppointmentsResponse = { items: AppointmentRow[]; total: number };
type CountResponse = { total: number };

async function fetchAppointments(
  params: Record<string, string>
): Promise<AppointmentsResponse> {
  const search = new URLSearchParams(params);
  const res = await fetch(`/api/appointments?${search}`);
  if (!res.ok) throw new Error("Failed to load appointments");
  return res.json();
}

async function fetchAppointmentsCount(
  params: Record<string, string>
): Promise<number> {
  const search = new URLSearchParams({ ...params, pageSize: "1" });
  const res = await fetch(`/api/appointments?${search}`);
  if (!res.ok) throw new Error("Failed to load appointments count");
  const body = (await res.json()) as { total?: number };
  return body.total ?? 0;
}

async function fetchCount(path: string): Promise<CountResponse> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  const body = (await res.json()) as { total?: number };
  return { total: body.total ?? 0 };
}

async function fetchShifts(dateFrom: string, dateTo: string): Promise<StaffShift[]> {
  const params = new URLSearchParams({ dateFrom, dateTo });
  const res = await fetch(`/api/shifts?${params}`);
  if (!res.ok) return [];
  return res.json();
}

async function fetchLifetimeMetrics(): Promise<DashboardLifetimeMetrics> {
  const res = await fetch("/api/dashboard/metrics");
  if (!res.ok) throw new Error("Failed to load lifetime metrics");
  const body = await res.json();
  return DashboardLifetimeMetricsSchema.parse(body);
}

/** Extract the local `YYYY-MM-DD` date for a Homebase shift. */
function shiftLocalDate(shift: StaffShift): string | null {
  const startAt = shift.shift?.start_at;
  if (!startAt) return null;
  try {
    const d = new Date(startAt);
    if (Number.isNaN(d.getTime())) return null;
    return formatLocalDate(d);
  } catch {
    return null;
  }
}

export function DashboardContent() {
  // shows the correct date without a manual refresh.
  const [anchor, setAnchor] = React.useState(() => today());
  React.useEffect(() => {
    function scheduleNextMidnight() {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      );
      const msUntilMidnight = nextMidnight.getTime() - now.getTime();
      return setTimeout(() => {
        setAnchor(today());
        // Reschedule for the midnight after that.
        timerRef.current = scheduleNextMidnight();
      }, msUntilMidnight);
    }
    const timerRef = { current: scheduleNextMidnight() };
    return () => clearTimeout(timerRef.current);
  }, []);
  const todayIso = React.useMemo(() => formatLocalDate(anchor), [anchor]);
  const yesterdayIso = React.useMemo(() => {
    const d = new Date(anchor);
    d.setDate(d.getDate() - 1);
    return formatLocalDate(d);
  }, [anchor]);
  const week = React.useMemo(() => getWeekRangeContaining(anchor), [anchor]);

  // ---- Service filter (controls all appointment queries on this dashboard) ----
  const [serviceFilter, setServiceFilter] = React.useState<string[]>([]);
  const serviceFilterInitialized = React.useRef(false);

  const { data: serviceOptions = [] } = useQuery({
    queryKey: ["service-options"],
    queryFn: async () => {
      const res = await fetch("/api/options/services");
      if (!res.ok) throw new Error("Failed to load services");
      const body = await res.json();
      return (body.options as { id: number; label: string }[]).map((opt) => ({
        value: String(opt.id),
        label: opt.label,
      }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Pre-select the standard workload services
  React.useEffect(() => {
    if (serviceFilterInitialized.current || serviceOptions.length === 0) return;
    serviceFilterInitialized.current = true;
    const ids = resolveDefaultServiceIds(serviceOptions);
    if (ids.length > 0) setServiceFilter(ids);
  }, [serviceOptions]);

  // Stable param string for query keys — avoids array reference churn.
  const serviceIdsParam = serviceFilter.join(",");

  // ---- Week appointments (drives the chart only) ----
  const weekAppointmentsQuery = useQuery({
    queryKey: ["dashboard-week-appts", week.start, week.end, serviceIdsParam],
    queryFn: () => {
      const params: Record<string, string> = {
        dateFrom: week.start,
        dateTo: week.end,
        statusIds: ACTIVE_STATUSES,
        pageSize: "500",
      };
      if (serviceIdsParam) params.serviceIds = serviceIdsParam;
      return fetchAppointments(params);
    },
    staleTime: DASHBOARD_STALE_TIME,
  });

  const todayCountQuery = useQuery({
    queryKey: ["dashboard-day-count", todayIso, serviceIdsParam],
    queryFn: () => {
      const params: Record<string, string> = {
        dateFrom: todayIso,
        dateTo: todayIso,
        statusIds: ACTIVE_STATUSES,
      };
      if (serviceIdsParam) params.serviceIds = serviceIdsParam;
      return fetchAppointmentsCount(params);
    },
    staleTime: DASHBOARD_STALE_TIME,
  });

  const yesterdayCountQuery = useQuery({
    queryKey: ["dashboard-day-count", yesterdayIso, serviceIdsParam],
    queryFn: () => {
      const params: Record<string, string> = {
        dateFrom: yesterdayIso,
        dateTo: yesterdayIso,
        statusIds: ACTIVE_STATUSES,
      };
      if (serviceIdsParam) params.serviceIds = serviceIdsParam;
      return fetchAppointmentsCount(params);
    },
    staleTime: DASHBOARD_STALE_TIME,
  });

  // ---- Unscheduled (excludePlanned) appointments for the whole week ----
  const unscheduledQuery = useQuery({
    queryKey: ["dashboard-unscheduled", week.start, week.end, serviceIdsParam],
    queryFn: () => {
      const params: Record<string, string> = {
        dateFrom: week.start,
        dateTo: week.end,
        statusIds: UNSCHEDULED_STATUSES,
        excludePlanned: "true",
        pageSize: "500",
      };
      if (serviceIdsParam) params.serviceIds = serviceIdsParam;
      return fetchAppointments(params);
    },
    staleTime: DASHBOARD_STALE_TIME,
  });

  // ---- Homebase shifts across the week ----
  const shiftsQuery = useQuery({
    queryKey: ["dashboard-week-shifts", week.start, week.end],
    queryFn: () => fetchShifts(week.start, week.end),
    staleTime: DASHBOARD_STALE_TIME,
  });

  // ---- Active properties (headline count only) ----
  const activePropertiesQuery = useQuery({
    queryKey: ["dashboard-active-properties"],
    queryFn: () => fetchCount("/api/properties?statusIds=1&pageSize=1"),
    staleTime: DASHBOARD_STALE_TIME,
  });

  // ---- Lifetime / program-wide totals ----
  // Lifetime numbers move at most ~once per day, so we let the query stay
  // fresh for 24h and skip the focus-refetch.
  const lifetimeMetricsQuery = useQuery({
    queryKey: ["dashboard-lifetime-metrics"],
    queryFn: fetchLifetimeMetrics,
    staleTime: LIFETIME_STALE_TIME,
    refetchOnWindowFocus: false,
  });

  // Memoize the empty-array fallbacks so the `?? []` doesn't allocate a fresh
  // reference on every render — without this, every downstream useMemo that
  // depends on these arrays invalidates each render, defeating memoization.
  const weekAppointments = React.useMemo(
    () => weekAppointmentsQuery.data?.items ?? [],
    [weekAppointmentsQuery.data]
  );
  const unscheduledAppointments = React.useMemo(
    () => unscheduledQuery.data?.items ?? [],
    [unscheduledQuery.data]
  );
  const shifts = React.useMemo(
    () => shiftsQuery.data ?? [],
    [shiftsQuery.data]
  );

  // ---- Per-day buckets for the chart ----
  const chartData: WeeklyChartPoint[] = React.useMemo(() => {
    const days = eachDayInWeek(week.mondayDate);
    const apptBuckets = new Array(7).fill(0) as number[];
    const shiftBuckets = new Array(7).fill(0) as number[];

    for (const appt of weekAppointments) {
      if (!appt.departure_time) continue;
      const idx = weekdayIndexMonSun(appt.departure_time, week.start);
      if (idx !== null) apptBuckets[idx]! += 1;
    }

    for (const shift of shifts) {
      const iso = shiftLocalDate(shift);
      if (!iso) continue;
      const idx = weekdayIndexMonSun(iso, week.start);
      if (idx !== null) shiftBuckets[idx]! += 1;
    }

    return days.map((day, i) => ({
      day: day.label,
      isoDate: day.isoDate,
      appointments: apptBuckets[i]!,
      shifts: shiftBuckets[i]!,
    }));
  }, [week.mondayDate, week.start, weekAppointments, shifts]);

  // ---- KPI values from dedicated count queries (immune to pagination) ----
  const todayAppointments = todayCountQuery.data ?? 0;
  const yesterdayAppointments = yesterdayCountQuery.data ?? 0;
  const appointmentsDelta = todayAppointments - yesterdayAppointments;
  const todayCardLoading =
    todayCountQuery.isLoading || yesterdayCountQuery.isLoading;

  const staffOnShiftToday = React.useMemo(
    () =>
      shifts.filter((shift) => shiftLocalDate(shift) === todayIso).length,
    [shifts, todayIso]
  );

  return (
    <div className="container py-8 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Snapshot for the week of {week.start} – {week.end} (Mon–Sun).
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Services
          </span>
          <ServiceMultiSelect
            options={serviceOptions}
            value={serviceFilter}
            onChange={setServiceFilter}
            showBadges={false}
            placeholder="Search services…"
            label="Services"
          />
        </div>
      </div>

      {/* Row 1: KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Today's appointments"
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
          value={todayAppointments}
          loading={todayCountQuery.isLoading}
          description={describeDelta(appointmentsDelta, todayCardLoading)}
        />
        <KpiCard
          title="Staff on shift"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          value={staffOnShiftToday}
          loading={shiftsQuery.isLoading}
          description="Today's Homebase shifts"
        />
        <KpiCard
          title="Unscheduled this week"
          icon={<Inbox className="h-4 w-4 text-muted-foreground" />}
          value={unscheduledQuery.data?.total ?? unscheduledAppointments.length}
          loading={unscheduledQuery.isLoading}
          description="This week's appointments, not on any plan"
        />
        <KpiCard
          title="Active properties"
          icon={<Home className="h-4 w-4 text-muted-foreground" />}
          value={activePropertiesQuery.data?.total ?? 0}
          loading={activePropertiesQuery.isLoading}
          description="Currently marked active"
        />
      </div>

      {/* Row 2: charts + unscheduled list */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {weekAppointmentsQuery.isLoading || shiftsQuery.isLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <WeeklyChart data={chartData} />
          )}
        </div>
        <UnscheduledList
          appointments={unscheduledAppointments}
          total={unscheduledQuery.data?.total ?? unscheduledAppointments.length}
          loading={unscheduledQuery.isLoading}
        />
      </div>

      <LifetimeSection query={lifetimeMetricsQuery} />
    </div>
  );
}

type LifetimeSectionProps = {
  query: ReturnType<typeof useQuery<DashboardLifetimeMetrics, Error>>;
};

function LifetimeSection({ query }: LifetimeSectionProps) {
  const data = query.data;
  const isLoading = query.isLoading;
  const isError = query.isError;

  const totals = data?.totals;
  const caption = describeLifetimeRange(totals);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Program-wide totals
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{caption}</p>
      </div>

      {isError ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Couldn&apos;t load lifetime metrics right now. Try refreshing.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Properties cleaned"
              icon={<Home className="h-4 w-4 text-muted-foreground" />}
              value={totals?.distinct_properties_cleaned ?? 0}
              loading={isLoading}
              description="Properties cleaned via AcornArranger"
            />
            <KpiCard
              title="Staff who served"
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
              value={totals?.distinct_staff_used ?? 0}
              loading={isLoading}
              description="Total Number of Staff AcornArranger has scheduled"
            />
            <KpiCard
              title="Days planned"
              icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
              value={totals?.days_with_sent_plan ?? 0}
              loading={isLoading}
              description="Number of days where a schedule was sent"
            />
            <KpiCard
              title="Appointments serviced"
              icon={<ListChecks className="h-4 w-4 text-muted-foreground" />}
              value={totals?.distinct_day_appointment_pairs ?? 0}
              loading={isLoading}
              description="Total number of appointments serviced"
            />
          </div>

          {isLoading || !data ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Skeleton className="aspect-[16/9] w-full rounded-xl" />
              <Skeleton className="aspect-[16/9] w-full rounded-xl" />
              <Skeleton className="aspect-[16/9] w-full rounded-xl" />
            </div>
          ) : (
            <LifetimeMetricsCharts
              appointmentsPerDay={data.appointments_per_day}
              teamSize={data.team_size_distribution}
              teamsPerDay={data.teams_per_day_distribution}
            />
          )}
        </>
      )}
    </section>
  );
}

function describeLifetimeRange(
  totals: DashboardLifetimeMetrics["totals"] | undefined
): string {
  if (!totals) return "Loading lifetime usage…";
  const { earliest_plan_date, latest_plan_date, days_with_sent_plan } = totals;
  if (!earliest_plan_date || !latest_plan_date || days_with_sent_plan === 0) {
    return "Send your first plan to start tracking program-wide totals.";
  }
  if (earliest_plan_date === latest_plan_date) {
    return `Since ${earliest_plan_date} AcornArranger has scheduled ${days_with_sent_plan.toLocaleString()} day.`;
  }
  return `From ${earliest_plan_date} to ${latest_plan_date} AcornArranger was used to schedule ${days_with_sent_plan.toLocaleString()} days.`;
}

function describeDelta(delta: number, loading: boolean): string {
  if (loading) return "vs. yesterday";
  if (delta === 0) return "Same as yesterday";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} vs. yesterday`;
}

type KpiCardProps = {
  title: string;
  icon: React.ReactNode;
  value: number;
  loading: boolean;
  description: string;
};

function KpiCard({ title, icon, value, loading, description }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

type UnscheduledListProps = {
  appointments: AppointmentRow[];
  total: number;
  loading: boolean;
};

function UnscheduledList({ appointments, total, loading }: UnscheduledListProps) {
  const visible = appointments.slice(0, 8);
  const hiddenCount = Math.max(0, total - visible.length);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Unscheduled this week</CardTitle>
        <CardDescription>
          Appointments not yet on a plan — click to open that day&apos;s schedule.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing unscheduled. Great work.
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((appt) => {
              const date = appt.departure_time?.slice(0, 10);
              const propertyName =
                appt.property_info?.property_name ??
                `Appointment ${appt.appointment_id ?? appt.id}`;
              const serviceName = appt.service_info?.name ?? "";
              return (
                <li key={appt.id}>
                  <Link
                    href={date ? `/dashboard/schedule?date=${date}` : "/dashboard/schedule"}
                    className="flex items-center justify-between gap-3 rounded-md border bg-background p-2 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{propertyName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {serviceName}
                        {date ? ` · ${date}` : ""}
                      </div>
                    </div>
                    {appt.status?.status ? (
                      <Badge variant="outline" className="shrink-0">
                        {appt.status.status}
                      </Badge>
                    ) : null}
                  </Link>
                </li>
              );
            })}
            {hiddenCount > 0 ? (
              <li className="pt-1 text-center text-xs text-muted-foreground">
                +{hiddenCount} more
              </li>
            ) : null}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
