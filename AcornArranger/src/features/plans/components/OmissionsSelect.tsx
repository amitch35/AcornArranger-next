"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Ban, ChevronDown, X } from "lucide-react";
import type { AppointmentRow } from "@/src/features/appointments/schemas";
import { formatDateTime } from "@/src/features/appointments/schemas";

type OmissionsSelectProps = {
  /** All appointments for the day (status 1,2). This component filters by services internally. */
  appointments: AppointmentRow[];
  /** Service IDs to filter appointments by (aligns with build options services). */
  services: number[];
  /** Selected appointment IDs to omit from the build. */
  value: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
};

export function OmissionsSelect({
  appointments,
  services,
  value,
  onChange,
  disabled,
}: OmissionsSelectProps) {
  const [open, setOpen] = React.useState(false);

  /** Filter to only appointments whose service matches the current build services filter */
  const filteredAppointments = React.useMemo(() => {
    if (services.length === 0) return appointments;
    const serviceSet = new Set(services);
    return appointments.filter(
      (a) => a.service_info?.service_id != null && serviceSet.has(a.service_info.service_id)
    );
  }, [appointments, services]);

  const selectedSet = React.useMemo(() => new Set(value), [value]);

  const toggle = (appointmentId: number) => {
    if (selectedSet.has(appointmentId)) {
      onChange(value.filter((id) => id !== appointmentId));
    } else {
      onChange([...value, appointmentId]);
    }
  };

  const selectAll = () => {
    const allIds = filteredAppointments
      .map((a) => a.appointment_id ?? a.id)
      .filter((id): id is number => id != null);
    onChange(allIds);
  };

  const clearAll = () => onChange([]);

  const triggerLabel =
    value.length === 0
      ? "Select Omissions"
      : value.length === 1
      ? "1 appointment omitted"
      : `${value.length} appointments omitted`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled}
              className="gap-2"
              aria-haspopup="dialog"
              aria-expanded={open}
            >
              <Ban className="h-4 w-4" />
              {triggerLabel}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[380px] p-0" align="start">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <h4 className="text-sm font-semibold">Select Appointments to Omit</h4>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  disabled={value.length === 0}
                >
                  Clear
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  disabled={filteredAppointments.length === 0}
                >
                  Select All
                </Button>
              </div>
            </div>

            {filteredAppointments.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                No appointments for this date and service selection.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y">
                {filteredAppointments.map((appt) => {
                  const apptId = appt.appointment_id ?? appt.id;
                  if (apptId == null) return null;
                  const checked = selectedSet.has(apptId);
                  const propertyName =
                    appt.property_info?.property_name ?? `Appointment #${apptId}`;
                  const serviceTime = formatDateTime(appt.departure_time);
                  const serviceName = appt.service_info?.name;

                  return (
                    <label
                      key={apptId}
                      className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-accent transition-colors"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(apptId)}
                        className="mt-0.5 shrink-0"
                        aria-label={`Omit ${propertyName}`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{propertyName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[serviceTime, serviceName].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </PopoverContent>
        </Popover>

        {value.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={disabled}
            aria-label="Clear all omissions"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Inline summary of omitted appointments (mirrors legacy's <ul class="appointments">) */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((id) => {
            const appt = filteredAppointments.find(
              (a) => (a.appointment_id ?? a.id) === id
            );
            const label =
              appt?.property_info?.property_name ?? `#${id}`;
            return (
              <Badge
                key={id}
                variant="secondary"
                className="gap-1 text-xs"
              >
                {label}
                <button
                  aria-label={`Remove omission for ${label}`}
                  className="inline-flex items-center"
                  onClick={() => toggle(id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
