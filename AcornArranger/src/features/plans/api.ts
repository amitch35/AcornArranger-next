/**
 * Plan API client for Schedule Builder
 */

import type { Plan, PlanBuildOptions, ErrorResponse } from "./schemas";

type ErrorWithHint = Error & { hint?: string };

/** Prefer Postgres `message` over `details` (detail is often a short tag like `build_schedule_plan: failed`). */
function throwPlanApiError(err: ErrorResponse, fallback: string): never {
  const message = err.message ?? err.details ?? fallback;
  const error = new Error(message) as ErrorWithHint;
  if (err.hint?.trim()) {
    error.hint = err.hint;
  }
  throw error;
}

/** Message + optional DB hint for schedule/plan RPC error toasts */
export function planApiToastProps(
  err: unknown,
  fallback: string
): { message: string; description?: string } {
  if (err instanceof Error) {
    const hint =
      "hint" in err && typeof (err as ErrorWithHint).hint === "string"
        ? (err as ErrorWithHint).hint
        : undefined;
    return {
      message: err.message || fallback,
      description: hint?.trim() ? hint : undefined,
    };
  }
  return { message: fallback };
}

export async function fetchPlans(
  fromPlanDate: string,
  toPlanDate?: string
): Promise<Plan[]> {
  const params = new URLSearchParams();
  params.set("from_plan_date", fromPlanDate);
  if (toPlanDate) params.set("to_plan_date", toPlanDate);
  params.set("per_page", "100");

  const res = await fetch(`/api/plans?${params}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ErrorResponse & {
      error?: string;
    };
    throw new Error(
      body.message ?? body.error ?? body.details ?? "Failed to fetch plans"
    );
  }
  return res.json();
}

export async function buildPlan(
  planDate: string,
  options: PlanBuildOptions
): Promise<unknown> {
  const res = await fetch(`/api/plans/build/${planDate}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throwPlanApiError(data as ErrorResponse, "Build failed");
  }
  return data;
}

export async function copyPlan(planDate: string): Promise<void> {
  const res = await fetch(`/api/plans/copy/${planDate}`, { method: "POST" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throwPlanApiError(data as ErrorResponse, "Copy failed");
  }
}

export async function addPlan(planDate: string): Promise<void> {
  const res = await fetch(`/api/plans/add/${planDate}`, { method: "POST" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throwPlanApiError(data as ErrorResponse, "Add plan failed");
  }
}

export async function sendPlan(planDate: string): Promise<void> {
  const res = await fetch(`/api/plans/send/${planDate}`, { method: "POST" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throwPlanApiError(data as ErrorResponse, "Send failed");
  }
}

export async function addStaffToPlan(
  planId: number,
  userId: number
): Promise<void> {
  const res = await fetch(`/api/plans/${planId}/staff/${userId}`, {
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throwPlanApiError(data as ErrorResponse, "Add staff failed");
  }
}

export async function removeStaffFromPlan(
  planId: number,
  userId: number
): Promise<void> {
  const res = await fetch(`/api/plans/${planId}/staff/${userId}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throwPlanApiError(data as ErrorResponse, "Remove staff failed");
  }
}

export async function addAppointmentToPlan(
  planId: number,
  appointmentId: number
): Promise<void> {
  const res = await fetch(
    `/api/plans/${planId}/appointment/${appointmentId}`,
    { method: "POST" }
  );
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throwPlanApiError(data as ErrorResponse, "Add appointment failed");
  }
}

export async function removeAppointmentFromPlan(
  planId: number,
  appointmentId: number
): Promise<void> {
  const res = await fetch(
    `/api/plans/${planId}/appointment/${appointmentId}`,
    { method: "DELETE" }
  );
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throwPlanApiError(data as ErrorResponse, "Remove appointment failed");
  }
}
