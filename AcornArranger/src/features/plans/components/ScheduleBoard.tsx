"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { BacklogPanel, BACKLOG_DROPPABLE, computeUnscheduled } from "./BacklogPanel";
import { PlanColumn, STAFF_DRAGGABLE_PREFIX } from "./PlanColumn";
import type { Plan, PlanAppointment } from "../schemas";
import { isPlanSent } from "../schemas";
import type { AppointmentRow } from "@/src/features/appointments/schemas";
import type { BacklogAppointment } from "./BacklogPanel";
import {
  addAppointmentToPlan,
  removeAppointmentFromPlan,
  addStaffToPlan,
  removeStaffFromPlan,
  copyPlan,
} from "../api";
import { toastError, toastSuccess } from "@/lib/toast";

export type WithSentGuardFn = (
  planIds: number[],
  op: (idMap: Map<number, number>) => Promise<void>
) => Promise<void>;

type ScheduleBoardProps = {
  planDate: string;
  plans: Plan[];
  allAppointments: AppointmentRow[];
  backlogAppointments: BacklogAppointment[];
  serviceOptions: { value: string; label: string }[];
  serviceFilter: string[];
  onServiceFilterChange: (next: string[]) => void;
  appointmentsLoading?: boolean;
  onPlansChange: () => Promise<void> | void;
  refetchPlans: () => Promise<{ data?: Plan[] }>;
};

