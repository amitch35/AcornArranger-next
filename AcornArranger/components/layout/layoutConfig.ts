import { 
  LayoutDashboard, 
  Calendar, 
  Home, 
  Users, 
  CalendarRange,
  Settings,
  type LucideIcon
} from "lucide-react";

/**
 * Layout configuration for navigation and breadcrumbs
 * 
 * This provides navigation items and breadcrumb support.
 * Will be expanded in Task 16.4 with async resolvers and visibility predicates.
 */

export interface BreadcrumbSegment {
  label: string;
  href: string;
}

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Main navigation items for the sidebar
 */
export const navigationConfig: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/protected",
    icon: LayoutDashboard,
  },
  {
    label: "Appointments",
    href: "/protected/appointments",
    icon: Calendar,
  },
  {
    label: "Properties",
    href: "/protected/properties",
    icon: Home,
  },
  {
    label: "Staff",
    href: "/protected/staff",
    icon: Users,
  },
  {
    label: "Schedule",
    href: "/protected/schedule",
    icon: CalendarRange,
  },
  {
    label: "Settings",
    href: "/protected/settings",
    icon: Settings,
  },
];

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

