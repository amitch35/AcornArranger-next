import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StaffPicker from "../StaffPicker";

vi.mock("@/lib/options/useStaffOptions", () => ({
  useStaffOptions: vi.fn(),
}));

import { useStaffOptions } from "@/lib/options/useStaffOptions";

function renderWithQueryClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("StaffPicker", () => {
  it("defaults to Active (statusIds=[1]) and canClean=true", async () => {
    vi.mocked(useStaffOptions).mockReturnValue({
      data: { options: [{ id: 1, label: "Alice" }], total: 1 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(<StaffPicker value={[]} onChange={() => {}} />);

    expect(useStaffOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        statusIds: [1],
        canClean: true,
      })
    );
  });

  it("keeps and visually marks non-active selected staff (via detail fetch)", async () => {
    vi.mocked(useStaffOptions).mockReturnValue({
      data: { options: [{ id: 1, label: "Alice" }], total: 1 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    // Selected user_id=2 is not in options (likely inactive). Breadcrumb/page cache uses fetch,
    // so we mock the staff detail fetch endpoint.
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/staff/2")) {
        return new Response(
          JSON.stringify({
            user_id: 2,
            name: "Bob Inactive",
            first_name: "Bob",
            last_name: "Inactive",
            hb_user_id: null,
            role: null,
            status: { status_id: 2, status: "Inactive" },
            capabilities: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }) as any;

    renderWithQueryClient(<StaffPicker value={[2]} onChange={() => {}} />);

    // The selected badge should show the staff name and an INACTIVE marker
    await waitFor(() => {
      expect(screen.getByText("Bob Inactive")).toBeInTheDocument();
    });
    expect(screen.getByText(/^Inactive$/i)).toBeInTheDocument();
  });

  it("emits selected user_id numbers", async () => {
    vi.mocked(useStaffOptions).mockReturnValue({
      data: { options: [{ id: 1, label: "Alice" }], total: 1 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    const onChange = vi.fn();
    renderWithQueryClient(<StaffPicker value={[]} onChange={onChange} />);

    // open popover
    fireEvent.click(screen.getByRole("button", { name: /^Staff(:|$)/i }));

    // select Alice
    fireEvent.click(screen.getByRole("option", { name: "Alice" }));

    expect(onChange).toHaveBeenCalledWith([1]);
  });
});

