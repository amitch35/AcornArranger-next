import { useState, useEffect, useMemo } from "react";
import { 
  BreadcrumbSegment, 
  breadcrumbMap,
  findBreadcrumbResolver,
  extractParams,
  getSegmentLabel 
} from "../layoutConfig";

/**
 * useBreadcrumbs hook - generates breadcrumb trail from current pathname
 * 
 * Features:
 * - Converts pathname segments into breadcrumb objects
 * - Uses layoutConfig for static labels
 * - Supports async resolvers for dynamic segments (e.g., property names)
 * - Provides loading state for async breadcrumbs
 * 
 * @param pathname - Current pathname from usePathname()
 * @param params - Optional route params from useParams()
 * @returns Array of breadcrumb segments
 * 
 * @example
 * // Static route:
 * useBreadcrumbs("/protected/appointments")
 * // returns: [
 * //   { label: "Dashboard", href: "/protected" },
 * //   { label: "Appointments", href: "/protected/appointments" }
 * // ]
 * 
 * @example
 * // Dynamic route with resolver:
 * useBreadcrumbs("/protected/properties/123")
 * // Initially returns: [..., { label: "Loading...", href: "...", isLoading: true }]
 * // After fetch: [..., { label: "Ocean View Villa", href: "...", isLoading: false }]
 */
export function useBreadcrumbs(
  pathname: string,
  params?: Record<string, string | string[]>
): BreadcrumbSegment[] {
  // State for async-resolved titles
  const [resolvedTitles, setResolvedTitles] = useState<
    Record<string, string>
  >({});
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  // Build initial breadcrumbs from pathname
  const breadcrumbs = useMemo(() => {
    // Remove trailing slash and split into segments
    const segments = pathname.replace(/\/$/, "").split("/").filter(Boolean);

    // Always start with protected/dashboard
    const crumbs: BreadcrumbSegment[] = [
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

      // Check if we have a resolver for this path
      const resolver = findBreadcrumbResolver(currentPath);
      
      if (resolver) {
        // We have an async resolver
        const isLoading = loadingPaths.has(currentPath);
        const resolvedLabel = resolvedTitles[currentPath];

        crumbs.push({
          label: resolvedLabel || resolver.loadingLabel || "Loading...",
          href: currentPath,
          isLoading: isLoading || !resolvedLabel,
        });
      } else {
        // Use static mapping or title-case
        crumbs.push({
          label: getSegmentLabel(segment, currentPath),
          href: currentPath,
        });
      }
    }

    return crumbs;
  }, [pathname, resolvedTitles, loadingPaths]);

  // Resolve async titles
  useEffect(() => {
    const segments = pathname.replace(/\/$/, "").split("/").filter(Boolean);
    let currentPath = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath += `/${segment}`;

      if (segment === "protected") continue;

      const resolver = findBreadcrumbResolver(currentPath);
      
      if (resolver && !resolvedTitles[currentPath]) {
        const pathToResolve = currentPath;
        
        setLoadingPaths((prev) => new Set(prev).add(pathToResolve));

        const resolverParams = extractParams(pathToResolve, resolver.pattern);
        
        resolver
          .resolve(resolverParams)
          .then((title) => {
            setResolvedTitles((prev) => ({
              ...prev,
              [pathToResolve]: title,
            }));
            setLoadingPaths((prev) => {
              const next = new Set(prev);
              next.delete(pathToResolve);
              return next;
            });
          })
          .catch((error) => {
            console.error(
              `Failed to resolve breadcrumb for ${pathToResolve}:`,
              error
            );
            // Fallback to segment on error
            setResolvedTitles((prev) => ({
              ...prev,
              [pathToResolve]: getSegmentLabel(
                pathToResolve.split("/").pop() || "",
                pathToResolve
              ),
            }));
            setLoadingPaths((prev) => {
              const next = new Set(prev);
              next.delete(pathToResolve);
              return next;
            });
          });
      }
    }
  }, [pathname, resolvedTitles]);

  return breadcrumbs;
}
