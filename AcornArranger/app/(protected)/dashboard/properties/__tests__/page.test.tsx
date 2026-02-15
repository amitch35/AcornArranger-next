import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PropertiesListPage from "../page";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function mockFetchImplementation() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/api/options/property-status")) {
      return new Response(
        JSON.stringify({
          options: [
            { id: 1, label: "Active" },
            { id: 2, label: "Inactive" },
          ],
          total: 2,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.includes("/api/properties")) {
      // Echo back a single property; test cases can assert on requested url.
      return new Response(
        JSON.stringify({
          items: [
            {
              properties_id: 101,
              property_name: "Beach House 1",
              estimated_cleaning_mins: 90,
              double_unit: null,
              address: {
                city: "San Diego",
                address: "123 Ocean Blvd",
                country: "USA",
                state_name: "CA",
                postal_code: "92101",
              },
              status: {
                status_id: 1,
                status: "Active",
              },
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

describe("PropertiesListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders property data with address and status", async () => {
    globalThis.fetch = mockFetchImplementation() as any;

    renderWithQueryClient(<PropertiesListPage />);

    // Wait for the property row to appear
    await waitFor(() => {
      expect(screen.getByText("Beach House 1")).toBeInTheDocument();
    });

    // City should be displayed
    expect(screen.getByText("San Diego")).toBeInTheDocument();

    // Status should be displayed
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("initializes with default Active status filter", async () => {
    const fetchMock = mockFetchImplementation();
    globalThis.fetch = fetchMock as any;

    renderWithQueryClient(<PropertiesListPage />);

    // Wait for status options to load and defaults to be applied
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/options/property-status"))).toBe(true);
    });

    // Should eventually make a properties API call with statusIds
    await waitFor(
      () => {
        const propertiesCalls = fetchMock.mock.calls
          .map((c) => String(c[0]))
          .filter((u) => u.includes("/api/properties") && !u.includes("/api/options"));
        expect(propertiesCalls.some((u) => u.includes("statusIds=1"))).toBe(true);
      },
      { timeout: 3000 }
    );
  });

  it("updates URL when search input changes", async () => {
    const fetchMock = mockFetchImplementation();
    globalThis.fetch = fetchMock as any;

    renderWithQueryClient(<PropertiesListPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/properties"))).toBe(true);
    });

    // Clear initial router.replace calls
    replaceMock.mockClear();

    const searchInput = screen.getByPlaceholderText(/search properties/i);
    fireEvent.change(searchInput, { target: { value: "Ocean" } });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalled();
      const lastCall = replaceMock.mock.calls.at(-1)?.[0] as string | undefined;
      expect(lastCall).toContain("/dashboard/properties");
      expect(lastCall).toContain("q=Ocean");
    });
  });

  it("filters by city when city input changes", async () => {
    const fetchMock = mockFetchImplementation();
    globalThis.fetch = fetchMock as any;

    renderWithQueryClient(<PropertiesListPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/properties"))).toBe(true);
    });

    replaceMock.mockClear();

    const cityInput = screen.getByPlaceholderText(/filter by city/i);
    fireEvent.change(cityInput, { target: { value: "San Diego" } });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalled();
      const lastCall = replaceMock.mock.calls.at(-1)?.[0] as string | undefined;
      expect(lastCall).toContain("city=San");
    });
  });

  it("renders cleaning time with formatted duration", async () => {
    globalThis.fetch = mockFetchImplementation() as any;

    renderWithQueryClient(<PropertiesListPage />);

    // Wait for property to load with 90 minutes
    await waitFor(() => {
      expect(screen.getByText("Beach House 1")).toBeInTheDocument();
    });

    // 90 minutes should be displayed as "1h 30m"
    expect(screen.getByText("1h 30m")).toBeInTheDocument();
  });

  it("displays linked units count when double_unit exists", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/options/property-status")) {
        return new Response(
          JSON.stringify({
            options: [{ id: 1, label: "Active" }],
            total: 1,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/properties")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                properties_id: 101,
                property_name: "Beach House 1",
                estimated_cleaning_mins: 90,
                double_unit: [102, 103],
                address: {
                  city: "San Diego",
                  address: "123 Ocean Blvd",
                  country: "USA",
                  state_name: "CA",
                  postal_code: "92101",
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

    globalThis.fetch = fetchMock as any;

    renderWithQueryClient(<PropertiesListPage />);

    // Wait for property to load
    await waitFor(() => {
      expect(screen.getByText("Beach House 1")).toBeInTheDocument();
    });

    // Should show a button with "2" for the linked units count
    const linkedUnitsButton = screen.getByRole("button", { name: "2" });
    expect(linkedUnitsButton).toBeInTheDocument();
  });

  it("shows dash when no cleaning time is set", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/options/property-status")) {
        return new Response(
          JSON.stringify({
            options: [{ id: 1, label: "Active" }],
            total: 1,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/properties")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                properties_id: 101,
                property_name: "Beach House 1",
                estimated_cleaning_mins: null,
                double_unit: null,
                address: {
                  city: "San Diego",
                  address: "123 Ocean Blvd",
                  country: "USA",
                  state_name: "CA",
                  postal_code: "92101",
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

    globalThis.fetch = fetchMock as any;

    renderWithQueryClient(<PropertiesListPage />);

    // Wait for property to load
    await waitFor(() => {
      expect(screen.getByText("Beach House 1")).toBeInTheDocument();
    });

    // Should show "—" when cleaning time is null
    const cells = screen.getAllByText("—");
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it("includes cleaningTimeMin in URL when minimum cleaning filter is set", async () => {
    const fetchMock = mockFetchImplementation();
    globalThis.fetch = fetchMock as any;

    renderWithQueryClient(<PropertiesListPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/properties"))).toBe(true);
    });

    replaceMock.mockClear();

    // Find the minimum cleaning time hours input and set a value
    const minHoursInput = screen.getByLabelText("Minimum cleaning time hours");
    fireEvent.change(minHoursInput, { target: { value: "01" } });
    fireEvent.blur(minHoursInput);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalled();
      const lastCall = replaceMock.mock.calls.at(-1)?.[0] as string | undefined;
      expect(lastCall).toContain("cleaningTimeMin=60");
    });
  });

  it("includes cleaningTimeMax in URL when maximum cleaning filter is set", async () => {
    const fetchMock = mockFetchImplementation();
    globalThis.fetch = fetchMock as any;

    renderWithQueryClient(<PropertiesListPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/properties"))).toBe(true);
    });

    replaceMock.mockClear();

    // Find the maximum cleaning time hours input and set a value
    const maxHoursInput = screen.getByLabelText("Maximum cleaning time hours");
    fireEvent.change(maxHoursInput, { target: { value: "02" } });
    fireEvent.blur(maxHoursInput);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalled();
      const lastCall = replaceMock.mock.calls.at(-1)?.[0] as string | undefined;
      expect(lastCall).toContain("cleaningTimeMax=120");
    });
  });

  it("renders View action button for each property", async () => {
    globalThis.fetch = mockFetchImplementation() as any;

    renderWithQueryClient(<PropertiesListPage />);

    // Wait for property to load
    await waitFor(() => {
      expect(screen.getByText("Beach House 1")).toBeInTheDocument();
    });

    // Should have a View button with correct href
    const viewLink = screen.getByRole("link", { name: /view/i });
    expect(viewLink).toHaveAttribute("href", "/dashboard/properties/101");
  });
});
