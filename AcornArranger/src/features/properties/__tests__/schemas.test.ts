import { describe, it, expect } from "vitest";
import {
  PropertyQuerySchema,
  PropertyUpdatePayloadSchema,
  formatMinutes,
  hmToMinutes,
  dedupeIds,
  clampMinutes,
  removeSelfReference,
} from "../schemas";

describe("PropertyQuerySchema", () => {
  it("should parse valid query with all filters", () => {
    const input = {
      page: 2,
      pageSize: 50,
      q: "beach house",
      city: "San Diego",
      cleaningTimeMin: 60,
      cleaningTimeMax: 120,
      statusIds: [1, 2],
      sort: "property_name",
    };

    const result = PropertyQuerySchema.parse(input);
    expect(result).toEqual(input);
  });

  it("should use defaults for missing fields", () => {
    const input = {};
    const result = PropertyQuerySchema.parse(input);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });

  it("should accept cleaningTimeMin and cleaningTimeMax", () => {
    const input = {
      cleaningTimeMin: 30,
      cleaningTimeMax: 90,
    };

    const result = PropertyQuerySchema.parse(input);
    expect(result.cleaningTimeMin).toBe(30);
    expect(result.cleaningTimeMax).toBe(90);
  });

  it("should reject negative cleaningTimeMin", () => {
    const input = {
      cleaningTimeMin: -10,
    };

    expect(() => PropertyQuerySchema.parse(input)).toThrow();
  });
});

describe("PropertyUpdatePayloadSchema", () => {
  it("should accept valid cleaning minutes", () => {
    const input = { estimated_cleaning_mins: 90 };
    const result = PropertyUpdatePayloadSchema.parse(input);
    expect(result.estimated_cleaning_mins).toBe(90);
  });

  it("should accept null for cleaning minutes", () => {
    const input = { estimated_cleaning_mins: null };
    const result = PropertyUpdatePayloadSchema.parse(input);
    expect(result.estimated_cleaning_mins).toBeNull();
  });

  it("should reject negative cleaning minutes", () => {
    const input = { estimated_cleaning_mins: -10 };
    expect(() => PropertyUpdatePayloadSchema.parse(input)).toThrow(
      "Cleaning time must be at least 0 minutes"
    );
  });

  it("should reject cleaning minutes over 1440", () => {
    const input = { estimated_cleaning_mins: 1500 };
    expect(() => PropertyUpdatePayloadSchema.parse(input)).toThrow(
      "Cleaning time cannot exceed 24 hours (1440 minutes)"
    );
  });

  it("should accept and dedupe double_unit array", () => {
    const input = { double_unit: [1, 2, 3, 2, 1] };
    const result = PropertyUpdatePayloadSchema.parse(input);
    expect(result.double_unit).toEqual([1, 2, 3]);
  });

  it("should reject double_unit array over 20 items", () => {
    const input = {
      double_unit: Array.from({ length: 21 }, (_, i) => i + 1),
    };
    expect(() => PropertyUpdatePayloadSchema.parse(input)).toThrow(
      "Cannot link more than 20 properties"
    );
  });

  it("should allow empty double_unit array", () => {
    const input = { double_unit: [] };
    const result = PropertyUpdatePayloadSchema.parse(input);
    expect(result.double_unit).toEqual([]);
  });

  it("should accept null for double_unit (clearing linked units)", () => {
    const input = { double_unit: null };
    const result = PropertyUpdatePayloadSchema.parse(input);
    expect(result.double_unit).toBeNull();
  });
});

describe("formatMinutes", () => {
  it("should format 0 minutes", () => {
    expect(formatMinutes(0)).toBe("0m");
  });

  it("should format minutes only", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(59)).toBe("59m");
  });

  it("should format hours only", () => {
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(180)).toBe("3h");
  });

  it("should format hours and minutes", () => {
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(125)).toBe("2h 5m");
    expect(formatMinutes(1259)).toBe("20h 59m");
  });

  it("should handle edge case of 1440 minutes (24 hours)", () => {
    expect(formatMinutes(1440)).toBe("24h");
  });

  it("should handle negative numbers gracefully", () => {
    expect(formatMinutes(-10)).toBe("0m");
  });

  it("should handle non-finite numbers gracefully", () => {
    expect(formatMinutes(NaN)).toBe("0m");
    expect(formatMinutes(Infinity)).toBe("0m");
  });
});

