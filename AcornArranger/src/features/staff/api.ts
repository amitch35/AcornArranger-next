import type { StaffDetailResponse } from "./schemas";

export function getStaffDisplayName(staff: {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const direct = staff?.name?.trim();
  if (direct) return direct;

  const computed = `${staff?.first_name ?? ""} ${staff?.last_name ?? ""}`.trim();
  return computed || "";
}

export async function fetchStaffDetail(userId: string): Promise<StaffDetailResponse> {
  if (!userId) {
    throw new Error("Missing userId");
  }

  // NOTE: No manual response caching here.
  // React Query (QueryClient) is the single source of truth for caching/staleness.
  const res = await fetch(`/api/staff/${encodeURIComponent(userId)}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: "Failed to load staff" }));
    throw new Error(errorData.error || "Failed to load staff");
  }

  return (await res.json()) as StaffDetailResponse;
}

