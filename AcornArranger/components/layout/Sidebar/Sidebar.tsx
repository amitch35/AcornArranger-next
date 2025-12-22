"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useProtectedLayout } from "../ProtectedLayout";
import { NavItem } from "./NavItem";
import { navigationConfig, getVisibleNavItems, isPathActive, type UserContext } from "../layoutConfig";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useAnnouncer } from "../hooks/useAnnouncer";

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
  const { sidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen } = useProtectedLayout();
  const focusTrapRef = useFocusTrap(mobileSidebarOpen);
  const announce = useAnnouncer();
  // Mobile overlay should always render expanded (icons + labels), regardless of
  // the persisted desktop "rail collapsed" preference.
  const effectiveCollapsed = sidebarCollapsed && !mobileSidebarOpen;

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
    // When navigating to a new route, close the mobile overlay.
    // IMPORTANT: Don't depend on `mobileSidebarOpen` here, otherwise opening the
    // menu will immediately trigger this effect and close it.
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  // Close mobile sidebar on Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileSidebarOpen) {
        setMobileSidebarOpen(false);
        announce("Menu closed");
      }
    };

    if (mobileSidebarOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when mobile menu is open
      document.body.style.overflow = "hidden";
      announce("Menu opened");
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [mobileSidebarOpen, setMobileSidebarOpen, announce]);

  // Announce sidebar collapse state changes on desktop
  React.useEffect(() => {
    // Only announce on desktop (avoid duplicate mobile announcements)
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (isDesktop) {
      announce(sidebarCollapsed ? "Sidebar collapsed" : "Sidebar expanded");
    }
  }, [sidebarCollapsed, announce]);

  // Apply focus trap ref only when mobile sidebar is open
  return (
    <nav
      ref={mobileSidebarOpen ? focusTrapRef : undefined}
      id="app-sidebar"
      aria-label="Main navigation"
      className="flex flex-col h-full"
      role={mobileSidebarOpen ? "dialog" : undefined}
      aria-modal={mobileSidebarOpen ? "true" : undefined}
    >
      {/* Mobile close button */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b">
        <span className="font-semibold">Menu</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setMobileSidebarOpen(false);
            announce("Menu closed");
          }}
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
            collapsed={effectiveCollapsed}
            active={isPathActive(pathname, item.href)}
          />
        ))}
      </div>
    </nav>
  );
}

