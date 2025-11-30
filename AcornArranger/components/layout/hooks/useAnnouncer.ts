import { useEffect, useRef } from "react";

/**
 * useAnnouncer - Announces messages to screen readers
 * 
 * Creates an ARIA live region for dynamic announcements.
 * Useful for notifying screen reader users of state changes
 * that aren't immediately obvious (e.g., "Menu opened", "Loading complete").
 * 
 * @param message - Message to announce
 * @param politeness - "polite" (default) or "assertive"
 * 
 * @example
 * const announce = useAnnouncer();
 * announce("Menu opened");
 */
export function useAnnouncer() {
  const announcerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create live region if it doesn't exist
    if (!announcerRef.current) {
      const announcer = document.createElement("div");
      announcer.setAttribute("role", "status");
      announcer.setAttribute("aria-live", "polite");
      announcer.setAttribute("aria-atomic", "true");
      announcer.className = "sr-only";
      document.body.appendChild(announcer);
      announcerRef.current = announcer;
    }

    return () => {
      if (announcerRef.current && document.body.contains(announcerRef.current)) {
        document.body.removeChild(announcerRef.current);
      }
      announcerRef.current = null;
    };
  }, []);

  const announce = (
    message: string,
    politeness: "polite" | "assertive" = "polite"
  ) => {
    if (!announcerRef.current) return;

    const announcer = announcerRef.current;
    announcer.setAttribute("aria-live", politeness);
    
    // Clear and set message with a small delay to ensure screen readers pick it up
    announcer.textContent = "";
    setTimeout(() => {
      announcer.textContent = message;
    }, 100);
  };

  return announce;
}

