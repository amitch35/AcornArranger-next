"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useSidebarState } from "./hooks/useSidebarState";

/**
 * Props for individual content slots within the protected layout
 */
export interface ProtectedLayoutSlots {
  /** Optional header content (typically rendered by the Header component) */
  header?: React.ReactNode;
  /** Optional sidebar content (typically rendered by the Sidebar component) */
  sidebar?: React.ReactNode;
  /** Main page content */
  children: React.ReactNode;
  /** Optional page title slot */
  title?: React.ReactNode;
  /** Optional primary action buttons (e.g., "Create", "Export") */
  primaryActions?: React.ReactNode;
  /** Optional secondary action buttons */
  secondaryActions?: React.ReactNode;
  /** Optional filter controls */
  filters?: React.ReactNode;
}

/**
 * Context to share layout state and utilities with child components
 */
interface ProtectedLayoutContextValue {
  /** Whether the sidebar is currently collapsed */
  sidebarCollapsed: boolean;
  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void;
  /** Mobile sidebar open state */
  mobileSidebarOpen: boolean;
  /** Set mobile sidebar open state */
  setMobileSidebarOpen: (open: boolean) => void;
  /** Sidebar element ID for aria-controls */
  sidebarId: string;
  /** Whether user prefers reduced motion */
  prefersReducedMotion: boolean;
}

const ProtectedLayoutContext = React.createContext<
  ProtectedLayoutContextValue | undefined
>(undefined);

/**
 * Hook to access protected layout context
 */
export function useProtectedLayout() {
  const context = React.useContext(ProtectedLayoutContext);
  if (!context) {
    throw new Error(
      "useProtectedLayout must be used within ProtectedLayout"
    );
  }
  return context;
}

/**
 * ProtectedLayout - Foundational grid-based layout for authenticated pages
 *
 * Provides a responsive shell with slots for header, sidebar, and content areas.
 * Includes skip-to-content link for accessibility and theming support.
 *
 * @example
 * ```tsx
 * <ProtectedLayout
 *   header={<Header />}
 *   sidebar={<Sidebar />}
 *   title={<h1>Dashboard</h1>}
 *   primaryActions={<Button>Create</Button>}
 * >
 *   <MainContent />
 * </ProtectedLayout>
 * ```
 */
export function ProtectedLayout({
  header,
  sidebar,
  children,
  title,
  primaryActions,
  secondaryActions,
  filters,
}: ProtectedLayoutSlots) {
  // Sidebar state with SSR-safe persistence
  const { collapsed: sidebarCollapsed, toggle: toggleSidebar, prefersReducedMotion } = useSidebarState();
  
  // Mobile sidebar state (not persisted)
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  
  const SIDEBAR_ID = "app-sidebar";

  const contextValue = React.useMemo(
    () => ({
      sidebarCollapsed,
      toggleSidebar,
      mobileSidebarOpen,
      setMobileSidebarOpen,
      sidebarId: SIDEBAR_ID,
      prefersReducedMotion,
    }),
    [sidebarCollapsed, toggleSidebar, mobileSidebarOpen, prefersReducedMotion]
  );

  return (
    <ProtectedLayoutContext.Provider value={contextValue}>
      <div className="protected-layout">
        {/* Skip to main content link for keyboard navigation */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
        >
          Skip to content
        </a>

        {/* Header slot - sticky at top */}
        {header && (
          <header className="protected-layout__header">{header}</header>
        )}

        {/* Grid container for sidebar and main content */}
        <div className="protected-layout__body">
          {/* Sidebar slot - collapsible on desktop, overlay on mobile */}
          {sidebar && (
            <aside
              className={cn(
                "protected-layout__sidebar",
                sidebarCollapsed && "protected-layout__sidebar--collapsed"
              )}
            >
              {sidebar}
            </aside>
          )}

          {/* Main content area with sub-slots */}
          <main
            id="main-content"
            className="protected-layout__main"
            role="main"
          >
            {/* Page header with title and actions */}
            {(title || primaryActions || secondaryActions) && (
              <div className="protected-layout__page-header">
                {title && (
                  <div className="protected-layout__page-title">{title}</div>
                )}
                {(primaryActions || secondaryActions) && (
                  <div className="protected-layout__page-actions">
                    {secondaryActions && (
                      <div className="protected-layout__page-actions--secondary">
                        {secondaryActions}
                      </div>
                    )}
                    {primaryActions && (
                      <div className="protected-layout__page-actions--primary">
                        {primaryActions}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Optional filters section */}
            {filters && (
              <div className="protected-layout__filters">{filters}</div>
            )}

            {/* Main content body */}
            <div className="protected-layout__content">{children}</div>
          </main>
        </div>

        {/* Portal mount points for overlays */}
        <div id="portal-modals" />
        <div id="portal-toasts" />
      </div>
    </ProtectedLayoutContext.Provider>
  );
}

/**
 * Wrapper component for pages using ProtectedLayout
 * Simplifies usage by providing common layout structure
 */
export function PageContent({
  title,
  primaryActions,
  secondaryActions,
  filters,
  children,
  className,
}: {
  title?: React.ReactNode;
  primaryActions?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  filters?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Page header */}
      {(title || primaryActions || secondaryActions) && (
        <div className="flex items-center justify-between gap-4">
          {title && <div className="flex-1">{title}</div>}
          {(primaryActions || secondaryActions) && (
            <div className="flex items-center gap-2">
              {secondaryActions}
              {primaryActions}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      {filters && <div>{filters}</div>}

      {/* Main content */}
      <div>{children}</div>
    </div>
  );
}

