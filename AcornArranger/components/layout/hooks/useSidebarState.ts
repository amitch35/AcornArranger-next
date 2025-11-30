import { useState, useEffect, useCallback } from "react";

/**
 * Configuration for sidebar state persistence
 */
interface SidebarStateConfig {
  /** localStorage key for persistence */
  storageKey?: string;
  /** Default collapsed state (server-side and initial client render) */
  defaultCollapsed?: boolean;
}

/**
 * Return value from useSidebarState hook
 */
interface SidebarState {
  /** Whether sidebar is collapsed */
  collapsed: boolean;
  /** Toggle sidebar collapsed state */
  toggle: () => void;
  /** Set collapsed state directly */
  setCollapsed: (collapsed: boolean) => void;
  /** Whether reduced motion is preferred */
  prefersReducedMotion: boolean;
}

/**
 * useSidebarState - SSR-safe sidebar state management with persistence
 * 
 * Manages sidebar collapsed/expanded state with:
 * - SSR-safe localStorage persistence
 * - Default expanded state on server
 * - Hydration-safe initialization
 * - prefers-reduced-motion detection
 * 
 * @param config - Optional configuration
 * @returns Sidebar state and controls
 * 
 * @example
 * ```tsx
 * function Layout() {
 *   const { collapsed, toggle, prefersReducedMotion } = useSidebarState();
 *   
 *   return (
 *     <aside className={cn(
 *       "transition-all",
 *       !prefersReducedMotion && "duration-200",
 *       collapsed ? "w-16" : "w-64"
 *     )}>
 *       <button onClick={toggle}>Toggle</button>
 *     </aside>
 *   );
 * }
 * ```
 */
export function useSidebarState(
  config: SidebarStateConfig = {}
): SidebarState {
  const {
    storageKey = "acorn-arranger-sidebar-collapsed",
    defaultCollapsed = false,
  } = config;

  // State defaults to false (expanded) for SSR and initial client render
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  
  // Track if user prefers reduced motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Hydrate state from localStorage on client mount
  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes to reduced motion preference
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener("change", handleChange);

    // Restore sidebar state from localStorage
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        setCollapsed(JSON.parse(stored));
      }
    } catch (error) {
      console.warn("Failed to restore sidebar state from localStorage:", error);
    }

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [storageKey]);

  // Persist state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(collapsed));
    } catch (error) {
      console.warn("Failed to persist sidebar state to localStorage:", error);
    }
  }, [collapsed, storageKey]);

  // Toggle callback
  const toggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return {
    collapsed,
    toggle,
    setCollapsed,
    prefersReducedMotion,
  };
}

