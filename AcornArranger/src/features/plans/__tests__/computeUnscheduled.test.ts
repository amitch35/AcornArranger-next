import { describe, it, expect } from "vitest";
import { computeUnscheduled } from "../components/BacklogPanel";
import type { Plan } from "../schemas";
import type { AppointmentRow } from "@/src/features/appointments/schemas";

function makeAppointment(
  overrides: Partial<AppointmentRow> & { id: number; appointment_id?: number }
): AppointmentRow {
  return {
    id: overrides.id,
    appointment_id: overrides.appointment_id ?? overrides.id,
    departure_time: null,
    arrival_time: null,
    next_arrival_time: null,
    turn_around: null,
    cancelled_date: null,
    created_at: "2025-01-01T00:00:00Z",
    status: { status_id: 1, status: "Confirmed" },
    property_info: { properties_id: 100, property_name: "Test" },
    service_info: { service_id: 21942, name: "Clean" },
    staff: [],
    ...overrides,
  };
}

function makePlan(planId: number, team: number, appointmentIds: number[]): Plan {
  return {
    plan_id: planId,
    plan_date: "2025-01-15",
    team,
    staff: [],
    appointments: appointmentIds.map((aid) => ({
      appointment_id: aid,
      sent_to_rc: null,
      appointment_info: {
        appointment_id: aid,
        arrival_time: null,
        service_time: null,
        next_arrival_time: null,
        turn_around: null,
        cancelled_date: null,
        property_info: { properties_id: 100, property_name: "Test" },
        service: { service_id: 21942, service_name: "Clean" },
        status: { status_id: 1, status: "Confirmed" },
      },
    })),
  };
}

describe("computeUnscheduled", () => {
  it("excludes appointments that are in any plan", () => {
    const appointments = [
      makeAppointment({ id: 1, appointment_id: 101 }),
      makeAppointment({ id: 2, appointment_id: 102 }),
      makeAppointment({ id: 3, appointment_id: 103 }),
    ];
    const plans = [makePlan(1, 1, [101])];

    const result = computeUnscheduled(appointments, plans, []);

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.planAppointmentId)).toEqual([102, 103]);
  });

  it("excludes cancelled appointments (status 5)", () => {
    const appointments = [
      makeAppointment({
        id: 1,
        appointment_id: 101,
        status: { status_id: 5, status: "Cancelled" },
      }),
    ];
    const plans: Plan[] = [];

    const result = computeUnscheduled(appointments, plans, []);

    expect(result).toHaveLength(0);
  });

  it("filters by service when serviceFilter is set", () => {
    const appointments = [
      makeAppointment({
        id: 1,
        appointment_id: 101,
        service_info: { service_id: 21942, name: "Clean" },
      }),
      makeAppointment({
        id: 2,
        appointment_id: 102,
        service_info: { service_id: 99999, name: "Other" },
      }),
    ];
    const plans: Plan[] = [];

    const result = computeUnscheduled(appointments, plans, ["21942"]);

    expect(result).toHaveLength(1);
    expect(result[0]!.planAppointmentId).toBe(101);
  });

  it("returns empty array when there are no appointments", () => {
    const result = computeUnscheduled([], [makePlan(1, 1, [101])], []);
    expect(result).toHaveLength(0);
  });

  it("returns all appointments when there are no plans", () => {
    const appointments = [
      makeAppointment({ id: 1, appointment_id: 101 }),
      makeAppointment({ id: 2, appointment_id: 102 }),
    ];
    const result = computeUnscheduled(appointments, [], []);
    expect(result).toHaveLength(2);
  });

  it("excludes an appointment that appears on multiple plans (already scheduled)", () => {
    const appointments = [
      makeAppointment({ id: 1, appointment_id: 101 }),
      makeAppointment({ id: 2, appointment_id: 102 }),
    ];
    const plans = [
      makePlan(1, 1, [101]),
      makePlan(2, 2, [101]),
    ];

    const result = computeUnscheduled(appointments, plans, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.planAppointmentId).toBe(102);
  });

  it("does not exclude appointments with cancelled_date if status_id is not 5", () => {
    const appointments = [
      makeAppointment({
        id: 1,
        appointment_id: 101,
        status: { status_id: 1, status: "Confirmed" },
        cancelled_date: "2025-01-10T00:00:00Z",
      }),
    ];
    const result = computeUnscheduled(appointments, [], []);
    expect(result).toHaveLength(1);
  });

  it("passes through unconfirmed appointments (status_id 2)", () => {
    const appointments = [
      makeAppointment({
        id: 1,
        appointment_id: 101,
        status: { status_id: 2, status: "Unconfirmed" },
      }),
    ];
    const result = computeUnscheduled(appointments, [], []);
    expect(result).toHaveLength(1);
  });

  it("uses appointment_id when available, else id for planAppointmentId", () => {
    const appointments = [
      makeAppointment({ id: 1, appointment_id: 101 }),
      makeAppointment({ id: 2, appointment_id: null }),
    ];
    const plans = [makePlan(1, 1, [101])];

    const result = computeUnscheduled(appointments, plans, []);

    expect(result).toHaveLength(1);
    expect(result[0]!.planAppointmentId).toBe(2);
  });
});
