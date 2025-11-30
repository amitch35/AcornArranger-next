import { useEffect, useRef } from "react";

/**
 * useFocusTrap - Traps focus within a container element
 * 
 * Used for modal dialogs and overlays to ensure keyboard users
 * cannot tab out of the modal while it's open.
 * 
 * @param enabled - Whether the focus trap is active
 * @returns Ref to attach to the container element
 * 
 * @example
 * const trapRef = useFocusTrap(isOpen);
 * <div ref={trapRef}>...</div>
 */
export function useFocusTrap(enabled: boolean) {
  const containerRef = useRef<HTMLElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;

    // Store the previously focused element to return focus later
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Get all focusable elements within container
    const getFocusableElements = (): HTMLElement[] => {
      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');

      return Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelectors)
      ).filter((el) => {
        // Filter out hidden elements
        return el.offsetParent !== null;
      });
    };

    // Focus first focusable element
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    // Handle Tab key to trap focus
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Shift + Tab
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      }
      // Tab
      else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);

    // Cleanup: return focus to previous element
    return () => {
      container.removeEventListener('keydown', handleTabKey);
      
      if (previousActiveElement.current) {
        // Small delay to ensure DOM updates are complete
        setTimeout(() => {
          previousActiveElement.current?.focus();
        }, 0);
      }
    };
  }, [enabled]);

  return containerRef;
}

