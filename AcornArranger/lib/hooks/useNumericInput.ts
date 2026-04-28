import { useCallback, useMemo, useState, type ChangeEvent } from "react";

export type NumericInputBounds = {
  min?: number;
  max?: number;
};

export type UseNumericInputOptions = {
  /**
   * Initial numeric value. `undefined` (or omitted) renders an empty input,
   * which is the right state for optional fields that mean "auto/default".
   */
  initialValue?: number;
  /**
   * Value to revert to on blur when the user has cleared the field or typed
   * something unparseable. Omit for optional fields where empty is itself a
   * valid state.
   */
  fallback?: number;
  /**
   * Soft bounds. Out-of-range values are clamped on blur (and in the derived
   * `value`), not rejected mid-keystroke, so users can still pass through
   * intermediate states like "1" while typing "12".
   */
  bounds?: NumericInputBounds;
  /** If true, blur normalizes to an integer via Math.round. */
  integer?: boolean;
};

export type UseNumericInputReturn = {
  /** Current display text (controlled string). */
  text: string;
  /** Direct setter, for resets and programmatic updates. */
  setText: (next: string) => void;
  /** onChange handler — stores the raw text without parsing. */
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  /** onBlur handler — clamps / rounds / restores the fallback. */
  onBlur: () => void;
  /**
   * Parsed numeric value derived from the current text. Returns `undefined`
   * when the text is empty or not finite. Bounded and rounded per options.
   */
  value: number | undefined;
};

/**
 * useNumericInput
 *
 * Hook for "type-friendly" numeric inputs. Existing inputs that parse on every
 * keystroke (e.g. `Number(e.target.value) || default`) trap the user: clearing
 * the field instantly snaps back to the default before they can type a new
 * value. This hook mirrors the pattern used in `DurationPicker` — the
 * displayed text is the source of truth while typing, and normalization
 * (clamping, rounding, fallback) only fires on blur.
 *
 * Consumers should read `value` when constructing the actual numeric payload
 * (e.g. a build-options object) so they never see a partially-typed,
 * unparseable intermediate state.
 *
 * @example
 *   const cleaningWindow = useNumericInput({
 *     initialValue: 6,
 *     fallback: 6,
 *   });
 *   <Input
 *     value={cleaningWindow.text}
 *     onChange={cleaningWindow.onChange}
 *     onBlur={cleaningWindow.onBlur}
 *   />
 *   const buildOptions = { cleaning_window: cleaningWindow.value ?? 6 };
 */
export function useNumericInput(
  options: UseNumericInputOptions = {}
): UseNumericInputReturn {
  const { initialValue, fallback, bounds, integer = false } = options;

  const [text, setText] = useState<string>(
    initialValue !== undefined ? String(initialValue) : ""
  );

  const normalize = useCallback(
    (n: number): number => {
      let v = integer ? Math.round(n) : n;
      if (bounds?.min !== undefined) v = Math.max(bounds.min, v);
      if (bounds?.max !== undefined) v = Math.min(bounds.max, v);
      return v;
    },
    [bounds?.min, bounds?.max, integer]
  );

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setText(event.target.value);
    },
    []
  );

  const onBlur = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed === "") {
      if (fallback !== undefined) {
        setText(String(fallback));
      }
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setText(fallback !== undefined ? String(fallback) : "");
      return;
    }
    const normalized = normalize(parsed);
    const normalizedText = String(normalized);
    if (normalizedText !== text) {
      setText(normalizedText);
    }
  }, [text, fallback, normalize]);

  const value = useMemo<number | undefined>(() => {
    const trimmed = text.trim();
    if (trimmed === "") return undefined;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return undefined;
    return normalize(parsed);
  }, [text, normalize]);

  return { text, setText, onChange, onBlur, value };
}
