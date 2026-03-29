/**
 * Plan API client for Schedule Builder
 */

import type { Plan, PlanBuildOptions, ErrorResponse } from "./schemas";

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
    const err: ErrorResponse = await res.json().catch(() => ({
      message: res.statusText,
    }));
    throw new Error(err.details ?? err.message ?? "Failed to fetch plans");
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
    const err = data as ErrorResponse;
    throw new Error(err.details ?? err.message ?? "Build failed");
  }
  return data;
}

export async function copyPlan(planDate: string): Promise<void> {
  const res = await fetch(`/api/plans/copy/${planDate}`, { method: "POST" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = data as ErrorResponse;
    throw new Error(err.details ?? err.message ?? "Copy failed");
  }
}

export async function addPlan(planDate: string): Promise<void> {
  const res = await fetch(`/api/plans/add/${planDate}`, { method: "POST" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = data as ErrorResponse;
    throw new Error(err.details ?? err.message ?? "Add plan failed");
  }
}

export async function sendPlan(planDate: string): Promise<void> {
  const res = await fetch(`/api/plans/send/${planDate}`, { method: "POST" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = data as ErrorResponse;
    throw new Error(err.details ?? err.message ?? "Send failed");
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
    const err = data as ErrorResponse;
    throw new Error(err.details ?? err.message ?? "Add staff failed");
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
    const err = data as ErrorResponse;
    throw new Error(err.details ?? err.message ?? "Remove staff failed");
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
    const err = data as ErrorResponse;
    throw new Error(err.details ?? err.message ?? "Add appointment failed");
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
    const err = data as ErrorResponse;
    throw new Error(err.details ?? err.message ?? "Remove appointment failed");
  }
}
