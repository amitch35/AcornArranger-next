import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StaffListPage from "../page";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(""),
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function mockFetchImplementation() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/api/options/roles")) {
      return new Response(
        JSON.stringify({
          options: [{ id: 1, label: "Housekeeper" }],
          total: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.includes("/api/options/staff-status")) {
      return new Response(
        JSON.stringify({
          options: [
            { id: 1, label: "Active" },
            { id: 2, label: "Inactive" },
            { id: 3, label: "Unverified" },
          ],
          total: 3,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.includes("/api/staff")) {
      // Echo back a single staff member; test cases can assert on requested url.
      return new Response(
        JSON.stringify({
          items: [
            {
              user_id: 101,
              name: "Alice Example",
              first_name: "Alice",
              last_name: "Example",
              hb_user_id: null,
              role: {
                id: 1,
                title: "Housekeeper",
                description: null,
                priority: 3,
                can_clean: true,
                can_lead_team: false,
              },
              status: { status_id: 1, status: "Active" },
            },
          ],
          total: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  });
}

describe("StaffListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders role and capability columns using embedded role data", async () => {
    globalThis.fetch = mockFetchImplementation() as any;

    renderWithQueryClient(<StaffListPage />);

    // Wait for the staff row to appear
    await waitFor(() => {
      expect(screen.getByText("Alice Example")).toBeInTheDocument();
    });

    // Role column shows role title
    expect(screen.getByText("Housekeeper")).toBeInTheDocument();

    // Capability indicators should render (Yes for can_clean, No for can_lead_team)
    expect(screen.getAllByLabelText("Yes").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText("No").length).toBeGreaterThanOrEqual(1);
  });

  it("toggling Can Lead Team updates URL and triggers a refetch with canLeadTeam=true", async () => {
    const fetchMock = mockFetchImplementation();
    globalThis.fetch = fetchMock as any;

    renderWithQueryClient(<StaffListPage />);

    // Initial load should call /api/staff at least once
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/staff"))).toBe(true);
    });

    // Clear initial router.replace calls caused by initial effect run
    replaceMock.mockClear();

    const canLeadTeamCheckbox = screen.getByRole("checkbox", { name: /can lead team/i });
    fireEvent.click(canLeadTeamCheckbox);

    await waitFor(() => {
      const staffCalls = fetchMock.mock.calls
        .map((c) => String(c[0]))
        .filter((u) => u.includes("/api/staff"));
      expect(staffCalls.some((u) => u.includes("canLeadTeam=true"))).toBe(true);
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalled();
      const last = replaceMock.mock.calls.at(-1)?.[0] as string | undefined;
      expect(last).toContain("/dashboard/staff");
      expect(last).toContain("canLeadTeam=true");
    });
  });
});

