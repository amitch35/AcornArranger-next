"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Wrench, Copy, Plus, Upload, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StaffPicker } from "@/src/features/staff/components/StaffPicker";
import { ServiceMultiSelect } from "@/components/filters/ServiceMultiSelect";
import { DatePicker } from "@/components/filters/DatePicker";
import { OmissionsSelect } from "@/src/features/plans/components/OmissionsSelect";
import {
  PLAN_BUILD_DEFAULTS,
  ROUTING_TYPE_LABELS,
  type PlanBuildOptions,
} from "@/src/features/plans/schemas";
import {
  fetchPlans,
  buildPlan,
  copyPlan,
  addPlan,
  sendPlan,
} from "@/src/features/plans/api";
import { toastError } from "@/lib/toast";
import { ScheduleBoard } from "@/src/features/plans/components/ScheduleBoard";
import {
  computeUnscheduled,
  type BacklogAppointment,
} from "@/src/features/plans/components/BacklogPanel";
import { ShiftStatusBar } from "@/src/features/plans/components/ShiftStatusBar";
import { HomebaseShiftSuggestions } from "@/src/features/plans/components/HomebaseShiftSuggestions";
import { useShiftStatus } from "@/src/features/plans/hooks/useShiftStatus";
import type { StaffShift } from "@/src/features/plans/schemas";
import type { AppointmentRow } from "@/src/features/appointments/schemas";

const BUILD_OPTIONS_STORAGE_KEY = "schedule-build-options-open";

