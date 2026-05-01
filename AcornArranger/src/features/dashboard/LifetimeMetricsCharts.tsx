"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type {
  AppointmentsPerDay,
  TeamSizeBucket,
  TeamsPerDayBucket,
} from "./schemas";

type LifetimeMetricsChartsProps = {
  appointmentsPerDay: AppointmentsPerDay;
  teamSize: TeamSizeBucket[];
  teamsPerDay: TeamsPerDayBucket[];
};

/**
 * Three sibling bar charts that visualise lifetime distributions:
 * appointments-per-day, team-size, and teams-per-day. Kept as a single
 * exported component so the dashboard can drop a uniform 3-column row.
 */
export function LifetimeMetricsCharts({
  appointmentsPerDay,
  teamSize,
  teamsPerDay,
}: LifetimeMetricsChartsProps) {
  const totalSentPlans = teamSize.reduce((acc, b) => acc + b.plans, 0);
  const totalDays = teamsPerDay.reduce((acc, b) => acc + b.days, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <AppointmentsPerDayChart data={appointmentsPerDay} />
      <TeamSizeChart data={teamSize} totalSentPlans={totalSentPlans} />
      <TeamsPerDayChart data={teamsPerDay} totalDays={totalDays} />
    </div>
  );
}

const appointmentsPerDayConfig = {
  days: {
    label: "Days",
    theme: { light: "var(--chart-1)", dark: "var(--chart-1)" },
  },
} satisfies ChartConfig;

const teamSizeConfig = {
  plans: {
    label: "Plans",
    theme: { light: "var(--chart-2)", dark: "var(--chart-2)" },
  },
} satisfies ChartConfig;

const teamsPerDayConfig = {
  days: {
    label: "Days",
    theme: { light: "var(--chart-3)", dark: "var(--chart-3)" },
  },
} satisfies ChartConfig;

function AppointmentsPerDayChart({ data }: { data: AppointmentsPerDay }) {
  const { stats, histogram } = data;
  const hasData = histogram.length > 0;

  const subtitle = hasData
    ? `Median: ${formatNum(stats.median)} • Mean: ${formatNum(
        stats.mean_per_day
      )} • 95th percentile: ${formatNum(stats.p95)} • Highest: ${formatNum(stats.max_per_day)}`
    : "No sent plans yet.";

  return (
    <ChartCard
      title="Appointments per day distribution"
      description={subtitle}
      empty={!hasData}
    >
      <ChartContainer
        config={appointmentsPerDayConfig}
        className="aspect-[16/9] w-full"
      >
        <BarChart
          data={histogram}
          margin={{ top: 24, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="n_appts"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            allowDecimals={false}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={44}
          />
          <ChartTooltip
            cursor={{ fillOpacity: 0.1 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload as
                    | { n_appts?: number }
                    | undefined;
                  if (!point || point.n_appts === undefined) return "";
                  const n = point.n_appts;
                  return `${n} appointment${n === 1 ? "" : "s"}`;
                }}
              />
            }
          />
          <ReferenceLine
            x={Math.round(stats.median)}
            stroke="var(--chart-3)"
            strokeDasharray="4 4"
            label={{
              value: "Median",
              position: "top",
              fontSize: 10,
              fill: "var(--muted-foreground)",
            }}
            ifOverflow="extendDomain"
          />
          <ReferenceLine
            x={Math.round(stats.p95)}
            stroke="var(--chart-5)"
            strokeDasharray="4 4"
            label={{
              value: "p95",
              position: "top",
              fontSize: 10,
              fill: "var(--muted-foreground)",
            }}
            ifOverflow="extendDomain"
          />
          <Bar
            dataKey="days"
            fill="var(--color-days)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

function TeamSizeChart({
  data,
  totalSentPlans,
}: {
  data: TeamSizeBucket[];
  totalSentPlans: number;
}) {
  const hasData = data.length > 0;
  const subtitle = hasData
    ? `Across ${totalSentPlans.toLocaleString()} sent plan${totalSentPlans === 1 ? "" : "s"}`
    : "No sent plans yet.";

  return (
    <ChartCard
      title="Team size distribution"
      description={subtitle}
      empty={!hasData}
    >
      <ChartContainer
        config={teamSizeConfig}
        className="aspect-[16/9] w-full"
      >
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="team_size"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            allowDecimals={false}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={44}
          />
          <ChartTooltip
            cursor={{ fillOpacity: 0.1 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload as
                    | { team_size?: number }
                    | undefined;
                  if (!point || point.team_size === undefined) return "";
                  const n = point.team_size;
                  return `${n} staff per plan`;
                }}
              />
            }
          />
          <Bar
            dataKey="plans"
            fill="var(--color-plans)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

function TeamsPerDayChart({
  data,
  totalDays,
}: {
  data: TeamsPerDayBucket[];
  totalDays: number;
}) {
  const hasData = data.length > 0;
  const subtitle = hasData
    ? `Across ${totalDays.toLocaleString()} planned day${totalDays === 1 ? "" : "s"}`
    : "No sent plans yet.";

  return (
    <ChartCard
      title="Teams per day distribution"
      description={subtitle}
      empty={!hasData}
    >
      <ChartContainer
        config={teamsPerDayConfig}
        className="aspect-[16/9] w-full"
      >
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="teams_per_day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            allowDecimals={false}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={44}
          />
          <ChartTooltip
            cursor={{ fillOpacity: 0.1 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload as
                    | { teams_per_day?: number }
                    | undefined;
                  if (!point || point.teams_per_day === undefined) return "";
                  const n = point.teams_per_day;
                  return `${n} team${n === 1 ? "" : "s"} on the day`;
                }}
              />
            }
          />
          <Bar
            dataKey="days"
            fill="var(--color-days)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

type ChartCardProps = {
  title: string;
  description: string;
  empty: boolean;
  children: React.ReactNode;
};

function ChartCard({ title, description, empty, children }: ChartCardProps) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground p-4 shadow-sm">
      <div className="mb-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {empty ? (
        <div className="flex aspect-[16/9] w-full items-center justify-center text-xs text-muted-foreground">
          Once you send a plan, the distribution will appear here.
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/** Round percentile/mean values to a single decimal place when fractional. */
function formatNum(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(1);
}
