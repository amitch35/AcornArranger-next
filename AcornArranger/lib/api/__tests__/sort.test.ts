import { describe, it, expect } from "vitest";
import { parseSortParam } from "@/lib/api/sort";

describe("parseSortParam", () => {
  const allowed = {
    id: "id",
    name: "name",
    status: "status_id",
  } as const;

  it("returns empty for falsy sort", () => {
    expect(parseSortParam(undefined, allowed)).toEqual([]);
    expect(parseSortParam(null, allowed)).toEqual([]);
    expect(parseSortParam("", allowed)).toEqual([]);
  });

  it("parses single asc by default", () => {
    expect(parseSortParam("name", allowed)).toEqual([{ column: "name", ascending: true }]);
  });

  it("parses explicit desc", () => {
    expect(parseSortParam("name:desc", allowed)).toEqual([{ column: "name", ascending: false }]);
  });

  it("ignores unknown fields", () => {
    expect(parseSortParam("unknown:asc", allowed)).toEqual([]);
  });

  it("parses multiple rules in order", () => {
    expect(parseSortParam("status:asc,name:desc", allowed)).toEqual([
      { column: "status_id", ascending: true },
      { column: "name", ascending: false },
    ]);
  });

  it("trims whitespace and normalizes case", () => {
    expect(parseSortParam("  name : DESC , status : Asc  ", allowed)).toEqual([
      { column: "name", ascending: false },
      { column: "status_id", ascending: true },
    ]);
  });
});


