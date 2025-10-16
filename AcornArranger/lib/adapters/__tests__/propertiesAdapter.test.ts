import { describe, it, expect } from "vitest";
import { PropertiesAdapter } from "@/src/adapters/Properties";

describe("PropertiesAdapter.toApiParams", () => {
  it("builds camelCase params including pageSize and sort", () => {
    const params = PropertiesAdapter.toApiParams({
      filters: {
        q: "abc",
        page: 2,
        pageSize: 25,
        sort: "",
        statusIds: [1, 2],
        serviceIds: [],
        staffIds: [],
        propertyIds: [],
        dateFrom: undefined,
        dateTo: undefined,
      },
      sort: [
        { id: "name", desc: false },
        { id: "status", desc: true },
      ],
      pagination: { page: 2, pageSize: 25 },
    });

    const qs = params.toString();
    expect(qs).toContain("q=abc");
    expect(qs).toContain("page=2");
    expect(qs).toContain("pageSize=25");
    expect(qs).toContain("statusIds=1%2C2");
    expect(qs).toContain("sort=name%3Aasc%2Cstatus%3Adesc");
  });
});


