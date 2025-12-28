import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
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
 * useBreadcrumbs("/appointments")
 * // returns: [
 * //   { label: "Dashboard", href: "/dashboard" },
 * //   { label: "Appointments", href: "/appointments" }
 * // ]
 * 
 * @example
 * // Dynamic route with resolver:
 * useBreadcrumbs("/properties/123")
 * // Initially returns: [..., { label: "Loading...", href: "...", isLoading: true }]
 * // After fetch: [..., { label: "Ocean View Villa", href: "...", isLoading: false }]
 */
export function useBreadcrumbs(
  pathname: string,
  params?: Record<string, string | string[]>
): BreadcrumbSegment[] {
  // Identify all resolver-backed crumb paths and build query descriptors up front.
  const resolverCrumbs = useMemo(() => {
    const segments = pathname.replace(/\/$/, "").split("/").filter(Boolean);
    let currentPath = "";

    const items: Array<{
      path: string;
      segment: string;
      resolverParams: Record<string, string>;
      resolver: ReturnType<typeof findBreadcrumbResolver>;
    }> = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath += `/${segment}`;
      if (segment === "dashboard") continue;

      const resolver = findBreadcrumbResolver(currentPath);
      if (!resolver?.query) continue;

      items.push({
        path: currentPath,
        segment,
        resolverParams: extractParams(currentPath, resolver.pattern),
        resolver,
      });
    }

    return items;
  }, [pathname]);

  const queryResults = useQueries({
    queries: resolverCrumbs.map((item) => ({
      queryKey: item.resolver!.query!.key(item.resolverParams),
      queryFn: () => item.resolver!.query!.fn(item.resolverParams),
      enabled: true,
      // Use global QueryClient defaults (staleTime, retry, etc.)
    })),
  });

  // Build initial breadcrumbs from pathname
  const breadcrumbs = useMemo(() => {
    // Remove trailing slash and split into segments
    const segments = pathname.replace(/\/$/, "").split("/").filter(Boolean);

    // Always start with dashboard
    const crumbs: BreadcrumbSegment[] = [
      { label: "Dashboard", href: "/dashboard" },
    ];

    // Build up breadcrumbs from segments
    let currentPath = "";
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath += `/${segment}`;

      // Skip the "dashboard" segment itself since we already have the root crumb
      if (segment === "dashboard") {
        continue;
      }

      // Check if we have a resolver for this path
      const resolver = findBreadcrumbResolver(currentPath);
      
      if (resolver?.query) {
        const resolverParams = extractParams(currentPath, resolver.pattern);
        const loadingLabel =
          typeof resolver.loadingLabel === "function"
            ? resolver.loadingLabel(resolverParams)
            : resolver.loadingLabel;

        const idx = resolverCrumbs.findIndex((c) => c.path === currentPath);
        const result = idx >= 0 ? queryResults[idx] : undefined;
        const resolvedLabel =
          result?.data != null ? resolver.query.label(result.data, resolverParams) : undefined;

        crumbs.push({
          label: resolvedLabel || loadingLabel || "Loading...",
          href: currentPath,
          isLoading: Boolean(result?.isLoading && !resolvedLabel),
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
  }, [pathname, resolverCrumbs, queryResults]);

  return breadcrumbs;
}
