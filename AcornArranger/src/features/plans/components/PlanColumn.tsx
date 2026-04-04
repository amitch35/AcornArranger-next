"use client";

import * as React from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export const STAFF_DRAGGABLE_PREFIX = "staff-";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Upload, X, Pencil, Loader2 } from "lucide-react";
import type { Plan, PlanAppointment } from "../schemas";
import type { WithSentGuardFn } from "./ScheduleBoard";
import {
  addStaffToPlan,
  removeStaffFromPlan,
  addAppointmentToPlan,
  removeAppointmentFromPlan,
} from "../api";
import { toastError } from "@/lib/toast";
import { useStaffOptions } from "@/lib/options/useStaffOptions";
import type { AppointmentRow } from "@/src/features/appointments/schemas";

type PlanColumnProps = {
  plan: Plan;
  plans: Plan[];
  allAppointments: AppointmentRow[];
  onUpdate: () => void;
  isSent: boolean;
  withSentGuard: WithSentGuardFn;
};

export function PlanColumn({
  plan,
  plans,
  allAppointments,
  onUpdate,
  isSent,
  withSentGuard,
}: PlanColumnProps) {
  const planDroppableId = `plan-${plan.plan_id}`;
  const { setNodeRef, isOver } = useDroppable({ id: planDroppableId });

  const appointmentPlanCount = React.useMemo(() => {
    const count = new Map<number, number>();
    for (const p of plans) {
      for (const pa of p.appointments) {
        count.set(pa.appointment_id, (count.get(pa.appointment_id) ?? 0) + 1);
      }
    }
    return count;
  }, [plans]);

  const [removing, setRemoving] = React.useState<Set<number>>(new Set());

  const handleRemoveStaff = React.useCallback(
    async (userId: number) => {
      setRemoving((prev) => new Set(prev).add(userId));
      try {
        await withSentGuard([plan.plan_id], async (m) => {
          await removeStaffFromPlan(m.get(plan.plan_id)!, userId);
        });
        onUpdate();
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Remove staff failed", {
          code: "Remove Staff",
        });
      } finally {
        setRemoving((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    },
    [plan.plan_id, onUpdate, withSentGuard]
  );

  const activeAppointments = plan.appointments.filter(
    (a) => a.appointment_info?.status?.status_id !== 5
  );

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col w-full rounded-lg border p-4 bg-card
        ${isOver ? "ring-2 ring-primary/50" : ""}
      `}
    >
      {/* Plan metadata header: ID, date, sent indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span>#{plan.plan_id} · {plan.plan_date}</span>
        {isSent && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Upload className="h-3 w-3" />
            Sent
          </Badge>
        )}
      </div>

      <h3 className="font-semibold border-b pb-2 mb-3">Team {plan.team}</h3>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm text-muted-foreground">Staff</h4>
          <PlanStaffPopover
            plan={plan}
            withSentGuard={withSentGuard}
            onUpdate={onUpdate}
          />
        </div>
        <ul className="space-y-1 text-sm">
          {plan.staff.map((s) => (
            <StaffChip
              key={s.user_id}
              planId={plan.plan_id}
              userId={s.user_id}
              name={s.staff_info?.name ?? String(s.user_id)}
              removing={removing.has(s.user_id)}
              onRemove={() => handleRemoveStaff(s.user_id)}
            />
          ))}
          {plan.staff.length === 0 && (
            <li className="text-muted-foreground">None</li>
          )}
        </ul>
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm text-muted-foreground">Appointments</h4>
          <PlanAppointmentPopover
            plan={plan}
            allAppointments={allAppointments}
            withSentGuard={withSentGuard}
            onUpdate={onUpdate}
          />
        </div>
        <div className="space-y-2 min-h-[80px]">
          {activeAppointments.map((a) => (
            <PlanAppointmentItem
              key={a.appointment_id}
              appointment={a}
              planId={plan.plan_id}
              isDuplicate={(appointmentPlanCount.get(a.appointment_id) ?? 0) > 1}
            />
          ))}
          {activeAppointments.length === 0 && (
            <div className="text-sm text-muted-foreground py-4 border border-dashed rounded text-center">
              Drop appointments here
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type ApptItem = {
  id: number;
  label: string;
  subLabel: string;
  checked: boolean;
};

type PlanAppointmentPopoverProps = {
  plan: Plan;
  allAppointments: AppointmentRow[];
  withSentGuard: WithSentGuardFn;
  onUpdate: () => void;
};

function PlanAppointmentPopover({
  plan,
  allAppointments,
  withSentGuard,
  onUpdate,
}: PlanAppointmentPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<Set<number>>(new Set());
  const [search, setSearch] = React.useState("");

  const planApptIds = React.useMemo(
    () => new Set(plan.appointments.map((a) => a.appointment_id)),
    [plan.appointments]
  );

  const items: ApptItem[] = React.useMemo(() => {
    const raw = allAppointments
      .filter((a) => a.status?.status_id !== 5)
      .map((a): ApptItem => {
        const id = a.appointment_id ?? a.id;
        const label = a.property_info?.property_name ?? `#${id}`;
        const serviceName = a.service_info?.name ?? "";
        const time = a.departure_time ? a.departure_time.slice(11, 16) : "";
        const subLabel = [serviceName, time].filter(Boolean).join(" · ");
        return { id, label, subLabel, checked: planApptIds.has(id) };
      });

    // Checked (on-plan) first, then alphabetical within each group.
    raw.sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? -1 : 1;
      return a.label.localeCompare(b.label);
    });

    return raw;
  }, [allAppointments, planApptIds]);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, search]);

  const toggle = React.useCallback(
    async (item: ApptItem) => {
      setPending((prev) => new Set(prev).add(item.id));
      try {
        await withSentGuard([plan.plan_id], async (m) => {
          if (item.checked) {
            await removeAppointmentFromPlan(m.get(plan.plan_id)!, item.id);
          } else {
            await addAppointmentToPlan(m.get(plan.plan_id)!, item.id);
          }
        });
        onUpdate();
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Appointment update failed", {
          code: "Appointment",
        });
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [plan.plan_id, withSentGuard, onUpdate]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          aria-label="Manage appointments"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search appointments..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtered.length === 0 && (
              <CommandEmpty>No appointments found.</CommandEmpty>
            )}
            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((item) => {
                  const isPending = pending.has(item.id);
                  return (
                    <CommandItem
                      key={item.id}
                      value={String(item.id)}
                      onSelect={() => {
                        if (!isPending) toggle(item);
                      }}
                      disabled={isPending}
                      className="gap-2 items-start"
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0 mt-0.5" />
                      ) : (
                        <Checkbox
                          checked={item.checked}
                          aria-hidden
                          className="shrink-0 pointer-events-none mt-0.5"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="truncate">{item.label}</div>
                        {item.subLabel && (
                          <div className="text-xs text-muted-foreground truncate">
                            {item.subLabel}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type PlanStaffPopoverProps = {
  plan: Plan;
  withSentGuard: WithSentGuardFn;
  onUpdate: () => void;
};

function PlanStaffPopover({ plan, withSentGuard, onUpdate }: PlanStaffPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<Set<number>>(new Set());
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim() || undefined), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, refetch } = useStaffOptions({
    q: debouncedSearch,
    statusIds: [1],
    canClean: true,
    pageSize: 50,
  });

  const currentIds = React.useMemo(
    () => new Set(plan.staff.map((s) => s.user_id)),
    [plan.staff]
  );

  const options = React.useMemo(() => {
    const raw = data?.options ?? [];
    // Sort checked (on-plan) staff to the top.
    return [...raw].sort((a, b) => {
      const aOn = currentIds.has(Number(a.id)) ? 0 : 1;
      const bOn = currentIds.has(Number(b.id)) ? 0 : 1;
      return aOn - bOn;
    });
  }, [data, currentIds]);

  const toggle = React.useCallback(
    async (userId: number) => {
      const isOnPlan = currentIds.has(userId);
      setPending((prev) => new Set(prev).add(userId));
      try {
        await withSentGuard([plan.plan_id], async (m) => {
          if (isOnPlan) {
            await removeStaffFromPlan(m.get(plan.plan_id)!, userId);
          } else {
            await addStaffToPlan(m.get(plan.plan_id)!, userId);
          }
        });
        onUpdate();
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Staff update failed", {
          code: "Staff",
        });
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    },
    [plan.plan_id, currentIds, withSentGuard, onUpdate]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          aria-label="Manage staff"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search staff..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {isError && !isLoading && (
              <CommandEmpty>
                <div className="flex items-center justify-between gap-2 px-2">
                  <span className="text-sm">Failed to load staff.</span>
                  <Button size="sm" variant="secondary" onClick={() => refetch()}>
                    Retry
                  </Button>
                </div>
              </CommandEmpty>
            )}
            {!isLoading && !isError && options.length === 0 && (
              <CommandEmpty>No staff found.</CommandEmpty>
            )}
            {!isLoading && !isError && options.length > 0 && (
              <CommandGroup>
                {options.map((opt) => {
                  const userId = Number(opt.id);
                  const checked = currentIds.has(userId);
                  const isPending = pending.has(userId);
                  return (
                    <CommandItem
                      key={opt.id}
                      value={String(opt.id)}
                      onSelect={() => {
                        if (!isPending) toggle(userId);
                      }}
                      disabled={isPending}
                      className="gap-2"
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      ) : (
                        <Checkbox
                          checked={checked}
                          aria-hidden
                          className="shrink-0 pointer-events-none"
                        />
                      )}
                      <span className="truncate">{opt.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function StaffChip({
  planId,
  userId,
  name,
  removing,
  onRemove,
}: {
  planId: number;
  userId: number;
  name: string;
  removing: boolean;
  onRemove: () => void;
}) {
  const id = `${STAFF_DRAGGABLE_PREFIX}${planId}-${userId}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    data: { type: "staff", planId, userId },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between gap-2 group ${isDragging ? "opacity-50" : ""}`}
    >
      <span
        {...listeners}
        {...attributes}
        className="flex-1 min-w-0 truncate cursor-grab active:cursor-grabbing rounded px-1 -mx-1 hover:bg-muted/50"
        role="button"
        tabIndex={0}
        aria-label={`Drag ${name} to move to another team`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") e.preventDefault();
        }}
      >
        {name}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        disabled={removing}
        onClick={onRemove}
        aria-label={`Remove ${name}`}
      >
        <X className="h-3 w-3" />
      </Button>
    </li>
  );
}

function PlanAppointmentItem({
  appointment,
  planId,
  isDuplicate,
}: {
  appointment: PlanAppointment;
  planId: number;
  isDuplicate: boolean;
}) {
  const id = `plan-${planId}-${appointment.appointment_id}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    data: {
      type: "appointment",
      appointmentId: appointment.appointment_id,
      source: `plan-${planId}`,
    },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const propName =
    appointment.appointment_info?.property_info?.property_name ??
    appointment.appointment_id;
  const serviceName = appointment.appointment_info?.service?.service_name ?? "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        rounded border p-2 text-sm cursor-grab active:cursor-grabbing
        bg-background hover:bg-muted/50
        ${isDuplicate ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30" : ""}
        ${isDragging ? "opacity-50" : ""}
      `}
      role="button"
      tabIndex={0}
      aria-label={`Drag ${propName} to move`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
        }
      }}
    >
      <div className="font-medium truncate">{propName}</div>
      <div className="text-xs text-muted-foreground truncate">{serviceName}</div>
      {isDuplicate && (
        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          In multiple plans
        </div>
      )}
    </div>
  );
}