describe("hmToMinutes", () => {
  it("should parse single-digit hours", () => {
    expect(hmToMinutes("1:30")).toBe(90);
    expect(hmToMinutes("5:00")).toBe(300);
  });

  it("should parse double-digit hours", () => {
    expect(hmToMinutes("01:30")).toBe(90);
    expect(hmToMinutes("10:45")).toBe(645);
  });

  it("should parse 24:00", () => {
    expect(hmToMinutes("24:00")).toBe(1440);
  });

  it("should parse edge cases", () => {
    expect(hmToMinutes("0:00")).toBe(0);
    expect(hmToMinutes("0:59")).toBe(59);
    expect(hmToMinutes("1:00")).toBe(60);
  });

  it("should return null for invalid format", () => {
    expect(hmToMinutes("invalid")).toBeNull();
    expect(hmToMinutes("1:2")).toBeNull(); // minutes must be 2 digits
    expect(hmToMinutes("1:60")).toBeNull(); // minutes must be < 60
    expect(hmToMinutes("")).toBeNull();
    expect(hmToMinutes("100:00")).toBeNull(); // hours must be 1-2 digits
  });

  it("should handle whitespace", () => {
    expect(hmToMinutes(" 1:30 ")).toBe(90);
  });
});

describe("dedupeIds", () => {
  it("should deduplicate array", () => {
    expect(dedupeIds([1, 2, 3, 2, 1])).toEqual([1, 2, 3]);
  });

  it("should preserve order", () => {
    expect(dedupeIds([3, 1, 2, 1])).toEqual([3, 1, 2]);
  });

  it("should handle empty array", () => {
    expect(dedupeIds([])).toEqual([]);
  });

  it("should handle array with no duplicates", () => {
    expect(dedupeIds([1, 2, 3])).toEqual([1, 2, 3]);
  });
});

describe("clampMinutes", () => {
  it("should clamp to range", () => {
    expect(clampMinutes(500)).toBe(500);
    expect(clampMinutes(0)).toBe(0);
    expect(clampMinutes(1440)).toBe(1440);
  });

  it("should clamp values below min", () => {
    expect(clampMinutes(-10)).toBe(0);
  });

  it("should clamp values above max", () => {
    expect(clampMinutes(2000)).toBe(1440);
  });

  it("should return null for null/undefined", () => {
    expect(clampMinutes(null)).toBeNull();
    expect(clampMinutes(undefined)).toBeNull();
  });

  it("should handle custom min/max", () => {
    expect(clampMinutes(50, 60, 120)).toBe(60);
    expect(clampMinutes(150, 60, 120)).toBe(120);
    expect(clampMinutes(90, 60, 120)).toBe(90);
  });

  it("should floor fractional values", () => {
    expect(clampMinutes(90.7)).toBe(90);
    expect(clampMinutes(120.3)).toBe(120);
  });

  it("should return null for non-finite numbers", () => {
    expect(clampMinutes(NaN)).toBeNull();
    expect(clampMinutes(Infinity)).toBeNull();
  });
});

describe("removeSelfReference", () => {
  it("should remove self-reference", () => {
    expect(removeSelfReference([1, 2, 3, 4], 3)).toEqual([1, 2, 4]);
  });

  it("should handle no self-reference", () => {
    expect(removeSelfReference([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });

  it("should handle empty array", () => {
    expect(removeSelfReference([], 1)).toEqual([]);
  });

  it("should remove all occurrences of self-reference", () => {
    expect(removeSelfReference([1, 2, 3, 2, 1], 2)).toEqual([1, 3, 1]);
  });
});
