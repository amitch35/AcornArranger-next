"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type WeeklyChartPoint = {
  /** Short weekday label, e.g. "Mon". */
  day: string;
  /** ISO date (`YYYY-MM-DD`) for the point — shown in tooltips. */
  isoDate: string;
  appointments: number;
  shifts: number;
};

type WeeklyChartProps = {
  data: WeeklyChartPoint[];
};

const appointmentsConfig = {
  appointments: {
    label: "Appointments",
    theme: { light: "var(--chart-1)", dark: "var(--chart-1)" },
  },
} satisfies ChartConfig;

const shiftsConfig = {
  shifts: {
    label: "Staff on shift",
    theme: { light: "var(--chart-2)", dark: "var(--chart-2)" },
  },
} satisfies ChartConfig;

/**
 * Two stacked line charts showing appointments per day and staff-on-shift per
 * day across the Monday–Sunday week. Kept as two separate charts (rather than
 * one with two series) so the axes can be independently scaled and the story
 * for each metric reads cleanly on its own.
 */
export function WeeklyChart({ data }: WeeklyChartProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SingleLineChart
        title="Appointments this week"
        description="Active appointments per day."
        data={data}
        dataKey="appointments"
        config={appointmentsConfig}
      />
      <SingleLineChart
        title="Staff on shift this week"
        description="Homebase shifts per day."
        data={data}
        dataKey="shifts"
        config={shiftsConfig}
      />
    </div>
  );
}

type SingleLineChartProps = {
  title: string;
  description: string;
  data: WeeklyChartPoint[];
  dataKey: "appointments" | "shifts";
  config: ChartConfig;
};

function SingleLineChart({
  title,
  description,
  data,
  dataKey,
  config,
}: SingleLineChartProps) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground p-4 shadow-sm">
      <div className="mb-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ChartContainer config={config} className="aspect-[16/9] w-full">
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={32}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload as WeeklyChartPoint | undefined;
                  return point ? `${point.day} · ${point.isoDate}` : "";
                }}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={`var(--color-${dataKey})`}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
