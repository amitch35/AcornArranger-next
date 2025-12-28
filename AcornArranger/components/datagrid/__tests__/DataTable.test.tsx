import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { act } from "react";
import { DataTable } from "../DataTable";

type Row = { id: number; name: string };

describe("DataTable", () => {
  it("emits sort changes when clicking a string header", async () => {
    const onChange = vi.fn();

    render(
      <DataTable<Row, unknown>
        columns={[
          { accessorKey: "id", header: "ID" },
          { accessorKey: "name", header: "Name" },
        ]}
        data={[
          { id: 2, name: "B" },
          { id: 1, name: "A" },
        ]}
        manualSorting
        onChange={onChange}
      />
    );

    const nameHeader = screen.getByRole("button", { name: /name/i });

    await act(async () => {
      fireEvent.click(nameHeader);
    });

    expect(onChange).toHaveBeenCalledWith({ sort: [{ id: "name", desc: false }] });
  });

  it("sorts rows client-side by default (manualSorting=false)", async () => {
    render(
      <DataTable<Row, unknown>
        columns={[
          { accessorKey: "id", header: "ID" },
          { accessorKey: "name", header: "Name" },
        ]}
        data={[
          { id: 2, name: "B" },
          { id: 1, name: "A" },
        ]}
      />
    );

    // Before sorting, first data row should be id=2 (original order)
    const before = screen.getAllByRole("row");
    // rows[0] is header; rows[1] is first data row
    expect(before[1]).toHaveTextContent("2");

    const nameHeader = screen.getByRole("button", { name: /name/i });
    await act(async () => {
      fireEvent.click(nameHeader);
    });

    const after = screen.getAllByRole("row");
    expect(after[1]).toHaveTextContent("1");
  });
});

