import { useEffect } from "react";

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  /** Key or key combination (e.g., "k", "Escape", "Meta+k") */
  key: string;
  /** Modifier keys required */
  modifiers?: {
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
  };
  /** Handler function */
  handler: (event: KeyboardEvent) => void;
  /** Optional description for documentation */
  description?: string;
  /** Whether to prevent default behavior */
  preventDefault?: boolean;
}

/**
 * useKeyboardShortcuts - Register keyboard shortcuts
 * 
 * Provides a centralized way to handle keyboard shortcuts with proper
 * modifier key support and prevention of conflicts.
 * 
 * @param shortcuts - Array of shortcut definitions
 * @param enabled - Whether shortcuts are active (default: true)
 * 
 * @example
 * useKeyboardShortcuts([
 *   {
 *     key: "k",
 *     modifiers: { meta: true },
 *     handler: () => openCommandPalette(),
 *     description: "Open command palette",
 *   },
 *   {
 *     key: "b",
 *     modifiers: { meta: true },
 *     handler: () => toggleSidebar(),
 *     description: "Toggle sidebar",
 *   },
 * ]);
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled = true
) {
  useEffect(() => {
    if (!enabled || shortcuts.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in an input
      const target = event.target as HTMLElement;
      const isInputting =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInputting) return;

      // Find matching shortcut
      const matchingShortcut = shortcuts.find((shortcut) => {
        // Check key match (case-insensitive)
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        if (!keyMatch) return false;

        // Check modifier matches
        const mods = shortcut.modifiers || {};
        const ctrlMatch = event.ctrlKey === (mods.ctrl ?? false);
        const metaMatch = event.metaKey === (mods.meta ?? false);
        const shiftMatch = event.shiftKey === (mods.shift ?? false);
        const altMatch = event.altKey === (mods.alt ?? false);

        return ctrlMatch && metaMatch && shiftMatch && altMatch;
      });

      if (matchingShortcut) {
        if (matchingShortcut.preventDefault !== false) {
          event.preventDefault();
        }
        matchingShortcut.handler(event);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcuts, enabled]);
}

/**
 * Common keyboard shortcuts used in the app
 */
export const commonShortcuts = {
  /** Meta/Cmd + K - Open command palette */
  COMMAND_PALETTE: { key: "k", modifiers: { meta: true } },
  /** Meta/Cmd + B - Toggle sidebar */
  TOGGLE_SIDEBAR: { key: "b", modifiers: { meta: true } },
  /** Escape - Close modal/menu */
  ESCAPE: { key: "Escape" },
  /** / - Focus search */
  FOCUS_SEARCH: { key: "/" },
} as const;

