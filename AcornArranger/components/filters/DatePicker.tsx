"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import Calendar from "@/components/ui/calendar";

type DatePickerProps = {
  label?: string;
  value: Date | undefined;
  onChange: (next: Date | undefined) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

function formatDate(value: Date | undefined): string {
  if (!value) return "Select date";
  return value.toLocaleDateString();
}

function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/**
 * Returns the date for a given day of the week using this rule:
 * - If targetDay === today's day → next occurrence (7 days ahead)
 * - Otherwise → the occurrence in the current Sunday–Saturday week
 */
function getDateForDayOfWeek(targetDay: number): Date {
  const base = today();
  const currentDay = base.getDay();
  const diff = targetDay === currentDay ? 7 : targetDay - currentDay;
  const d = new Date(base);
  d.setDate(d.getDate() + diff);
  return d;
}

export function DatePicker({
  label = "Date",
  value,
  onChange,
  disabled,
  id,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const buttonId = id ?? React.useId();

  const currentDayOfWeek = today().getDay();

  const handleRelative = (offset: number) => {
    const d = today();
    d.setDate(d.getDate() + offset);
    onChange(d);
    setOpen(false);
  };

  const handleDayOfWeek = (dayIndex: number) => {
    onChange(getDateForDayOfWeek(dayIndex));
    setOpen(false);
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={buttonId}
            variant="outline"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-controls={`${buttonId}-content`}
            disabled={disabled}
            className="gap-2"
          >
            <CalendarIcon className="h-4 w-4" />
            {label}: {formatDate(value)}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          id={`${buttonId}-content`}
          className="w-auto p-2"
          align="start"
          aria-labelledby={`${buttonId}-heading`}
        >
          <span id={`${buttonId}-heading`} className="sr-only">{label}</span>
          <div className="flex gap-2">
            {/* Relative presets */}
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">Relative</p>
              <Button variant="secondary" size="sm" onClick={() => handleRelative(-1)}>
                Yesterday
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleRelative(0)}>
                Today
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleRelative(1)}>
                Tomorrow
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { onChange(undefined); setOpen(false); }}
                aria-label="Clear date"
              >
                Clear
              </Button>
            </div>

            {/* Day-of-week presets */}
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">Day of week</p>
              {DAY_NAMES.map((name, i) => (
                <Button
                  key={name}
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDayOfWeek(i)}
                  className="justify-between gap-2"
                  title={i === currentDayOfWeek ? "Next " + name : name + " this week"}
                >
                  <span>{name}</span>
                  {i === currentDayOfWeek && (
                    <span className="text-xs text-muted-foreground font-normal">+7d</span>
                  )}
                </Button>
              ))}
            </div>

            {/* Calendar */}
            <Calendar
              mode="single"
              selected={value}
              onSelect={(date) => {
                onChange(date);
                setOpen(false);
              }}
              defaultMonth={value ?? new Date()}
              aria-label={`${label} calendar`}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default DatePicker;
