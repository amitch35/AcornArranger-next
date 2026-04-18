"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Home,
  Inbox,
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
import {
  eachDayInWeek,
  formatLocalDate,
  getWeekRangeContaining,
  today,
  weekdayIndexMonSun,
} from "@/lib/date/week";
import type { AppointmentRow } from "@/src/features/appointments/schemas";
import type { StaffShift } from "@/src/features/plans/schemas";

const DASHBOARD_STALE_TIME = 30 * 60 * 1000; // 30 minutes
/** Statuses we treat as "live" workload on the dashboard — excludes Cancelled (5). */
const ACTIVE_STATUSES = "1,2,3,4";

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
  // Anchor the dashboard on "today" at mount. Changes to the system clock
  // during the session don't need to retrigger the full dashboard re-render.
  const anchor = React.useMemo(() => today(), []);
  const todayIso = React.useMemo(() => formatLocalDate(anchor), [anchor]);
  const yesterdayIso = React.useMemo(() => {
    const d = new Date(anchor);
    d.setDate(d.getDate() - 1);
    return formatLocalDate(d);
  }, [anchor]);
  const week = React.useMemo(() => getWeekRangeContaining(anchor), [anchor]);

  // ---- Week appointments (for chart + "today" / "yesterday" buckets) ----
  const weekAppointmentsQuery = useQuery({
    queryKey: ["dashboard-week-appts", week.start, week.end],
    queryFn: () =>
      fetchAppointments({
        dateFrom: week.start,
        dateTo: week.end,
        statusIds: ACTIVE_STATUSES,
        pageSize: "200",
      }),
    staleTime: DASHBOARD_STALE_TIME,
  });

  // ---- Unscheduled (excludePlanned) appointments for the whole week ----
  const unscheduledQuery = useQuery({
    queryKey: ["dashboard-unscheduled", week.start, week.end],
    queryFn: () =>
      fetchAppointments({
        dateFrom: week.start,
        dateTo: week.end,
        statusIds: ACTIVE_STATUSES,
        excludePlanned: "true",
        pageSize: "200",
      }),
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

  const weekAppointments = weekAppointmentsQuery.data?.items ?? [];
  const unscheduledAppointments = unscheduledQuery.data?.items ?? [];
  const shifts = shiftsQuery.data ?? [];

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

  // ---- KPI values derived from the same queries ----
  const todayAppointments = React.useMemo(
    () =>
      weekAppointments.filter((a) => a.departure_time?.slice(0, 10) === todayIso)
        .length,
    [weekAppointments, todayIso]
  );

  const yesterdayAppointments = React.useMemo(
    () =>
      weekAppointments.filter(
        (a) => a.departure_time?.slice(0, 10) === yesterdayIso
      ).length,
    [weekAppointments, yesterdayIso]
  );

  const appointmentsDelta = todayAppointments - yesterdayAppointments;

  const staffOnShiftToday = React.useMemo(
    () =>
      shifts.filter((shift) => shiftLocalDate(shift) === todayIso).length,
    [shifts, todayIso]
  );

  return (
    <div className="container py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Snapshot for the week of {week.start} – {week.end} (Mon–Sun).
        </p>
      </div>

      {/* Row 1: KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Today's appointments"
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
          value={todayAppointments}
          loading={weekAppointmentsQuery.isLoading}
          description={describeDelta(
            appointmentsDelta,
            weekAppointmentsQuery.isLoading
          )}
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
          loading={unscheduledQuery.isLoading}
        />
      </div>
    </div>
  );
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
  loading: boolean;
};

function UnscheduledList({ appointments, loading }: UnscheduledListProps) {
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
            {appointments.slice(0, 8).map((appt) => {
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
            {appointments.length > 8 ? (
              <li className="pt-1 text-center text-xs text-muted-foreground">
                +{appointments.length - 8} more
              </li>
            ) : null}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
