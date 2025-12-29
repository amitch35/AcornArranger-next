"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function toHHMM(totalMinutes: number) {
  const mins = Math.max(0, Math.trunc(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return { h, m };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseDigits(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export type DurationPickerProps = {
  valueMinutes: number | null;
  onChange: (minutes: number | null) => void;
  stepMinutes?: number;
  minMinutes?: number;
  maxMinutes?: number;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * DurationPicker (HH:MM -> minutes)
 *
 * Controlled component: accepts total minutes (or null) and emits total minutes (or null).
 * Intended for editing rc_properties.estimated_cleaning_mins and similar settings fields.
 */
export const DurationPicker = React.forwardRef<HTMLInputElement, DurationPickerProps>(
  (
    {
      valueMinutes,
      onChange,
      stepMinutes = 5,
      minMinutes = 0,
      maxMinutes = 1440,
      disabled,
      required,
      placeholder,
      id,
      name,
      className,
      style,
      ...aria
    },
    ref,
  ) => {
    const hoursRef = React.useRef<HTMLInputElement>(null);
    const minutesRef = React.useRef<HTMLInputElement>(null);
    const editingRef = React.useRef<"hh" | "mm" | null>(null);
    const isDirtyRef = React.useRef(false);

    React.useImperativeHandle(ref, () => hoursRef.current as HTMLInputElement, []);

    const normalizedValue =
      valueMinutes === null || valueMinutes === undefined
        ? null
        : clampInt(valueMinutes, minMinutes, maxMinutes);

    const display = React.useMemo(() => {
      if (normalizedValue === null) return { hh: "", mm: "" };
      const { h, m } = toHHMM(normalizedValue);
      return { hh: pad2(h), mm: pad2(m) };
    }, [normalizedValue]);

    const [hh, setHh] = React.useState(display.hh);
    const [mm, setMm] = React.useState(display.mm);

    React.useEffect(() => {
      // While the user is actively typing in a segment, avoid re-syncing from the controlled value
      // on every keystroke (it breaks caret position and can make typing feel "blocked").
      if (editingRef.current && isDirtyRef.current) return;
      setHh(display.hh);
      setMm(display.mm);
    }, [display.hh, display.mm]);

    const emitFromTexts = React.useCallback(
      (nextHh: string, nextMm: string) => {
        const hNum = parseDigits(nextHh);
        const mNum = parseDigits(nextMm);

        if (hNum === null && mNum === null) {
          onChange(null);
          return;
        }

        const h = clampInt(hNum ?? 0, 0, 999);
        const m = clampInt(mNum ?? 0, 0, 999);

        // Normalize overflow minutes into hours.
        const total = h * 60 + m;
        const clamped = clampInt(total, minMinutes, maxMinutes);
        onChange(clamped);
      },
      [onChange, minMinutes, maxMinutes],
    );

    const syncDisplayFromMinutes = React.useCallback((minutes: number | null) => {
      if (minutes === null) {
        setHh("");
        setMm("");
        return;
      }
      const clamped = clampInt(minutes, minMinutes, maxMinutes);
      const { h: nh, m: nm } = toHHMM(clamped);
      setHh(pad2(nh));
      setMm(pad2(nm));
    }, [minMinutes, maxMinutes]);

    const applyDelta = React.useCallback(
      (deltaMinutes: number) => {
        const base =
          normalizedValue ??
          clampInt(
            0,
            minMinutes,
            maxMinutes,
          );
        const next = clampInt(base + deltaMinutes, minMinutes, maxMinutes);
        onChange(next);
        // When incrementing via keyboard, update the visible HH/MM immediately even while focused.
        syncDisplayFromMinutes(next);
      },
      [normalizedValue, minMinutes, maxMinutes, onChange, syncDisplayFromMinutes],
    );

    const handleHoursKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.key === "ArrowRight" || e.key === ":") {
        e.preventDefault();
        minutesRef.current?.focus();
        minutesRef.current?.select();
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const mult = e.shiftKey ? 5 : 1;
        applyDelta((e.key === "ArrowUp" ? 60 : -60) * mult);
      }
      if (e.key === "Home") {
        e.preventDefault();
        const next = clampInt(minMinutes, minMinutes, maxMinutes);
        onChange(next);
        syncDisplayFromMinutes(next);
      }
      if (e.key === "End") {
        e.preventDefault();
        const next = clampInt(maxMinutes, minMinutes, maxMinutes);
        onChange(next);
        syncDisplayFromMinutes(next);
      }
    };

    const handleMinutesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        hoursRef.current?.focus();
        hoursRef.current?.select();
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const mult = e.shiftKey ? 5 : 1;
        applyDelta((e.key === "ArrowUp" ? stepMinutes : -stepMinutes) * mult);
      }
      if (e.key === "Home") {
        e.preventDefault();
        const next = clampInt(minMinutes, minMinutes, maxMinutes);
        onChange(next);
        syncDisplayFromMinutes(next);
      }
      if (e.key === "End") {
        e.preventDefault();
        const next = clampInt(maxMinutes, minMinutes, maxMinutes);
        onChange(next);
        syncDisplayFromMinutes(next);
      }
    };

    const commonInputProps = {
      disabled,
      required,
      inputMode: "numeric" as const,
      pattern: "[0-9]*",
      placeholder: placeholder ?? undefined,
    };

    const forceCaretToEndOnMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
      if (disabled) return;
      // Make behavior consistent: clicking anywhere in the segment places caret at the end.
      // We prevent the browser’s default caret placement (which can land before digits).
      e.preventDefault();
      const el = e.currentTarget;
      el.focus();
      const end = el.value.length;
      try {
        el.setSelectionRange(end, end);
      } catch {
        // Some environments may not support selection ranges; ignore.
      }
      // Mark as editing for this segment so controlled re-sync doesn't fight typing.
      editingRef.current = el === hoursRef.current ? "hh" : "mm";
      isDirtyRef.current = false;
    };

    return (
      <div
        className={cn("inline-flex items-center gap-1", className)}
        style={style}
        role="group"
        {...aria}
      >
        <Input
          {...commonInputProps}
          id={id}
          ref={hoursRef}
          aria-label={aria["aria-label"] ? `${aria["aria-label"]} hours` : "Hours"}
          value={hh}
          onMouseDown={forceCaretToEndOnMouseDown}
          onKeyDown={handleHoursKeyDown}
          onFocus={(e) => {
            editingRef.current = "hh";
            isDirtyRef.current = false;
            // Select-all makes 2-digit entry predictable regardless of where the user clicks.
            e.currentTarget.select();
          }}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            // Robust to caret position: keep the *last* 2 digits the user typed.
            const next = digits.slice(-2);
            setHh(next);
            isDirtyRef.current = true;
            // Don't commit to the controlled value until the user finishes the segment (blur or 2 digits).
            if (next.length === 2 || next.length === 0) {
              emitFromTexts(next, mm);
            }
          }}
          onBlur={() => {
            editingRef.current = null;
            isDirtyRef.current = false;
            // Normalize & re-pad based on clamped value.
            if (normalizedValue === null && hh.trim() === "" && mm.trim() === "") return;
            const h = parseDigits(hh) ?? 0;
            const m = parseDigits(mm) ?? 0;
            const clamped = clampInt(h * 60 + m, minMinutes, maxMinutes);
            const { h: nh, m: nm } = toHHMM(clamped);
            setHh(pad2(nh));
            setMm(pad2(nm));
            onChange(clamped);
          }}
          className="w-14 text-center tabular-nums"
        />
        <span aria-hidden className="select-none text-muted-foreground tabular-nums">
          :
        </span>
        <Input
          {...commonInputProps}
          ref={minutesRef}
          aria-label={aria["aria-label"] ? `${aria["aria-label"]} minutes` : "Minutes"}
          value={mm}
          onMouseDown={forceCaretToEndOnMouseDown}
          onKeyDown={handleMinutesKeyDown}
          onFocus={(e) => {
            editingRef.current = "mm";
            isDirtyRef.current = false;
            e.currentTarget.select();
          }}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            const next = digits.slice(-2);
            setMm(next);
            isDirtyRef.current = true;
            if (next.length === 2 || next.length === 0) {
              emitFromTexts(hh, next);
            }
          }}
          onBlur={() => {
            editingRef.current = null;
            isDirtyRef.current = false;
            if (normalizedValue === null && hh.trim() === "" && mm.trim() === "") return;
            const h = parseDigits(hh) ?? 0;
            const m = parseDigits(mm) ?? 0;
            const clamped = clampInt(h * 60 + m, minMinutes, maxMinutes);
            const { h: nh, m: nm } = toHHMM(clamped);
            setHh(pad2(nh));
            setMm(pad2(nm));
            onChange(clamped);
          }}
          className="w-14 text-center tabular-nums"
        />

        {/* Optional hidden input for plain HTML form submissions */}
        {name ? (
          <input
            type="hidden"
            name={name}
            value={normalizedValue === null ? "" : String(normalizedValue)}
          />
        ) : null}
      </div>
    );
  },
);

DurationPicker.displayName = "DurationPicker";

export default DurationPicker;


