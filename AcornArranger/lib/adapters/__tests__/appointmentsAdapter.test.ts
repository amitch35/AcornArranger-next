import { describe, it, expect } from "vitest";
import { AppointmentsAdapter } from "@/src/adapters/Appointments";

describe("AppointmentsAdapter.toApiParams", () => {
  it("builds params with sort and arrays", () => {
    const params = AppointmentsAdapter.toApiParams({
      filters: {
        q: "",
        page: 1,
        pageSize: 10,
        sort: "",
        statusIds: [3],
        serviceIds: [4, 5],
        staffIds: [],
        propertyIds: [9],
        dateFrom: "2024-01-01T00:00:00.000Z",
        dateTo: "2024-01-31T00:00:00.000Z",
      },
      sort: [{ id: "status", desc: false }],
      pagination: { page: 1, pageSize: 10 },
    });

    const qs = params.toString();
    expect(qs).toContain("page=1");
    expect(qs).toContain("pageSize=10");
    expect(qs).toContain("statusIds=3");
    expect(qs).toContain("serviceIds=4%2C5");
    expect(qs).toContain("propertyIds=9");
    expect(qs).toContain("dateFrom=2024-01-01T00%3A00%3A00.000Z");
    expect(qs).toContain("dateTo=2024-01-31T00%3A00%3A00.000Z");
    expect(qs).toContain("sort=status%3Aasc");
  });
});


