import type { AppointmentDetailResponse } from "./schemas";

/**
 * Fetch a single appointment detail by ID.
 * Used by the detail page with React Query.
 */
export async function fetchAppointmentDetail(
  id: string
): Promise<AppointmentDetailResponse> {
  if (!id) {
    throw new Error("Missing appointment id");
  }

  const res = await fetch(`/api/appointments/${encodeURIComponent(id)}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const errorData = await res
      .json()
      .catch(() => ({ error: "Failed to load appointment" }));
    throw new Error(errorData.error || "Failed to load appointment");
  }

  return (await res.json()) as AppointmentDetailResponse;
}
