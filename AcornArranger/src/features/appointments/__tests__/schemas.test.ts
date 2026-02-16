import { describe, it, expect } from "vitest";
import {
  AppointmentStatusSchema,
  AppointmentPropertyInfoSchema,
  AppointmentStaffMemberSchema,
  AppointmentServiceInfoSchema,
  AppointmentRowSchema,
  AppointmentListResponseSchema,
  formatAppointmentStaffName,
  formatStaffSummary,
  getStatusBadgeVariant,
  formatDateTime,
  isWithinHours,
} from "../schemas";

// ============================================================================
// Schema validation tests
// ============================================================================

describe("Appointment Schemas", () => {
  describe("AppointmentStatusSchema", () => {
    it("accepts valid status", () => {
      const result = AppointmentStatusSchema.safeParse({
        status_id: 1,
        status: "Confirmed",
      });
      expect(result.success).toBe(true);
    });

    it("accepts null status label", () => {
      const result = AppointmentStatusSchema.safeParse({
        status_id: 2,
        status: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("AppointmentPropertyInfoSchema", () => {
    it("accepts valid property info", () => {
      const result = AppointmentPropertyInfoSchema.safeParse({
        properties_id: 123,
        property_name: "Ocean View Suite",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("AppointmentStaffMemberSchema", () => {
    it("accepts full staff member", () => {
      const result = AppointmentStaffMemberSchema.safeParse({
        user_id: 42,
        name: "Alice Example",
        first_name: "Alice",
        last_name: "Example",
      });
      expect(result.success).toBe(true);
    });

    it("accepts staff with null name fields", () => {
      const result = AppointmentStaffMemberSchema.safeParse({
        user_id: 1,
        name: null,
        first_name: null,
        last_name: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("AppointmentRowSchema", () => {
    const validRow = {
      id: 1,
      appointment_id: 100,
      departure_time: "2025-01-15T09:00:00Z",
      arrival_time: "2025-01-15T12:00:00Z",
      next_arrival_time: "2025-01-15T15:00:00Z",
      turn_around: true,
      cancelled_date: null,
      created_at: "2025-01-10T00:00:00Z",
      status: { status_id: 1, status: "Confirmed" },
      property_info: { properties_id: 123, property_name: "Suite A" },
      service_info: { service_id: 5, name: "Deep Clean" },
      staff: [
        { user_id: 42, name: "Alice", first_name: "Alice", last_name: "Smith" },
      ],
    };

    it("accepts a full valid row", () => {
      const result = AppointmentRowSchema.safeParse(validRow);
      expect(result.success).toBe(true);
    });

    it("accepts row with nullable fields as null", () => {
      const result = AppointmentRowSchema.safeParse({
        ...validRow,
        appointment_id: null,
        departure_time: null,
        arrival_time: null,
        next_arrival_time: null,
        turn_around: null,
        status: null,
        property_info: null,
        service_info: null,
        staff: [],
      });
      expect(result.success).toBe(true);
    });

    it("defaults staff to empty array when missing", () => {
      const result = AppointmentRowSchema.safeParse({
        ...validRow,
        staff: undefined,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staff).toEqual([]);
      }
    });
  });

  describe("AppointmentListResponseSchema", () => {
    it("accepts valid list response", () => {
      const result = AppointmentListResponseSchema.safeParse({
        items: [],
        total: 0,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative total", () => {
      const result = AppointmentListResponseSchema.safeParse({
        items: [],
        total: -1,
      });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Helper function tests
// ============================================================================

describe("Appointment Helpers", () => {
  describe("formatAppointmentStaffName", () => {
    it("uses name field when available", () => {
      expect(
        formatAppointmentStaffName({
          user_id: 1,
          name: "Alice Example",
          first_name: "Alice",
          last_name: "Example",
        })
      ).toBe("Alice Example");
    });

    it("combines first and last name when name is null", () => {
      expect(
        formatAppointmentStaffName({
          user_id: 1,
          name: null,
          first_name: "Bob",
          last_name: "Smith",
        })
      ).toBe("Bob Smith");
    });

    it("uses only first_name when last_name is null", () => {
      expect(
        formatAppointmentStaffName({
          user_id: 1,
          name: null,
          first_name: "Carol",
          last_name: null,
        })
      ).toBe("Carol");
    });

    it("falls back to user_id when no names available", () => {
      expect(
        formatAppointmentStaffName({
          user_id: 42,
          name: null,
          first_name: null,
          last_name: null,
        })
      ).toBe("Staff 42");
    });
  });

  describe("formatStaffSummary", () => {
    it("returns Unassigned for empty array", () => {
      const result = formatStaffSummary([]);
      expect(result.primary).toBe("Unassigned");
      expect(result.additionalCount).toBe(0);
    });

    it("returns single staff name with no additional", () => {
      const result = formatStaffSummary([
        { user_id: 1, name: "Alice", first_name: null, last_name: null },
      ]);
      expect(result.primary).toBe("Alice");
      expect(result.additionalCount).toBe(0);
    });

    it("returns first staff name with count of additional", () => {
      const result = formatStaffSummary([
        { user_id: 1, name: "Alice", first_name: null, last_name: null },
        { user_id: 2, name: "Bob", first_name: null, last_name: null },
        { user_id: 3, name: "Carol", first_name: null, last_name: null },
      ]);
      expect(result.primary).toBe("Alice");
      expect(result.additionalCount).toBe(2);
    });
  });

  describe("getStatusBadgeVariant", () => {
    it("returns 'default' for confirmed/scheduled", () => {
      expect(getStatusBadgeVariant("Confirmed")).toBe("default");
      expect(getStatusBadgeVariant("Scheduled")).toBe("default");
      expect(getStatusBadgeVariant("Active")).toBe("default");
    });

    it("returns 'secondary' for completed/done", () => {
      expect(getStatusBadgeVariant("Completed")).toBe("secondary");
      expect(getStatusBadgeVariant("Done")).toBe("secondary");
      expect(getStatusBadgeVariant("Finished")).toBe("secondary");
    });

    it("returns 'destructive' for cancelled", () => {
      expect(getStatusBadgeVariant("Cancelled")).toBe("destructive");
      expect(getStatusBadgeVariant("Canceled")).toBe("destructive");
    });

    it("returns 'outline' for unknown/null", () => {
      expect(getStatusBadgeVariant(null)).toBe("outline");
      expect(getStatusBadgeVariant(undefined)).toBe("outline");
      expect(getStatusBadgeVariant("SomethingElse")).toBe("outline");
    });
  });

  describe("formatDateTime", () => {
    it("returns dash for null", () => {
      expect(formatDateTime(null)).toBe("—");
    });

    it("returns dash for undefined", () => {
      expect(formatDateTime(undefined)).toBe("—");
    });

    it("formats a valid ISO string with time", () => {
      const result = formatDateTime("2025-06-15T14:30:00Z");
      expect(result).not.toBe("—");
      expect(result).toContain(","); // Should contain comma between date and time
      expect(result.length).toBeGreaterThan(0);
    });

    it("shows date only for midnight times (00:00:00)", () => {
      const result = formatDateTime("2026-02-15T00:00:00+00:00");
      expect(result).not.toBe("—");
      expect(result).not.toContain(","); // Should NOT contain comma (no time shown)
      expect(result).not.toContain("AM");
      expect(result).not.toContain("PM");
      expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/); // Should be MM/DD/YYYY format only
    });

    it("shows full date+time for non-midnight times", () => {
      const result = formatDateTime("2026-02-15T09:30:00+00:00");
      expect(result).toContain(","); // Should contain comma between date and time
      expect(result).toMatch(/AM|PM/); // Should contain AM or PM
    });
  });

  describe("isWithinHours", () => {
    it("returns false for null", () => {
      expect(isWithinHours(null, 2)).toBe(false);
    });

    it("returns false for past dates", () => {
      expect(isWithinHours("2020-01-01T00:00:00Z", 2)).toBe(false);
    });

    it("returns true for near-future dates", () => {
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      expect(isWithinHours(oneHourFromNow, 2)).toBe(true);
    });

    it("returns false for far-future dates", () => {
      const tenHoursFromNow = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();
      expect(isWithinHours(tenHoursFromNow, 2)).toBe(false);
    });
  });
});
