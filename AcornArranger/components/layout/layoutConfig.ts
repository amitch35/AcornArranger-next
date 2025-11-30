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
 * Provides centralized config for:
 * - Navigation items with icons and visibility rules
 * - Breadcrumb generation with async title resolvers
 * - Type-safe and easily extensible
 */

// ============================================================================
// Types
// ============================================================================

export interface BreadcrumbSegment {
  label: string;
  href: string;
  isLoading?: boolean;
}

/**
 * User context for visibility predicates
 * Extended as auth/role system evolves
 */
export interface UserContext {
  email?: string;
  roles?: string[];
  isAuthenticated: boolean;
}

/**
 * Navigation item configuration
 */
export interface NavigationItem {
  /** Display label */
  label: string;
  /** Navigation href */
  href: string;
  /** Icon component from lucide-react */
  icon: LucideIcon;
  /** Optional visibility predicate (user) => boolean */
  visible?: (user: UserContext) => boolean;
  /** Optional group name for organizing nav items */
  group?: string;
  /** Optional nested child items */
  children?: NavigationItem[];
}

/**
 * Breadcrumb resolver for dynamic route segments
 */
export interface BreadcrumbResolver {
  /** Route pattern to match (e.g., "/protected/properties/:id") */
  pattern: RegExp;
  /** Async function to resolve the title */
  resolve: (params: Record<string, string>) => Promise<string>;
  /** Optional loading fallback */
  loadingLabel?: string;
}

// ============================================================================
// Navigation Configuration
// ============================================================================

/**
 * Main navigation items for the sidebar
 * 
 * To add a new item:
 * 1. Add entry to this array
 * 2. Add corresponding breadcrumb mapping below
 * 3. Optional: Add visibility predicate if role-restricted
 */
export const navigationConfig: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    group: "main",
  },
  {
    label: "Appointments",
    href: "/appointments",
    icon: Calendar,
    group: "main",
    visible: (user) => user.isAuthenticated,
  },
  {
    label: "Properties",
    href: "/properties",
    icon: Home,
    group: "main",
    visible: (user) => user.isAuthenticated,
  },
  {
    label: "Staff",
    href: "/staff",
    icon: Users,
    group: "main",
    visible: (user) => user.isAuthenticated,
  },
  {
    label: "Schedule",
    href: "/schedule",
    icon: CalendarRange,
    group: "main",
    visible: (user) => user.isAuthenticated,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    group: "settings",
    visible: (user) => user.isAuthenticated,
  },
];

/**
 * Filter navigation items by visibility predicate
 */
export function getVisibleNavItems(
  items: NavigationItem[],
  user: UserContext
): NavigationItem[] {
  return items.filter((item) => {
    // If no visibility predicate, item is always visible
    if (!item.visible) return true;
    // Otherwise check predicate
    return item.visible(user);
  });
}

// ============================================================================
// Breadcrumb Configuration
// ============================================================================

/**
 * Static breadcrumb mapping for common routes
 */
export const breadcrumbMap: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/appointments": "Appointments",
  "/properties": "Properties",
  "/staff": "Staff",
  "/schedule": "Schedule",
  "/settings": "Settings",
};

/**
 * Async breadcrumb resolvers for dynamic routes
 * 
 * These fetch titles for dynamic segments (e.g., property names, staff names)
 * 
 * To add a resolver:
 * 1. Add pattern that matches your route
 * 2. Implement resolve function to fetch title
 * 3. Optional: provide loadingLabel fallback
 */
export const breadcrumbResolvers: BreadcrumbResolver[] = [
  // Example: Resolve property names for /properties/:id
  {
    pattern: /^\/properties\/([^\/]+)$/,
    resolve: async (params) => {
      // In a real implementation, fetch from API:
      // const response = await fetch(`/api/properties/${params.id}`);
      // const data = await response.json();
      // return data.property_name;
      
      // For now, return a formatted ID
      return `Property ${params.id}`;
    },
    loadingLabel: "Loading...",
  },
  
  // Example: Resolve staff names for /staff/:id
  {
    pattern: /^\/staff\/([^\/]+)$/,
    resolve: async (params) => {
      return `Staff ${params.id}`;
    },
    loadingLabel: "Loading...",
  },
  
  // Example: Resolve appointment details for /appointments/:id
  {
    pattern: /^\/appointments\/([^\/]+)$/,
    resolve: async (params) => {
      return `Appointment ${params.id}`;
    },
    loadingLabel: "Loading...",
  },
];

/**
 * Find resolver for a given path
 */
export function findBreadcrumbResolver(
  path: string
): BreadcrumbResolver | undefined {
  return breadcrumbResolvers.find((resolver) => resolver.pattern.test(path));
}

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

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if a path matches a navigation item (exact or prefix match)
 * Normalizes trailing slashes before comparison
 */
export function isPathActive(currentPath: string, itemHref: string): boolean {
  // Normalize trailing slashes
  const normalizedCurrent = currentPath.replace(/\/$/, "");
  const normalizedItem = itemHref.replace(/\/$/, "");
  
  // Exact match
  if (normalizedCurrent === normalizedItem) return true;
  
  // Prefix match (but not for root)
  if (normalizedItem !== "/dashboard" && normalizedCurrent.startsWith(normalizedItem + "/")) {
    return true;
  }
  
  return false;
}

/**
 * Extract params from a path using a pattern
 * 
 * @example
 * extractParams("/protected/properties/123", /^\/protected\/properties\/([^\/]+)$/)
 * // returns: { "0": "123", id: "123" }
 */
export function extractParams(
  path: string,
  pattern: RegExp
): Record<string, string> {
  const match = path.match(pattern);
  if (!match) return {};

  const params: Record<string, string> = {};
  
  // Add numbered captures
  match.slice(1).forEach((value, index) => {
    params[index.toString()] = value;
  });

  // Add named captures if available (these take precedence)
  if (match.groups) {
    Object.assign(params, match.groups);
  } else if (match[1]) {
    // Common ID capture (first group is typically ID) - only if no named groups
    params.id = match[1];
  }

  return params;
}
