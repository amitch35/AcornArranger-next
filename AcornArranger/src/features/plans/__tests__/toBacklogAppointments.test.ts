import { describe, it, expect } from "vitest";
import { toBacklogAppointments } from "../components/BacklogPanel";
import type { AppointmentRow } from "@/src/features/appointments/schemas";

function makeAppointment(
  overrides: Partial<AppointmentRow> & { id: number; appointment_id?: number | null }
): AppointmentRow {
  const { id, appointment_id, ...rest } = overrides;
  return {
    departure_time: null,
    arrival_time: null,
    next_arrival_time: null,
    turn_around: null,
    cancelled_date: null,
    created_at: "2026-01-01T00:00:00Z",
    status: { status_id: 1, status: "Confirmed" },
    property_info: { properties_id: 100, property_name: "Test" },
    service_info: { service_id: 21942, name: "Clean" },
    staff: [],
    ...rest,
    id,
    appointment_id: appointment_id ?? id,
  };
}

describe("toBacklogAppointments", () => {
  it("uses appointment_id for planAppointmentId when available", () => {
    const result = toBacklogAppointments([
      makeAppointment({ id: 1, appointment_id: 101 }),
      makeAppointment({ id: 2, appointment_id: 102 }),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.planAppointmentId)).toEqual([101, 102]);
  });

  it("falls back to id when appointment_id is null", () => {
    const result = toBacklogAppointments([
      makeAppointment({ id: 7, appointment_id: null }),
    ]);

    expect(result[0]!.planAppointmentId).toBe(7);
  });

  it("preserves all original fields on each row", () => {
    const input = makeAppointment({ id: 1, appointment_id: 101 });
    const [out] = toBacklogAppointments([input]);

    expect(out).toMatchObject(input);
    expect(out!.planAppointmentId).toBe(101);
  });

  it("returns an empty array when given an empty input", () => {
    expect(toBacklogAppointments([])).toEqual([]);
  });
});
