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
});

