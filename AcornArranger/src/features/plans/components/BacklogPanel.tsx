"use client";

import * as React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ServiceMultiSelect } from "@/components/filters/ServiceMultiSelect";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import type { AppointmentRow } from "@/src/features/appointments/schemas";
import { formatDateTime } from "@/src/features/appointments/schemas";

/**
 * useLayoutEffect on the client (fires synchronously before paint, preventing
 * any flash), falls back to useEffect on the server to avoid the SSR warning.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/** Returns the current desktop state synchronously before first paint. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState(false);
  useIsomorphicLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

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
  const isDesktop = useIsDesktop();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return isDesktop ? (
    <BacklogDesktop
      appointments={appointments}
      serviceOptions={serviceOptions}
      serviceFilter={serviceFilter}
      onServiceFilterChange={onServiceFilterChange}
      isLoading={isLoading}
    />
  ) : (
    <BacklogMobile
      appointments={appointments}
      serviceOptions={serviceOptions}
      serviceFilter={serviceFilter}
      onServiceFilterChange={onServiceFilterChange}
      isLoading={isLoading}
      open={mobileOpen}
      onOpenChange={setMobileOpen}
    />
  );
}

/** Desktop: collapsible sidebar column, open by default. */
function BacklogDesktop({
  appointments,
  serviceOptions,
  serviceFilter,
  onServiceFilterChange,
  isLoading,
}: BacklogPanelProps) {
  const [open, setOpen] = React.useState(true);
  const { setNodeRef, isOver } = useDroppable({ id: BACKLOG_DROPPABLE });

  if (!open) {
    return (
      <div
        ref={setNodeRef}
        className={`shrink-0 rounded-lg border bg-card flex flex-col items-center py-3 px-1 gap-2 ${isOver ? "ring-2 ring-primary/50" : ""}`}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setOpen(true)}
          aria-label="Expand unscheduled panel"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
        <span className="text-xs font-medium text-muted-foreground [writing-mode:vertical-lr] rotate-180 select-none">
          Unscheduled ({appointments.length})
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 shrink-0 rounded-lg border bg-card p-4 ${isOver ? "ring-2 ring-primary/50" : ""}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Unscheduled</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(false)}
          aria-label="Collapse unscheduled panel"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>
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

/** Mobile/tablet: full-width collapsible section, collapsed by default. */
function BacklogMobile({
  appointments,
  serviceOptions,
  serviceFilter,
  onServiceFilterChange,
  isLoading,
  open,
  onOpenChange,
}: BacklogPanelProps & { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: BACKLOG_DROPPABLE });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border bg-card ${isOver ? "ring-2 ring-primary/50" : ""}`}
    >
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between px-4 py-3 h-auto rounded-lg font-semibold"
          >
            <span>
              Unscheduled
              {appointments.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({appointments.length})
                </span>
              )}
            </span>
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
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
            <div className="space-y-2">
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
        </CollapsibleContent>
      </Collapsible>
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
 * Map raw appointment rows to backlog items. The server is expected to already
 * have excluded planned / cancelled / out-of-scope appointments via query
 * params (`excludePlanned`, `statusIds`, `serviceIds`), so this helper only
 * attaches the derived `planAppointmentId` used by drag-and-drop.
 */
export function toBacklogAppointments(
  appointments: AppointmentRow[]
): BacklogAppointment[] {
  return appointments.map((a) => ({
    ...a,
    planAppointmentId: a.appointment_id ?? a.id,
  }));
}
