import type { PropertyRow } from "./schemas";

/**
 * Fetch a single property by ID
 */
export async function fetchPropertyDetail(id: string | number): Promise<PropertyRow> {
  const res = await fetch(`/api/properties/${id}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch property ${id}`);
  }
  return res.json();
}

/**
 * Update property settings (estimated_cleaning_mins and double_unit)
 */
export async function updatePropertySettings(
  id: string | number,
  payload: {
    estimated_cleaning_mins?: number | null;
    double_unit?: number[] | null;
  }
): Promise<PropertyRow> {
  const res = await fetch(`/api/properties/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to update property ${id}`);
  }
  
  return res.json();
}
