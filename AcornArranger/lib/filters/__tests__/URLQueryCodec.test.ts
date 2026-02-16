import { describe, it, expect } from "vitest";
import {
  decodeFromSearchParams,
  encodeToSearchParams,
  Schemas,
  validateBaseFilters,
} from "../../filters/URLQueryCodec";

describe("URLQueryCodec", () => {
  it("round-trips canonical fields and preserves ordering", () => {
    const params = new URLSearchParams(
      "q=hello&page=2&pageSize=50&sort=name:asc&dateFrom=2024-01-01T00:00:00.000Z&dateTo=2024-02-01T00:00:00.000Z&statusIds=1,2&roleIds=3,4&canClean=true&canLeadTeam=true&serviceIds=21942,23044&staffIds=10,12&propertyIds=117138,128046"
    );
    const decoded = decodeFromSearchParams(params);
    const validated = validateBaseFilters(decoded, Schemas.appointment);
    const encoded = encodeToSearchParams(validated);

    expect(encoded.toString()).toContain("q=hello");
    expect(encoded.get("page")).toBe("2");
    expect(encoded.get("pageSize")).toBe("50");
    expect(encoded.get("sort")).toBe("name:asc");
    expect(encoded.get("dateFrom")).toBe("2024-01-01T00:00:00.000Z");
    expect(encoded.get("dateTo")).toBe("2024-02-01T00:00:00.000Z");
    expect(encoded.get("statusIds")).toBe("1,2");
    expect(encoded.get("roleIds")).toBe("3,4");
    expect(encoded.get("canClean")).toBe("true");
    expect(encoded.get("canLeadTeam")).toBe("true");
    expect(encoded.get("serviceIds")).toBe("21942,23044");
    expect(encoded.get("staffIds")).toBe("10,12");
    expect(encoded.get("propertyIds")).toBe("117138,128046");
  });

  it("ignores unknown/legacy keys and coerces IDs", () => {
    const params = new URLSearchParams(
      "filter_status_id=99&statusIds=1,abc,2&serviceIds=5,-1,3.7,99999999999&staffIds=&propertyIds=42"
    );
    const decoded = decodeFromSearchParams(params);
    const validated = validateBaseFilters(decoded, Schemas.property);
    const encoded = encodeToSearchParams(validated);

    // legacy key ignored
    expect(encoded.get("statusIds")).toBe("1,2");
    // negatives, floats, out-of-range dropped
    expect(encoded.get("serviceIds")).toBe("5");
    // empty list omitted
    expect(encoded.get("staffIds")).toBeNull();
    expect(encoded.get("propertyIds")).toBe("42");
  });

  it("preserves YYYY-MM-DD format and normalizes full datetime strings", () => {
    const params = new URLSearchParams(
      "dateFrom=2024-01-01&dateTo=2024-02-01&nextArrivalBefore=2024-02-01T12:30:00-05:00"
    );
    const decoded = decodeFromSearchParams(params);
    const validated = validateBaseFilters(decoded, Schemas.appointment);
    const encoded = encodeToSearchParams(validated);

    // Date-only strings should be preserved as YYYY-MM-DD (no timezone conversion)
    expect(encoded.get("dateFrom")).toBe("2024-01-01");
    expect(encoded.get("dateTo")).toBe("2024-02-01");
    // Full datetime strings should be normalized to ISO UTC
    expect(encoded.get("nextArrivalBefore")).toMatch(/Z$/);
  });

  it("coerces/ignores invalid pagination values", () => {
    const params = new URLSearchParams("page=0&pageSize=-5");
    const decoded = decodeFromSearchParams(params);
    const validated = validateBaseFilters(decoded, Schemas.base);
    const encoded = encodeToSearchParams(validated);
    // defaults from schema should be used, invalid ignored on decode
    expect(encoded.get("page")).toBe("1");
    expect(encoded.get("pageSize")).toBe("25");
  });

  it("drops out-of-range and boundary IDs, sorts ascending on encode", () => {
    const params = new URLSearchParams(
      `statusIds=0,-1,1,2147483648,3,2`
    );
    const decoded = decodeFromSearchParams(params);
    const validated = validateBaseFilters(decoded, Schemas.appointment);
    const encoded = encodeToSearchParams(validated);
    expect(encoded.get("statusIds")).toBe("1,2,3");
  });

  it("strips unknown keys on re-encode and preserves canonical key order", () => {
    const params = new URLSearchParams(
      "zzz=1&sort=a&page=2&serviceIds=3,1&q=s&dateFrom=2024-01-01&propertyIds=5&statusIds=2,1&roleIds=5,4&canClean=true&canLeadTeam=true&dateTo=2024-01-02&pageSize=10"
    );
    const decoded = decodeFromSearchParams(params);
    const validated = validateBaseFilters(decoded, Schemas.property);
    const encoded = encodeToSearchParams(validated);
    const s = encoded.toString();
    expect(s.startsWith("q=s&page=2&pageSize=10&sort=a&dateFrom=")).toBe(true);
    expect(s.includes("zzz=")).toBe(false);
    // ensure sorted arrays
    expect(encoded.get("statusIds")).toBe("1,2");
    expect(encoded.get("roleIds")).toBe("4,5");
    expect(encoded.get("serviceIds")).toBe("1,3");
  });

  it("applies allow-lists during decode when provided", () => {
    const params = new URLSearchParams("serviceIds=1,2,3,4");
    const decoded = decodeFromSearchParams(params, {
      allow: { serviceIds: new Set([2, 4]) },
    });
    const validated = validateBaseFilters(decoded, Schemas.base);
    const encoded = encodeToSearchParams(validated);
    expect(encoded.get("serviceIds")).toBe("2,4");
  });
});


