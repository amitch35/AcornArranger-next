/**
 * Layout configuration for navigation and breadcrumbs
 * 
 * This is a basic implementation that will be expanded in Task 16.4.
 * For now, provides minimal breadcrumb support for common routes.
 */

export interface BreadcrumbSegment {
  label: string;
  href: string;
}

/**
 * Basic breadcrumb mapping for common routes
 * Will be expanded to support dynamic routes and async resolvers in Task 16.4
 */
export const breadcrumbMap: Record<string, string> = {
  "/protected": "Dashboard",
  "/protected/appointments": "Appointments",
  "/protected/properties": "Properties",
  "/protected/staff": "Staff",
  "/protected/schedule": "Schedule",
  "/protected/settings": "Settings",
};

/**
 * Get breadcrumb label for a path segment
 * Falls back to title-case if not found in map
 */
export function getSegmentLabel(segment: string, fullPath: string): string {
  // Check if full path exists in map
  if (breadcrumbMap[fullPath]) {
    return breadcrumbMap[fullPath];
  }

  // Fall back to title-case
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

