import { describe, it, expect } from "vitest";
import {
  PLAN_BUILD_DEFAULTS,
  ROUTING_TYPE_LABELS,
  type PlanBuildOptions,
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
      });
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
