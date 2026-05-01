import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardContent } from "../DashboardContent";

function renderWithQueryClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function makeLifetimeMetrics() {
  return {
    totals: {
      distinct_properties_cleaned: 12,
      distinct_staff_used: 5,
      days_with_sent_plan: 30,
      distinct_day_appointment_pairs: 240,
      earliest_plan_date: "2025-01-01",
      latest_plan_date: "2026-01-31",
    },
    appointments_per_day: {
      stats: {
        min_per_day: 1,
        p25: 4,
        median: 8,
        p75: 12,
        p95: 18,
        max_per_day: 22,
        mean_per_day: 8.5,
      },
      histogram: [{ n_appts: 8, days: 10 }],
    },
    team_size_distribution: [{ team_size: 2, plans: 18 }],
    teams_per_day_distribution: [{ teams_per_day: 1, days: 20 }],
  };
}

function mockFetchImplementation() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/api/dashboard/metrics")) {
      return new Response(JSON.stringify(makeLifetimeMetrics()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/appointments")) {
      return new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/shifts")) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/properties")) {
      return new Response(JSON.stringify({ total: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  });
}

describe("DashboardContent — lifetime metrics section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the 'Program-wide totals' heading", () => {
    globalThis.fetch = mockFetchImplementation() as unknown as typeof fetch;
    renderWithQueryClient(<DashboardContent />);

    expect(screen.getByText("Program-wide totals")).toBeInTheDocument();
  });

  it("populates lifetime KPI tiles after the metrics fetch resolves", async () => {
    globalThis.fetch = mockFetchImplementation() as unknown as typeof fetch;
    renderWithQueryClient(<DashboardContent />);

    await waitFor(() => {
      expect(screen.getByText("Properties cleaned")).toBeInTheDocument();
      expect(screen.getByText("Staff who served")).toBeInTheDocument();
      expect(screen.getByText("Days planned")).toBeInTheDocument();
      expect(screen.getByText("Appointments serviced")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("30")).toBeInTheDocument();
      expect(screen.getByText("240")).toBeInTheDocument();
    });
  });

  it("shows the since/until caption derived from the totals", async () => {
    globalThis.fetch = mockFetchImplementation() as unknown as typeof fetch;
    renderWithQueryClient(<DashboardContent />);

    await waitFor(() => {
      expect(
        screen.getByText(/From 2025-01-01 to 2026-01-31 AcornArranger was used to schedule 30 days/)
      ).toBeInTheDocument();
    });
  });
});
