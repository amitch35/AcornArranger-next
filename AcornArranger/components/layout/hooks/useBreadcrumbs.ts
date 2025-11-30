import { useMemo } from "react";
import { BreadcrumbSegment, getSegmentLabel } from "../layoutConfig";

/**
 * useBreadcrumbs hook - generates breadcrumb trail from current pathname
 * 
 * Converts pathname segments into breadcrumb objects with labels and hrefs.
 * Uses layoutConfig to map segments to friendly labels.
 * 
 * @param pathname - Current pathname from usePathname()
 * @returns Array of breadcrumb segments
 * 
 * @example
 * // pathname: "/protected/appointments/123"
 * // returns: [
 * //   { label: "Dashboard", href: "/protected" },
 * //   { label: "Appointments", href: "/protected/appointments" },
 * //   { label: "123", href: "/protected/appointments/123" }
 * // ]
 */
export function useBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  return useMemo(() => {
    // Remove trailing slash and split into segments
    const segments = pathname.replace(/\/$/, "").split("/").filter(Boolean);

    // Always start with protected/dashboard
    const breadcrumbs: BreadcrumbSegment[] = [
      { label: "Dashboard", href: "/protected" },
    ];

    // Build up breadcrumbs from segments
    let currentPath = "";
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath += `/${segment}`;

      // Skip the "protected" segment itself since we already have Dashboard
      if (segment === "protected") {
        continue;
      }

      breadcrumbs.push({
        label: getSegmentLabel(segment, currentPath),
        href: currentPath,
      });
    }

    return breadcrumbs;
  }, [pathname]);
}

