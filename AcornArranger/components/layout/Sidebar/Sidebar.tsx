"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useProtectedLayout } from "../ProtectedLayout";
import { NavItem } from "./NavItem";
import { navigationConfig, getVisibleNavItems, isPathActive, type UserContext } from "../layoutConfig";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Sidebar component - Collapsible navigation for protected pages
 * 
 * Features:
 * - Desktop: Collapsible rail mode (expanded/collapsed)
 * - Mobile: Overlay with backdrop
 * - Active state detection via pathname
 * - Grouped navigation items
 * - Keyboard accessible
 */
export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed } = useProtectedLayout();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // TODO: Get real user context from auth when available
  // For now, assume all users are authenticated
  const userContext: UserContext = React.useMemo(
    () => ({
      isAuthenticated: true,
      // Add roles here when auth system provides them
    }),
    []
  );

  // Filter navigation items by visibility
  const visibleNavItems = React.useMemo(
    () => getVisibleNavItems(navigationConfig, userContext),
    [userContext]
  );

  // Close mobile sidebar when route changes
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile sidebar on Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    };

    if (mobileOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when mobile menu is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const sidebarContent = (
    <nav
      id="app-sidebar"
      aria-label="Main navigation"
      className="flex flex-col h-full"
    >
      {/* Mobile close button */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b">
        <span className="font-semibold">Menu</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Navigation items */}
      <div className="flex-1 overflow-y-auto py-4">
        {visibleNavItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            collapsed={sidebarCollapsed}
            active={isPathActive(pathname, item.href)}
          />
        ))}
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:block border-r bg-background transition-all duration-200",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          
          {/* Sidebar */}
          <aside
            className="fixed inset-y-0 left-0 w-64 bg-background border-r z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}

