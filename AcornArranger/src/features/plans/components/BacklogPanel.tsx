"use client";

import * as React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Label } from "@/components/ui/label";
import { ServiceMultiSelect } from "@/components/filters/ServiceMultiSelect";
import type { AppointmentRow } from "@/src/features/appointments/schemas";
import type { Plan } from "../schemas";
import { formatDateTime } from "@/src/features/appointments/schemas";

export const BACKLOG_DROPPABLE = "backlog";

export type BacklogAppointment = AppointmentRow & {
  /** Effective ID for plan operations (appointment_id or id) */
  planAppointmentId: number;
};

type BacklogPanelProps = {
  appointments: BacklogAppointment[];
  serviceOptions: { value: string; label: string }[];
  serviceFilter: string[];
  onServiceFilterChange: (next: string[]) => void;
  isLoading?: boolean;
};

export function BacklogPanel({
  appointments,
  serviceOptions,
  serviceFilter,
  onServiceFilterChange,
  isLoading,
}: BacklogPanelProps) {
  const { setNodeRef, isOver } = useDroppable({ id: BACKLOG_DROPPABLE });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 shrink-0 rounded-lg border bg-card p-4 ${isOver ? "ring-2 ring-primary/50" : ""}`}
    >
      <h3 className="font-semibold mb-3">Unscheduled</h3>
      <div className="space-y-3 mb-4">
        <div>
          <Label className="text-xs">Service</Label>
          <ServiceMultiSelect
            options={serviceOptions}
            value={serviceFilter}
            onChange={onServiceFilterChange}
            showBadges={false}
            placeholder="All"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-[200px] space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No unscheduled appointments</p>
        ) : (
          appointments.map((apt) => (
            <BacklogItem key={apt.planAppointmentId} appointment={apt} />
          ))
        )}
      </div>
    </div>
  );
}

function BacklogItem({ appointment }: { appointment: BacklogAppointment }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `backlog-${appointment.planAppointmentId}`,
    data: {
      type: "appointment",
      appointmentId: appointment.planAppointmentId,
      source: BACKLOG_DROPPABLE,
    },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const propName = appointment.property_info?.property_name ?? `#${appointment.planAppointmentId}`;
  const serviceName = appointment.service_info?.name ?? "";
  const timeStr = formatDateTime(appointment.departure_time) ?? "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        rounded border p-2 text-sm cursor-grab active:cursor-grabbing
        bg-background hover:bg-muted/50
        ${isDragging ? "opacity-50 shadow-lg" : ""}
      `}
      role="button"
      tabIndex={0}
      aria-label={`Drag ${propName} to assign to a team`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }
      }}
    >
      <div className="font-medium truncate">{propName}</div>
      <div className="text-xs text-muted-foreground truncate">
        {serviceName}
        {timeStr ? ` · ${timeStr}` : ""}
      </div>
    </div>
  );
}

/**
 * Compute unscheduled appointments from all appointments and plans.
 * Excludes cancelled (status 5) and filters by service.
 */
export function computeUnscheduled(
  allAppointments: AppointmentRow[],
  plans: Plan[],
  serviceFilter: string[]
): BacklogAppointment[] {
  const scheduledIds = new Set<number>();
  for (const plan of plans) {
    for (const pa of plan.appointments) {
      scheduledIds.add(pa.appointment_id);
    }
  }

  const serviceSet = serviceFilter.length ? new Set(serviceFilter.map(Number)) : null;

  return allAppointments
    .filter((a) => {
      if (a.status?.status_id === 5) return false;
      const planId = a.appointment_id ?? a.id;
      if (scheduledIds.has(planId)) return false;
      if (serviceSet && a.service_info && !serviceSet.has(a.service_info.service_id)) return false;
      return true;
    })
    .map((a) => ({
      ...a,
      planAppointmentId: a.appointment_id ?? a.id,
    }));
}
