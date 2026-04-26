import { describe, it, expect } from "vitest";
import {
  PLAN_BUILD_DEFAULTS,
  ROUTING_TYPE_LABELS,
  isPlanSent,
  type PlanBuildOptions,
  type Plan,
  type PlanAppointment,
} from "../schemas";

describe("Plan Schemas", () => {
  describe("PLAN_BUILD_DEFAULTS", () => {
    it("matches legacy PlanBuildOptions shape", () => {
      expect(PLAN_BUILD_DEFAULTS).toMatchObject<PlanBuildOptions>({
        available_staff: [],
        services: [21942, 23044],
        omissions: [],
        routing_type: 1,
        cleaning_window: 6.0,
        max_hours: 6.5,
        engine: "vrptw",
        property_affinity_lookback_days: 180,
        pairing_affinity_lookback_days: 90,
      });
    });

    it("defaults engine to the new VRPTW sidecar", () => {
      expect(PLAN_BUILD_DEFAULTS.engine).toBe("vrptw");
    });

    it("has property affinity lookback default 180 days", () => {
      expect(PLAN_BUILD_DEFAULTS.property_affinity_lookback_days).toBe(180);
    });

    it("has pairing affinity lookback default 90 days", () => {
      expect(PLAN_BUILD_DEFAULTS.pairing_affinity_lookback_days).toBe(90);
    });

    it("has services default [21942, 23044]", () => {
      expect(PLAN_BUILD_DEFAULTS.services).toEqual([21942, 23044]);
    });

    it("has cleaning_window default 6.0", () => {
      expect(PLAN_BUILD_DEFAULTS.cleaning_window).toBe(6.0);
    });

    it("has max_hours default 6.5", () => {
      expect(PLAN_BUILD_DEFAULTS.max_hours).toBe(6.5);
    });

    it("has routing_type default 1", () => {
      expect(PLAN_BUILD_DEFAULTS.routing_type).toBe(1);
    });

    it("has target_staff_count undefined by default", () => {
      expect(PLAN_BUILD_DEFAULTS.target_staff_count).toBeUndefined();
    });

    it("has num_teams undefined by default (auto-derive)", () => {
      expect(PLAN_BUILD_DEFAULTS.num_teams).toBeUndefined();
    });

    it("has target_team_size undefined by default (auto-derive)", () => {
      expect(PLAN_BUILD_DEFAULTS.target_team_size).toBeUndefined();
    });
  });

  describe("isPlanSent", () => {
    function makeApptInfo(id: number): PlanAppointment["appointment_info"] {
      return {
        appointment_id: id,
        arrival_time: null,
        service_time: null,
        next_arrival_time: null,
        turn_around: null,
        cancelled_date: null,
        property_info: { properties_id: 100, property_name: "Test" },
        service: { service_id: 21942, service_name: "Clean" },
        status: { status_id: 1, status: "Confirmed" },
      };
    }

    function makePlan(appointmentOverrides: Partial<PlanAppointment>[]): Plan {
      return {
        plan_id: 1,
        plan_date: "2025-01-15",
        team: 1,
        staff: [],
        appointments: appointmentOverrides.map((o, i) => ({
          appointment_id: 100 + i,
          sent_to_rc: null,
          appointment_info: makeApptInfo(100 + i),
          ...o,
        })),
      };
    }

    it("returns false for a plan with no appointments", () => {
      expect(isPlanSent(makePlan([]))).toBe(false);
    });

    it("returns false when all appointments have sent_to_rc null", () => {
      const plan = makePlan([
        { sent_to_rc: null },
        { sent_to_rc: null },
      ]);
      expect(isPlanSent(plan)).toBe(false);
    });

    it("returns true when at least one appointment has sent_to_rc set", () => {
      const plan = makePlan([
        { sent_to_rc: null },
        { sent_to_rc: "2025-01-15T10:00:00Z" },
      ]);
      expect(isPlanSent(plan)).toBe(true);
    });

    it("returns true when all appointments have sent_to_rc set", () => {
      const plan = makePlan([
        { sent_to_rc: "2025-01-15T09:00:00Z" },
        { sent_to_rc: "2025-01-15T10:00:00Z" },
      ]);
      expect(isPlanSent(plan)).toBe(true);
    });

    it("returns true when the first appointment is sent but later ones are not", () => {
      const plan = makePlan([
        { sent_to_rc: "2025-01-15T09:00:00Z" },
        { sent_to_rc: null },
        { sent_to_rc: null },
      ]);
      expect(isPlanSent(plan)).toBe(true);
    });
  });

  describe("ROUTING_TYPE_LABELS", () => {
    it("has labels for routing types 1-5", () => {
      expect(ROUTING_TYPE_LABELS[1]).toBeDefined();
      expect(ROUTING_TYPE_LABELS[2]).toBeDefined();
      expect(ROUTING_TYPE_LABELS[3]).toBeDefined();
      expect(ROUTING_TYPE_LABELS[4]).toBeDefined();
      expect(ROUTING_TYPE_LABELS[5]).toBeDefined();
    });

    it("includes recommended option for type 1", () => {
      expect(ROUTING_TYPE_LABELS[1]).toContain("Recommended");
    });
  });
});
