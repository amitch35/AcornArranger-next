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
  const utils = render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  const rerender = (next: React.ReactElement) =>
    utils.rerender(<QueryClientProvider client={qc}>{next}</QueryClientProvider>);
  return { ...utils, rerender };
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

  it("keeps selected staff visible after a search narrows the option list (label cache)", async () => {
    // First render: Alice is in the list, gets cached as label for id=1.
    vi.mocked(useStaffOptions).mockReturnValue({
      data: { options: [{ id: 1, label: "Alice" }], total: 1 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchSpy as any;

    const { rerender } = renderWithQueryClient(
      <StaffPicker value={[1]} onChange={() => {}} />
    );

    // Trigger button shows the cached label.
    expect(
      screen.getByRole("button", { name: /Staff: Alice/i })
    ).toBeInTheDocument();

    // Now simulate a search that narrows the visible options so id=1 is no
    // longer present. The cached label should still be used for the chip.
    vi.mocked(useStaffOptions).mockReturnValue({
      data: { options: [], total: 0 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    rerender(<StaffPicker value={[1]} onChange={() => {}} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Staff: Alice/i })
      ).toBeInTheDocument();
    });

    // No detail fetch should ever have been issued.
    expect(fetchSpy).not.toHaveBeenCalled();
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

  it("Select All selects all visible options", async () => {
    vi.mocked(useStaffOptions).mockReturnValue({
      data: {
        options: [
          { id: 1, label: "Alice" },
          { id: 2, label: "Bob" },
        ],
        total: 2,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    const onChange = vi.fn();
    renderWithQueryClient(<StaffPicker value={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /^Staff(:|$)/i }));

    fireEvent.click(screen.getByRole("button", { name: /select all/i }));

    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([1, 2]));
    expect(onChange.mock.calls[0][0]).toHaveLength(2);
  });

  it("Select All merges with existing selections without duplicates", async () => {
    vi.mocked(useStaffOptions).mockReturnValue({
      data: {
        options: [
          { id: 1, label: "Alice" },
          { id: 2, label: "Bob" },
        ],
        total: 2,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    const onChange = vi.fn();
    // Alice (id=1) is already selected
    renderWithQueryClient(<StaffPicker value={[1]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Staff: Alice/i }));

    fireEvent.click(screen.getByRole("button", { name: /select all/i }));

    const emitted: number[] = onChange.mock.calls[0][0];
    expect(emitted).toEqual(expect.arrayContaining([1, 2]));
    // No duplicates
    expect(emitted).toHaveLength(new Set(emitted).size);
  });

  it("Select All button is disabled when all options are already selected", async () => {
    vi.mocked(useStaffOptions).mockReturnValue({
      data: { options: [{ id: 1, label: "Alice" }], total: 1 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(<StaffPicker value={[1]} onChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /Staff: Alice/i }));

    expect(screen.getByRole("button", { name: /select all/i })).toBeDisabled();
  });

  it("Select All button is disabled while options are loading", async () => {
    vi.mocked(useStaffOptions).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderWithQueryClient(<StaffPicker value={[]} onChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /^Staff(:|$)/i }));

    expect(screen.getByRole("button", { name: /select all/i })).toBeDisabled();
  });
});
