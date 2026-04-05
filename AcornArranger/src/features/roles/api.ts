import type { RoleUpdatePayload } from "./schemas";

export type RoleListItem = {
  id: number;
  title: string | null;
  description: string | null;
  priority: number;
  can_lead_team: boolean;
  can_clean: boolean;
};

type RolesListResponse = {
  items: RoleListItem[];
  total: number;
};

/**
 * Fetch roles for the settings page (priority order, stable tie-break by title).
 */
export async function fetchRolesForSettings(): Promise<RoleListItem[]> {
  const params = new URLSearchParams({
    pageSize: "500",
    page: "1",
  });
  const res = await fetch(`/api/roles?${params.toString()}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load roles");
  }
  const data: RolesListResponse = await res.json();
  return data.items ?? [];
}

/**
 * Update a role (priority and/or capability flags).
 */
export async function updateRole(
  id: number,
  payload: RoleUpdatePayload
): Promise<RoleListItem> {
  const res = await fetch(`/api/roles/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to update role ${id}`);
  }
  return res.json();
}