function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateToLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function SchedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [planDate, setPlanDate] = React.useState(
    searchParams.get("date") ?? getTodayDateString()
  );
  const planDateAsDate = React.useMemo(
    () => parseDateString(planDate),
    [planDate]
  );
  // Always start closed so server and client render identically (no hydration
  // mismatch). The effect below immediately syncs the persisted preference on
  // the client after first mount.
  const [buildOptionsOpen, setBuildOptionsOpen] = React.useState(false);

  React.useEffect(() => {
    setBuildOptionsOpen(
      localStorage.getItem(BUILD_OPTIONS_STORAGE_KEY) !== "false"
    );
  }, []);

  React.useEffect(() => {
    localStorage.setItem(BUILD_OPTIONS_STORAGE_KEY, String(buildOptionsOpen));
  }, [buildOptionsOpen]);

  // Build options state (PlanBuildOptions)
  const [availableStaff, setAvailableStaff] = React.useState<number[]>(
    PLAN_BUILD_DEFAULTS.available_staff
  );
  const [services, setServices] = React.useState<number[]>(
    PLAN_BUILD_DEFAULTS.services
  );
  /** Appointment IDs to omit from the build (passed directly to the RPC) */
  const [omissions, setOmissions] = React.useState<number[]>([]);
  const [routingType, setRoutingType] = React.useState<1 | 2 | 3 | 4 | 5>(
    PLAN_BUILD_DEFAULTS.routing_type
  );
  const [cleaningWindow, setCleaningWindow] = React.useState(
    PLAN_BUILD_DEFAULTS.cleaning_window
  );
  const [maxHours, setMaxHours] = React.useState(PLAN_BUILD_DEFAULTS.max_hours);
  const [targetStaffCount, setTargetStaffCount] = React.useState<
    number | undefined
  >(PLAN_BUILD_DEFAULTS.target_staff_count);

  // Sync date to URL
  React.useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (planDate !== getTodayDateString()) {
      params.set("date", planDate);
    } else {
      params.delete("date");
    }
    const newUrl = params.toString()
      ? `/dashboard/schedule?${params}`
      : "/dashboard/schedule";
    router.replace(newUrl, { scroll: false });
  }, [planDate, router, searchParams]);

  // Fetch plans
  const {
    data: plans = [],
    isLoading: plansLoading,
    error: plansError,
    refetch: refetchPlans,
  } = useQuery({
    queryKey: ["plans", planDate],
    queryFn: () => fetchPlans(planDate),
  });

  // Backlog filter (service only)
  const [backlogServiceFilter, setBacklogServiceFilter] = React.useState<string[]>([]);
  const filterInitialized = React.useRef(false);

  // Fetch service options
  const { data: serviceOptions = [] } = useQuery({
    queryKey: ["service-options"],
    queryFn: async () => {
      const res = await fetch("/api/options/services");
      if (!res.ok) throw new Error("Failed to load services");
      const data = await res.json();
      return data.options.map((opt: { id: number; label: string }) => ({
        value: String(opt.id),
        label: opt.label,
      }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Auto-select default backlog service filters on first load
  React.useEffect(() => {
    if (filterInitialized.current || serviceOptions.length === 0) return;
    filterInitialized.current = true;
    const defaults = ["Departure Clean", "Office Cleaning"];
    const ids = serviceOptions
      .filter((o: { value: string; label: string }) => defaults.some((d) => o.label.toLowerCase().includes(d.toLowerCase())))
      .map((o: { value: string; label: string }) => o.value);
    if (ids.length > 0) setBacklogServiceFilter(ids);
  }, [serviceOptions]);

  // Fetch appointments for the date (status 1,2 - not cancelled)
  const { data: appointmentsData, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["appointments", planDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: planDate,
        dateTo: planDate,
        statusIds: "1,2",
        pageSize: "200",
      });
      const res = await fetch(`/api/appointments?${params}`);
      if (!res.ok) throw new Error("Failed to load appointments");
      return res.json() as Promise<{ items: AppointmentRow[]; total: number }>;
    },
  });

  const allAppointments = appointmentsData?.items ?? [];
  const backlogAppointments = React.useMemo(
    () => computeUnscheduled(allAppointments, plans, backlogServiceFilter),
    [allAppointments, plans, backlogServiceFilter]
  );

  // Fetch Homebase shifts for the selected date
  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ["shifts", planDate],
    queryFn: async () => {
      const res = await fetch(`/api/shifts?date=${planDate}`);
      if (!res.ok) return [] as StaffShift[];
      return res.json() as Promise<StaffShift[]>;
    },
  });

  const shiftStatus = useShiftStatus(plans, shifts);

  const serviceIds = React.useMemo(
    () => services.map(String),
    [services]
  );
  const setServiceIds = React.useCallback(
    (next: string[]) => setServices(next.map(Number)),
    []
  );

  const buildOptions: PlanBuildOptions = React.useMemo(
    () => ({
      available_staff: availableStaff,
      // Fall back to legacy defaults if the user has cleared all services or options
      // haven't loaded yet — the RPC requires at least one service to build correctly.
      services: services.length > 0 ? services : PLAN_BUILD_DEFAULTS.services,
      omissions,
      routing_type: routingType,
      cleaning_window: cleaningWindow,
      max_hours: maxHours,
      target_staff_count: targetStaffCount,
    }),
    [
      availableStaff,
      services,
      omissions,
      routingType,
      cleaningWindow,
      maxHours,
      targetStaffCount,
    ]
  );

  const buildMutation = useMutation({
    mutationFn: () => buildPlan(planDate, buildOptions),
    onSuccess: () => {
      refetchPlans();
      setBuildOptionsOpen(false);
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : "Build failed", {
        code: "Build",
      });
    },
  });

  const copyMutation = useMutation({
    mutationFn: () => copyPlan(planDate),
    onSuccess: () => {
      refetchPlans();
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : "Copy failed", {
        code: "Copy",
      });
    },
  });

  const addMutation = useMutation({
    mutationFn: () => addPlan(planDate),
    onSuccess: () => {
      refetchPlans();
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : "Add plan failed", {
        code: "Add Plan",
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => sendPlan(planDate),
    onSuccess: () => {
      refetchPlans();
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : "Send failed", {
        code: "Send",
      });
    },
  });

  const handleBuild = () => buildMutation.mutate();
  const handleCopy = () => copyMutation.mutate();
  const handleAddPlan = () => addMutation.mutate();
  const handleSend = () => sendMutation.mutate();

  const handleUseHomebaseStaff = React.useCallback(
    (userIds: number[]) => setAvailableStaff(userIds),
    []
  );

  const handleToggleHomebaseStaff = React.useCallback(
    (userId: number) =>
      setAvailableStaff((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      ),
    []
  );

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
        <p className="text-muted-foreground mt-2">
          Build and manage daily schedule plans
        </p>
      </div>

      {/* Date + Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-2">
          <Label>Schedule Date</Label>
          <DatePicker
            label="Date"
            value={planDateAsDate}
            onChange={(date) => {
              if (date) setPlanDate(formatDateToLocal(date));
            }}
          />
        </div>

        <div className="flex items-end gap-2">
          <Tooltip open={availableStaff.length === 0 ? undefined : false}>
            <TooltipTrigger asChild>
              <span tabIndex={availableStaff.length === 0 ? 0 : undefined}>
                <Button
                  onClick={handleBuild}
                  disabled={buildMutation.isPending || availableStaff.length === 0}
                >
                  {buildMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wrench className="h-4 w-4 mr-2" />
                  )}
                  Build
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Select staff in Build Options to enable
            </TooltipContent>
          </Tooltip>
          <Button
            variant="outline"
            onClick={handleCopy}
            disabled={copyMutation.isPending}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button
            variant="outline"
            onClick={handleAddPlan}
            disabled={addMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Plan
          </Button>
          <Button
            variant="outline"
            onClick={handleSend}
            disabled={sendMutation.isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
      </div>

      {/* Shift status vs Homebase */}
      <ShiftStatusBar
        staffOnPlansWithoutShifts={shiftStatus.staffOnPlansWithoutShifts}
        shiftsNotOnPlans={shiftStatus.shiftsNotOnPlans}
        unmatchedShifts={shiftStatus.unmatchedShifts}
        isLoading={shiftsLoading}
      />

      {/* Collapsible Build Options */}
      <Collapsible
        open={buildOptionsOpen}
        onOpenChange={setBuildOptionsOpen}
      >
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="gap-2">
            {buildOptionsOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Build Options
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="rounded-lg border p-4 mt-2 space-y-4">
            <div className="space-y-2">
              <Label>Available Staff</Label>
              <StaffPicker
                value={availableStaff}
                onChange={setAvailableStaff}
                canClean={true}
                statusIds={[1]}
              />
              {availableStaff.length === 0 && (
                <p className="text-xs text-destructive">None selected</p>
              )}
              <Separator className="my-2" />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Today&apos;s Homebase shifts — click to add to Available Staff
                </p>
                <HomebaseShiftSuggestions
                  matchedShifts={shiftStatus.matchedShifts}
                  availableStaff={availableStaff}
                  onUseHomebaseStaff={handleUseHomebaseStaff}
                  onToggleStaff={handleToggleHomebaseStaff}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Services</Label>
              <ServiceMultiSelect
                options={serviceOptions}
                value={serviceIds}
                onChange={setServiceIds}
                showBadges={false}
              />
            </div>

            <div className="space-y-2">
              <Label>Omissions</Label>
              <OmissionsSelect
                appointments={allAppointments}
                services={services}
                value={omissions}
                onChange={setOmissions}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="routing-type">Routing Type</Label>
                <select
                  id="routing-type"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={routingType}
                  onChange={(e) =>
                    setRoutingType(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
                  }
                >
                  {Object.entries(ROUTING_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cleaning-window">Cleaning Window</Label>
                <Input
                  id="cleaning-window"
                  type="number"
                  step={0.5}
                  value={cleaningWindow}
                  onChange={(e) =>
                    setCleaningWindow(Number(e.target.value) || 6)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-hours">Max Hours</Label>
                <Input
                  id="max-hours"
                  type="number"
                  step={0.5}
                  value={maxHours}
                  onChange={(e) => setMaxHours(Number(e.target.value) || 6.5)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-staff">Target Staff Count</Label>
                <Input
                  id="target-staff"
                  type="number"
                  placeholder="Optional"
                  value={targetStaffCount ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTargetStaffCount(v ? Number(v) : undefined);
                  }}
                />
              </div>
            </div>

          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Schedule board: backlog + plan columns */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Schedule Board
        </h2>
        {plansError ? (
          <p className="text-destructive mb-4">
            {plansError instanceof Error
              ? plansError.message
              : "Failed to load plans"}
          </p>
        ) : null}
        {plans.length === 0 && !plansLoading ? (
          <p className="text-muted-foreground mb-4">
            No plans for this date. Click Build to generate or Add Plan to create an empty plan.
          </p>
        ) : null}
        <ScheduleBoard
          planDate={planDate}
          plans={plans}
          allAppointments={allAppointments}
          backlogAppointments={backlogAppointments}
          serviceOptions={serviceOptions}
          serviceFilter={backlogServiceFilter}
          onServiceFilterChange={setBacklogServiceFilter}
          appointmentsLoading={appointmentsLoading}
          onPlansChange={() => { refetchPlans(); }}
          refetchPlans={refetchPlans}
        />
      </div>
    </div>
  );
}
