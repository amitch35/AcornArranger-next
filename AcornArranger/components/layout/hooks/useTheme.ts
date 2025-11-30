import { useState, useEffect, useCallback } from "react";

/**
 * Available theme options
 */
export type Theme = "light" | "dark" | "system";

/**
 * Resolved theme (system resolves to light or dark)
 */
export type ResolvedTheme = "light" | "dark";

/**
 * Return value from useTheme hook
 */
interface ThemeState {
  /** Current theme setting */
  theme: Theme;
  /** Resolved theme (system → light/dark) */
  resolvedTheme: ResolvedTheme;
  /** Set theme directly */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark */
  toggleTheme: () => void;
}

/**
 * useTheme - Theme management with system preference detection
 * 
 * Manages application theme with:
 * - Light, dark, and system modes
 * - localStorage persistence
 * - System preference detection and updates
 * - SSR-safe initialization
 * - data-theme attribute management
 * 
 * @returns Theme state and controls
 * 
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { theme, resolvedTheme, toggleTheme } = useTheme();
 *   
 *   return (
 *     <button onClick={toggleTheme}>
 *       {resolvedTheme === "dark" ? "🌙" : "☀️"}
 *     </button>
 *   );
 * }
 * ```
 */
export function useTheme(): ThemeState {
  const STORAGE_KEY = "acorn-arranger-theme";
  
  // Default to system on server and initial client render
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");

  // Detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    // Set initial system theme
    setSystemTheme(mediaQuery.matches ? "dark" : "light");

    // Listen for system theme changes
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  // Hydrate theme from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && (stored === "light" || stored === "dark" || stored === "system")) {
        setThemeState(stored as Theme);
      }
    } catch (error) {
      console.warn("Failed to restore theme from localStorage:", error);
    }
  }, []);

  // Calculate resolved theme
  const resolvedTheme: ResolvedTheme =
    theme === "system" ? systemTheme : theme;

  // Update document data-theme attribute when resolved theme changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    
    // Also update class for Tailwind dark mode (if using class strategy)
    if (resolvedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [resolvedTheme]);

  // Persist theme changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      console.warn("Failed to persist theme to localStorage:", error);
    }
  }, [theme]);

  // Set theme callback
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  // Toggle between light and dark (system becomes light)
  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      if (current === "dark") return "light";
      if (current === "light") return "dark";
      // System mode: toggle based on current system theme
      return systemTheme === "dark" ? "light" : "dark";
    });
  }, [systemTheme]);

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  };
}