export function ScheduleBoard({
  planDate,
  plans,
  allAppointments,
  backlogAppointments,
  serviceOptions,
  serviceFilter,
  onServiceFilterChange,
  appointmentsLoading,
  onPlansChange,
  refetchPlans,
}: ScheduleBoardProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  /**
   * Guard that auto-copies plans for the date when any involved plan is sent,
   * then re-applies the operation on the new copies using remapped plan IDs.
   *
   * After copy_schedule_plan runs:
   *   - Original plans become valid=false (excluded from the query)
   *   - New copies have the same team numbers but new plan_ids
   *   - New copies only include incomplete appointments (app_status_id IN (1,2))
   *
   * After refetchPlans() every plan returned is therefore a fresh unsent copy,
   * so matching by team number reliably identifies the right target plan.
   */
  const withSentGuard: WithSentGuardFn = React.useCallback(
    async (involvedPlanIds, op) => {
      const involvedPlans = involvedPlanIds
        .map((id) => plans.find((p) => p.plan_id === id))
        .filter((p): p is Plan => p !== undefined);

      if (involvedPlans.some(isPlanSent)) {
        await copyPlan(planDate);
        const result = await refetchPlans();
        const newPlans = result.data ?? [];

        const planIdMap = new Map<number, number>();
        for (const orig of involvedPlans) {
          // All returned plans are now unsent copies; match by team number.
          const copy = newPlans.find((p) => p.team === orig.team);
          planIdMap.set(orig.plan_id, copy?.plan_id ?? orig.plan_id);
        }
        for (const id of involvedPlanIds) {
          if (!planIdMap.has(id)) planIdMap.set(id, id);
        }

        await op(planIdMap);
        toastSuccess(
          "Plans copied — your change was applied to the new copy."
        );
      } else {
        await op(new Map(involvedPlanIds.map((id) => [id, id])));
      }
    },
    [plans, planDate, refetchPlans]
  );

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // Backlog appointment → plan column
    if (activeIdStr.startsWith("backlog-")) {
      const appointmentId = Number(activeIdStr.replace("backlog-", ""));
      if (overIdStr.startsWith("plan-")) {
        const planId = Number(overIdStr.replace("plan-", ""));
        try {
          await withSentGuard([planId], async (m) => {
            await addAppointmentToPlan(m.get(planId)!, appointmentId);
          });
          onPlansChange();
        } catch (err) {
          toastError(err instanceof Error ? err.message : "Add appointment failed", {
            code: "Add Appointment",
          });
        }
      }

    // Plan appointment → backlog (remove from plan)
    } else if (activeIdStr.startsWith("plan-") && overIdStr === BACKLOG_DROPPABLE) {
      const [planIdStr, appointmentIdStr] = activeIdStr.replace("plan-", "").split("-");
      const planId = Number(planIdStr);
      const appointmentId = Number(appointmentIdStr);
      try {
        await withSentGuard([planId], async (m) => {
          await removeAppointmentFromPlan(m.get(planId)!, appointmentId);
        });
        onPlansChange();
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Remove appointment failed", {
          code: "Remove Appointment",
        });
      }

    // Plan appointment → different plan column (cross-plan move)
    } else if (activeIdStr.startsWith("plan-") && overIdStr.startsWith("plan-")) {
      const [srcPlanIdStr, srcApptIdStr] = activeIdStr.replace("plan-", "").split("-");
      const destPlanId = Number(overIdStr.replace("plan-", ""));
      const appointmentId = Number(srcApptIdStr);
      const srcPlanId = Number(srcPlanIdStr);
      if (srcPlanId !== destPlanId) {
        try {
          await withSentGuard([srcPlanId, destPlanId], async (m) => {
            await removeAppointmentFromPlan(m.get(srcPlanId)!, appointmentId);
            await addAppointmentToPlan(m.get(destPlanId)!, appointmentId);
          });
          onPlansChange();
        } catch (err) {
          toastError(err instanceof Error ? err.message : "Move appointment failed", {
            code: "Move Appointment",
          });
        }
      }

    // Staff chip → plan column (move staff between teams)
    } else if (activeIdStr.startsWith(STAFF_DRAGGABLE_PREFIX) && overIdStr.startsWith("plan-")) {
      const [, srcPlanIdStr, userIdStr] = activeIdStr.split("-");
      const srcPlanId = Number(srcPlanIdStr);
      const userId = Number(userIdStr);
      const destPlanId = Number(overIdStr.replace("plan-", ""));
      if (srcPlanId !== destPlanId) {
        try {
          await withSentGuard([srcPlanId, destPlanId], async (m) => {
            await removeStaffFromPlan(m.get(srcPlanId)!, userId);
            await addStaffToPlan(m.get(destPlanId)!, userId);
          });
          onPlansChange();
        } catch (err) {
          toastError(err instanceof Error ? err.message : "Move staff failed", {
            code: "Move Staff",
          });
        }
      }
    }
  };

  const activeAppointment = React.useMemo(() => {
    if (!activeId) return null;
    if (activeId.startsWith("backlog-")) {
      const aid = Number(activeId.replace("backlog-", ""));
      return backlogAppointments.find((a) => a.planAppointmentId === aid) ?? null;
    }
    if (activeId.startsWith("plan-")) {
      const [, appointmentIdStr] = activeId.replace("plan-", "").split("-");
      const aid = Number(appointmentIdStr);
      for (const plan of plans) {
        const pa = plan.appointments.find((a) => a.appointment_id === aid);
        if (pa) return pa;
      }
    }
    return null;
  }, [activeId, backlogAppointments, plans]);

  const activeStaff = React.useMemo(() => {
    if (!activeId || !activeId.startsWith(STAFF_DRAGGABLE_PREFIX)) return null;
    const [, planIdStr, userIdStr] = activeId.split("-");
    const planId = Number(planIdStr);
    const userId = Number(userIdStr);
    const plan = plans.find((p) => p.plan_id === planId);
    const member = plan?.staff.find((s) => s.user_id === userId);
    return member
      ? { userId, name: member.staff_info?.name ?? String(userId) }
      : null;
  }, [activeId, plans]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: {
          onDragStart({ active }) {
            return `Picked up draggable item ${active.id}.`;
          },
          onDragOver({ active, over }) {
            return over
              ? `Draggable item ${active.id} is over droppable area ${over.id}.`
              : `Draggable item ${active.id} is no longer over a droppable area.`;
          },
          onDragEnd({ active, over }) {
            return over
              ? `Dropped draggable item ${active.id} on droppable area ${over.id}.`
              : `Draggable item ${active.id} was dropped.`;
          },
          onDragCancel({ active }) {
            return `Dragging was cancelled. Draggable item ${active.id} was dropped.`;
          },
        },
      }}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        <BacklogPanel
          appointments={backlogAppointments}
          serviceOptions={serviceOptions}
          serviceFilter={serviceFilter}
          onServiceFilterChange={onServiceFilterChange}
          isLoading={appointmentsLoading}
        />
        <div className="flex gap-4 flex-1 min-w-0">
          {plans.map((plan) => (
            <PlanColumn
              key={plan.plan_id}
              plan={plan}
              plans={plans}
              allAppointments={allAppointments}
              onUpdate={onPlansChange}
              isSent={isPlanSent(plan)}
              withSentGuard={withSentGuard}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeAppointment ? (
          <DragOverlayItem item={activeAppointment} />
        ) : activeStaff ? (
          <div className="rounded border px-3 py-2 text-sm bg-background shadow-lg opacity-90">
            {activeStaff.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DragOverlayItem({
  item,
}: {
  item: BacklogAppointment | PlanAppointment;
}) {
  const isBacklog = "planAppointmentId" in item;
  const planAppointmentId = isBacklog ? item.planAppointmentId : item.appointment_id;
  const propName =
    (item as PlanAppointment).appointment_info?.property_info?.property_name ??
    (item as BacklogAppointment).property_info?.property_name ??
    `#${planAppointmentId}`;
  const serviceName =
    (item as PlanAppointment).appointment_info?.service?.service_name ??
    (item as BacklogAppointment).service_info?.name ??
    "";
  const timeStr =
    (item as PlanAppointment).appointment_info?.service_time ??
    (item as BacklogAppointment).departure_time ??
    "";

  return (
    <div className="rounded border p-2 text-sm bg-background shadow-lg opacity-90 w-56">
      <div className="font-medium truncate">{propName}</div>
      <div className="text-xs text-muted-foreground truncate">
        {serviceName}
        {timeStr ? ` · ${String(timeStr).slice(0, 16)}` : ""}
      </div>
    </div>
  );
}
