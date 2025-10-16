import { describe, it, expect } from "vitest";
import { StaffAdapter } from "@/src/adapters/Staff";

describe("StaffAdapter.toApiParams", () => {
  it("supports firstName/lastName sort keys", () => {
    const params = StaffAdapter.toApiParams({
      filters: {
        q: "",
        page: 1,
        pageSize: 50,
        sort: "",
        statusIds: [],
        serviceIds: [],
        staffIds: [],
        propertyIds: [],
        dateFrom: undefined,
        dateTo: undefined,
      },
      sort: [
        { id: "firstName", desc: false },
        { id: "lastName", desc: true },
      ],
      pagination: { page: 1, pageSize: 50 },
    });

    const qs = params.toString();
    expect(qs).toContain("page=1");
    expect(qs).toContain("pageSize=50");
    expect(qs).toContain("sort=firstName%3Aasc%2ClastName%3Adesc");
  });
});


