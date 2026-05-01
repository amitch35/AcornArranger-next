import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { LifetimeMetricsCharts } from "../LifetimeMetricsCharts";
import type {
  AppointmentsPerDay,
  TeamSizeBucket,
  TeamsPerDayBucket,
} from "../schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const APPOINTMENTS_FIXTURE: AppointmentsPerDay = {
  stats: {
    min_per_day: 1,
    p25: 4,
    median: 8,
    p75: 12,
    p95: 18,
    max_per_day: 22,
    mean_per_day: 8.5,
  },
  histogram: [
    { n_appts: 1, days: 2 },
    { n_appts: 4, days: 6 },
    { n_appts: 8, days: 10 },
    { n_appts: 12, days: 5 },
    { n_appts: 22, days: 1 },
  ],
};

const TEAM_SIZE_FIXTURE: TeamSizeBucket[] = [
  { team_size: 1, plans: 12 },
  { team_size: 2, plans: 18 },
  { team_size: 3, plans: 4 },
];

const TEAMS_PER_DAY_FIXTURE: TeamsPerDayBucket[] = [
  { teams_per_day: 1, days: 20 },
  { teams_per_day: 2, days: 8 },
  { teams_per_day: 3, days: 2 },
];

const EMPTY_APPOINTMENTS: AppointmentsPerDay = {
  stats: {
    min_per_day: 0,
    p25: 0,
    median: 0,
    p75: 0,
    p95: 0,
    max_per_day: 0,
    mean_per_day: 0,
  },
  histogram: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LifetimeMetricsCharts", () => {
  it("renders the three chart titles", () => {
    render(
      <LifetimeMetricsCharts
        appointmentsPerDay={APPOINTMENTS_FIXTURE}
        teamSize={TEAM_SIZE_FIXTURE}
        teamsPerDay={TEAMS_PER_DAY_FIXTURE}
      />
    );

    expect(screen.getByText("Appointments per day distribution")).toBeInTheDocument();
    expect(screen.getByText("Team size distribution")).toBeInTheDocument();
    expect(screen.getByText("Teams per day distribution")).toBeInTheDocument();
  });

  it("summarises the per-day stats in the subtitle", () => {
    render(
      <LifetimeMetricsCharts
        appointmentsPerDay={APPOINTMENTS_FIXTURE}
        teamSize={TEAM_SIZE_FIXTURE}
        teamsPerDay={TEAMS_PER_DAY_FIXTURE}
      />
    );

    expect(
      screen.getByText(/Median: 8 • Mean: 8\.5 • 95th percentile: 18 • Highest: 22/)
    ).toBeInTheDocument();
  });

  it("totals plans across the team-size buckets", () => {
    render(
      <LifetimeMetricsCharts
        appointmentsPerDay={APPOINTMENTS_FIXTURE}
        teamSize={TEAM_SIZE_FIXTURE}
        teamsPerDay={TEAMS_PER_DAY_FIXTURE}
      />
    );

    // 12 + 18 + 4 = 34 sent plans
    expect(screen.getByText(/Across 34 sent plans/)).toBeInTheDocument();
  });

  it("totals days across the teams-per-day buckets", () => {
    render(
      <LifetimeMetricsCharts
        appointmentsPerDay={APPOINTMENTS_FIXTURE}
        teamSize={TEAM_SIZE_FIXTURE}
        teamsPerDay={TEAMS_PER_DAY_FIXTURE}
      />
    );

    // 20 + 8 + 2 = 30 planned days
    expect(screen.getByText(/Across 30 planned days/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no sent plans yet", () => {
    render(
      <LifetimeMetricsCharts
        appointmentsPerDay={EMPTY_APPOINTMENTS}
        teamSize={[]}
        teamsPerDay={[]}
      />
    );

    expect(screen.getAllByText(/No sent plans yet/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Once you send a plan/i).length
    ).toBeGreaterThanOrEqual(3);
  });
});
