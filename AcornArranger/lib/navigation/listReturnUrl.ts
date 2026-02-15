/**
 * Utilities for persisting list page URLs (with filters) in sessionStorage
 * so that detail/edit pages can navigate "Back to List" with filters preserved.
 *
 * Pattern:
 *   List page  → on navigate-away, call `saveListUrl("properties")`
 *   Detail page → "Back to List" uses `getListUrl("properties", "/dashboard/properties")`
 *   Edit page  → Cancel/Save always goes to explicit detail URL
 */

const STORAGE_PREFIX = "listReturnUrl:";

/**
 * Save the current page URL (including search params) as the return URL for this entity.
 * Call this from the list page when the user clicks "View" on a row.
 */
export function saveListUrl(entity: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      `${STORAGE_PREFIX}${entity}`,
      window.location.pathname + window.location.search
    );
  } catch {
    // sessionStorage may be unavailable (private browsing, storage full, etc.)
  }
}

/**
 * Get the stored list URL for this entity. Falls back to the provided default.
 * Call this from detail pages to build the "Back to List" link.
 */
export function getListUrl(entity: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return sessionStorage.getItem(`${STORAGE_PREFIX}${entity}`) ?? fallback;
  } catch {
    return fallback;
  }
}
