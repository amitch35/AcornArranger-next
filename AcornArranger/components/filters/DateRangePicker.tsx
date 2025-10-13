"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import Calendar from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";

type DateRangePickerProps = {
  label?: string;
  value: DateRange | undefined;
  onChange: (next: DateRange | undefined) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

function formatRange(value: DateRange | undefined): string {
  if (!value?.from && !value?.to) return "Select dates";
  const f = value?.from ? value.from.toLocaleDateString() : "?";
  const t = value?.to ? value.to.toLocaleDateString() : "?";
  return `${f} – ${t}`;
}

export function DateRangePicker({ label = "Date Range", value, onChange, disabled, id, className }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const buttonId = id ?? React.useId();

  const setPreset = (preset: "today" | "yesterday" | "tomorrow" | "last7" | "last30" | "thisMonth" | "lastMonth") => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    switch (preset) {
      case "today":
        break;
      case "tomorrow":
        start.setDate(start.getDate() + 1);
        end.setDate(end.getDate() + 1);
        break;
      case "yesterday":
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
        break;
      case "last7":
        start.setDate(start.getDate() - 6);
        break;
      case "last30":
        start.setDate(start.getDate() - 29);
        break;
      case "thisMonth":
        start.setDate(1);
        end.setMonth(end.getMonth() + 1); end.setDate(0);
        break;
      case "lastMonth": {
        const m = now.getMonth();
        const y = now.getFullYear();
        const first = new Date(y, m - 1, 1);
        const last = new Date(y, m, 0);
        onChange({ from: first, to: last });
        return;
      }
    }
    onChange({ from: start, to: end });
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
            {label}: {formatRange(value)}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent id={`${buttonId}-content`} className="w-auto p-2" align="start" aria-labelledby={`${buttonId}-heading`}>
          <div className="flex gap-3">
            <div className="flex flex-col gap-1">
              <span id={`${buttonId}-heading`} className="sr-only">{label}</span>
              <Button variant="secondary" onClick={() => setPreset("today")}>Today</Button>
              <Button variant="secondary" onClick={() => setPreset("yesterday")}>Yesterday</Button>
              <Button variant="secondary" onClick={() => setPreset("tomorrow")}>Tomorrow</Button>
              <Button variant="secondary" onClick={() => setPreset("last7")}>Last 7 days</Button>
              <Button variant="secondary" onClick={() => setPreset("last30")}>Last 30 days</Button>
              <Button variant="secondary" onClick={() => setPreset("thisMonth")}>This month</Button>
              <Button variant="secondary" onClick={() => setPreset("lastMonth")}>Last month</Button>
              <Button variant="ghost" onClick={() => onChange(undefined)} aria-label="Clear date range">Clear</Button>
            </div>
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={value}
              onSelect={(range) => onChange(range)}
              defaultMonth={value?.from ?? new Date()}
              aria-label={`${label} calendar`}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default DateRangePicker;


