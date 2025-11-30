"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useBreadcrumbs } from "../hooks/useBreadcrumbs";

/**
 * Breadcrumbs component - displays hierarchical navigation path
 * 
 * Automatically generates breadcrumbs from the current route using layoutConfig.
 * Last crumb is not a link and has aria-current="page".
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const breadcrumbs = useBreadcrumbs(pathname);

  // Don't show breadcrumbs on dashboard/root
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-2 text-sm min-w-0">
      <ol className="flex items-center gap-2 min-w-0">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const isFirst = index === 0;

          return (
            <li key={crumb.href} className="flex items-center gap-2 min-w-0">
              {!isFirst && (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              {isLast ? (
                <span
                  className={cn(
                    "font-medium truncate",
                    crumb.isLoading ? "text-muted-foreground animate-pulse" : "text-foreground"
                  )}
                  aria-current="page"
                  aria-busy={crumb.isLoading}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className={cn(
                    "text-muted-foreground hover:text-foreground transition-colors truncate",
                    crumb.isLoading && "animate-pulse"
                  )}
                  aria-busy={crumb.isLoading}
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

