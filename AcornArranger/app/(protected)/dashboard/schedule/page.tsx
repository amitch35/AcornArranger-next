"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { InfoTooltip } from "@/components/InfoTooltip";
import { useNumericInput } from "@/lib/hooks/useNumericInput";
import {
  AFFINITY_LOOKBACK_BOUNDS,
  AFFINITY_WEIGHT_BOUNDS,
  ENGINE_LABELS,
  PLAN_BUILD_DEFAULTS,
  ROUTING_TYPE_LABELS,
  TEAM_SHAPE_BOUNDS,
  type PlanBuildEngine,
  type PlanBuildOptions,
} from "@/src/features/plans/schemas";
import {
  fetchPlans,
  buildPlan,
  copyPlan,
  addPlan,
  sendPlan,
  planApiToastProps,
} from "@/src/features/plans/api";
import { toastError } from "@/lib/toast";
import { ScheduleBoard } from "@/src/features/plans/components/ScheduleBoard";
import { toBacklogAppointments } from "@/src/features/plans/components/BacklogPanel";
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
  const queryClient = useQueryClient();

  // Invalidate the backlog whenever a mutation changes which appointments are
  // planned. The backlog query keys off (planDate, serviceFilter) and uses the
  // server-side `excludePlanned=true` flag, which reads from
  // `planned_appointment_ids`. After build/copy/add, that view's rows change,
  // so any stale cache must be dropped to keep the unscheduled list in sync
  // with the schedule board.
  const invalidateBacklog = React.useCallback(
    (date: string) => {
      queryClient.invalidateQueries({
        queryKey: ["appointments-backlog", date],
      });
    },
    [queryClient]
  );

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
  const [engine, setEngine] = React.useState<PlanBuildEngine>(
    PLAN_BUILD_DEFAULTS.engine
  );

  // All numeric build options live in `useNumericInput` so the user can
  // freely clear and retype values without the field snapping back to the
  // default mid-edit. Required fields (cleaning window, max hours, both
  // affinity lookbacks) revert to the default on blur if left empty;
  // optional fields (target staff count, num teams, target team size) leave
  // the field empty when blurred (which the build options serialize as
  // `undefined`, i.e. "auto/default").
  const cleaningWindow = useNumericInput({
    initialValue: PLAN_BUILD_DEFAULTS.cleaning_window,
    fallback: PLAN_BUILD_DEFAULTS.cleaning_window,
  });
  const maxHours = useNumericInput({
    initialValue: PLAN_BUILD_DEFAULTS.max_hours,
    fallback: PLAN_BUILD_DEFAULTS.max_hours,
  });
  const targetStaffCount = useNumericInput({
    initialValue: PLAN_BUILD_DEFAULTS.target_staff_count,
    integer: true,
  });
  const propertyAffinityLookback = useNumericInput({
    initialValue: PLAN_BUILD_DEFAULTS.property_affinity_lookback_days,
    fallback: PLAN_BUILD_DEFAULTS.property_affinity_lookback_days,
    bounds: AFFINITY_LOOKBACK_BOUNDS.property,
    integer: true,
  });
  const pairingAffinityLookback = useNumericInput({
    initialValue: PLAN_BUILD_DEFAULTS.pairing_affinity_lookback_days,
    fallback: PLAN_BUILD_DEFAULTS.pairing_affinity_lookback_days,
    bounds: AFFINITY_LOOKBACK_BOUNDS.pairing,
    integer: true,
  });
  // Affinity weight knobs. Min = 0 disables the corresponding Tier 2 signal
  // entirely; we let the user clear the field while editing but blur snaps
  // back to the project default rather than to 0 so disabling stays
  // intentional. Allowing decimals so the user can fine-tune (e.g. 2.5).
  const propertyAffinityWeight = useNumericInput({
    initialValue: PLAN_BUILD_DEFAULTS.property_affinity_weight_minutes,
    fallback: PLAN_BUILD_DEFAULTS.property_affinity_weight_minutes,
    bounds: AFFINITY_WEIGHT_BOUNDS.property_minutes,
  });
  const chemistryWeight = useNumericInput({
    initialValue: PLAN_BUILD_DEFAULTS.chemistry_weight,
    fallback: PLAN_BUILD_DEFAULTS.chemistry_weight,
    bounds: AFFINITY_WEIGHT_BOUNDS.chemistry,
  });
  // Optional team-shape overrides. Empty (undefined) lets the sidecar
  // auto-derive (work-minutes / cleaning_window, capped by leads) for legacy
  // parity. Setting either bypasses the lead cap and lets the heuristic
  // promote senior housekeepers to ad-hoc leads for days where
  // leads-in-training are scheduled but their `can_lead_team` flag has not
  // flipped yet.
  const numTeams = useNumericInput({
    initialValue: PLAN_BUILD_DEFAULTS.num_teams,
    bounds: TEAM_SHAPE_BOUNDS.num_teams,
    integer: true,
  });
  const targetTeamSize = useNumericInput({
    initialValue: PLAN_BUILD_DEFAULTS.target_team_size,
    bounds: TEAM_SHAPE_BOUNDS.target_team_size,
    integer: true,
  });

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

  // Fetch all appointments for the date (status 1,2 - not cancelled). Used by
  // build-options helpers (OmissionsSelect, the plan-appointment popover) that
  // need to see every appointment for the day, including ones already planned.
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

  // Fetch the backlog directly via the server-side `excludePlanned` filter. Kept
  // separate from `allAppointments` so the service filter can be pushed down to
  // the API, and so planned appointments stay available to build options.
  const { data: backlogData, isLoading: backlogLoading } = useQuery({
    queryKey: ["appointments-backlog", planDate, backlogServiceFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: planDate,
        dateTo: planDate,
        statusIds: "1,2",
        excludePlanned: "true",
        pageSize: "200",
      });
      if (backlogServiceFilter.length > 0) {
        params.set("serviceIds", backlogServiceFilter.join(","));
      }
      const res = await fetch(`/api/appointments?${params}`);
      if (!res.ok) throw new Error("Failed to load backlog");
      return res.json() as Promise<{ items: AppointmentRow[]; total: number }>;
    },
  });

  const backlogAppointments = React.useMemo(
    () => toBacklogAppointments(backlogData?.items ?? []),
    [backlogData]
  );

  // Fetch Homebase shifts for the selected date (single-day range)
  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ["shifts", planDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: planDate,
        dateTo: planDate,
      });
      const res = await fetch(`/api/shifts?${params}`);
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
      // Required numeric fields fall back to the default if the user has
      // mid-edit-cleared the input (the field will also snap back on blur).
      cleaning_window:
        cleaningWindow.value ?? PLAN_BUILD_DEFAULTS.cleaning_window,
      max_hours: maxHours.value ?? PLAN_BUILD_DEFAULTS.max_hours,
      target_staff_count: targetStaffCount.value,
      engine,
      property_affinity_lookback_days:
        propertyAffinityLookback.value ??
        PLAN_BUILD_DEFAULTS.property_affinity_lookback_days,
      pairing_affinity_lookback_days:
        pairingAffinityLookback.value ??
        PLAN_BUILD_DEFAULTS.pairing_affinity_lookback_days,
      property_affinity_weight_minutes:
        propertyAffinityWeight.value ??
        PLAN_BUILD_DEFAULTS.property_affinity_weight_minutes,
      chemistry_weight:
        chemistryWeight.value ?? PLAN_BUILD_DEFAULTS.chemistry_weight,
      num_teams: numTeams.value,
      target_team_size: targetTeamSize.value,
    }),
    [
      availableStaff,
      services,
      omissions,
      routingType,
      cleaningWindow.value,
      maxHours.value,
      targetStaffCount.value,
      engine,
      propertyAffinityLookback.value,
      pairingAffinityLookback.value,
      propertyAffinityWeight.value,
      chemistryWeight.value,
      numTeams.value,
      targetTeamSize.value,
    ]
  );

  const buildMutation = useMutation({
    mutationFn: () => buildPlan(planDate, buildOptions),
    onSuccess: () => {
      refetchPlans();
      invalidateBacklog(planDate);
      setBuildOptionsOpen(false);
    },
    onError: (err) => {
      const { message, description } = planApiToastProps(err, "Build failed");
      toastError(message, { code: "Build", description });
    },
  });

  const copyMutation = useMutation({
    mutationFn: () => copyPlan(planDate),
    onSuccess: () => {
      refetchPlans();
      invalidateBacklog(planDate);
    },
    onError: (err) => {
      const { message, description } = planApiToastProps(err, "Copy failed");
      toastError(message, { code: "Copy", description });
    },
  });

  const addMutation = useMutation({
    mutationFn: () => addPlan(planDate),
    onSuccess: () => {
      refetchPlans();
      invalidateBacklog(planDate);
    },
    onError: (err) => {
      const { message, description } = planApiToastProps(err, "Add plan failed");
      toastError(message, { code: "Add Plan", description });
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => sendPlan(planDate),
    onSuccess: () => {
      refetchPlans();
    },
    onError: (err) => {
      const { message, description } = planApiToastProps(err, "Send failed");
      toastError(message, { code: "Send", description });
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

      {/* 1. Date picker */}
      <DatePicker
        label="Date"
        value={planDateAsDate}
        onChange={(date) => {
          if (date) setPlanDate(formatDateToLocal(date));
        }}
      />

      {/* 2. Collapsible Build Options */}
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

            <div className="space-y-2">
              <Label htmlFor="engine" className="flex items-center gap-1.5">
                Engine
                <InfoTooltip label="Engine info">
                  <p>
                    Both engines essentially operate in two stages: team formation and routing.
                  </p>
                  <p>
                    <strong>Sidecar:</strong> VRPTW OR-Tools sidecar with configurable
                    affinity biasing in both stages.
                  </p>
                  <p>
                    <strong>Legacy:</strong> the original{" "}
                    <code>build_schedule_plan</code> procedure.
                  </p>
                </InfoTooltip>
              </Label>
              <select
                id="engine"
                className="flex h-9 w-full max-w-sm rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={engine}
                onChange={(e) =>
                  setEngine(e.target.value as PlanBuildEngine)
                }
              >
                {Object.entries(ENGINE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {engine === "vrptw" ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="property-affinity-lookback"
                    className="flex items-center gap-1.5"
                  >
                    Property Affinity Lookback (days)
                    <InfoTooltip label="Property Affinity Lookback info">
                      <p>
                        How far back to score staff ↔ property assignments.
                      </p>
                      <p>Wider window = more stable signal.</p>
                    </InfoTooltip>
                  </Label>
                  <Input
                    id="property-affinity-lookback"
                    type="number"
                    min={AFFINITY_LOOKBACK_BOUNDS.property.min}
                    max={AFFINITY_LOOKBACK_BOUNDS.property.max}
                    step={1}
                    value={propertyAffinityLookback.text}
                    onChange={propertyAffinityLookback.onChange}
                    onBlur={propertyAffinityLookback.onBlur}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="property-affinity-weight"
                    className="flex items-center gap-1.5"
                  >
                    Property Affinity Weight (min)
                    <InfoTooltip label="Property Affinity Weight info">
                      <p>
                        How strongly staff ↔ property history discounts a
                        teams route time, in synthetic minutes.
                      </p>
                      <p>
                        Higher = the solver is more likely to send a
                        "specialist team" to their most commonly assigned properties even if
                        travel is a bit longer.
                      </p>
                      <p>
                        <strong>Set to 0 to disable</strong> property
                        affinity entirely.
                      </p>
                    </InfoTooltip>
                  </Label>
                  <Input
                    id="property-affinity-weight"
                    type="number"
                    min={AFFINITY_WEIGHT_BOUNDS.property_minutes.min}
                    max={AFFINITY_WEIGHT_BOUNDS.property_minutes.max}
                    step={0.5}
                    value={propertyAffinityWeight.text}
                    onChange={propertyAffinityWeight.onChange}
                    onBlur={propertyAffinityWeight.onBlur}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="pairing-affinity-lookback"
                    className="flex items-center gap-1.5"
                  >
                    Pairing Affinity Lookback (days)
                    <InfoTooltip label="Pairing Affinity Lookback info">
                      <p>
                        How far back to score staff pairings for team
                        formation.
                      </p>
                      <p>
                        Shorter default than property affinity because staff
                        turnover makes older pairings stale.
                      </p>
                    </InfoTooltip>
                  </Label>
                  <Input
                    id="pairing-affinity-lookback"
                    type="number"
                    min={AFFINITY_LOOKBACK_BOUNDS.pairing.min}
                    max={AFFINITY_LOOKBACK_BOUNDS.pairing.max}
                    step={1}
                    value={pairingAffinityLookback.text}
                    onChange={pairingAffinityLookback.onChange}
                    onBlur={pairingAffinityLookback.onBlur}
                  />
                </div>


                <div className="space-y-2">
                  <Label
                    htmlFor="chemistry-weight"
                    className="flex items-center gap-1.5"
                  >
                    Chemistry Weight
                    <InfoTooltip label="Chemistry Weight info">
                      <p>
                        How strongly historical lead ↔ member co-team
                        chemistry biases team formation.
                      </p>
                      <p>
                        Higher = prefers pairing staff who
                        worked together more within the lookback window; team composition stays close
                        to recent precedents.
                      </p>
                      <p>
                        <strong>Set to 0 to disable</strong> pair chemistry
                        entirely.
                      </p>
                    </InfoTooltip>
                  </Label>
                  <Input
                    id="chemistry-weight"
                    type="number"
                    min={AFFINITY_WEIGHT_BOUNDS.chemistry.min}
                    max={AFFINITY_WEIGHT_BOUNDS.chemistry.max}
                    step={0.5}
                    value={chemistryWeight.text}
                    onChange={chemistryWeight.onChange}
                    onBlur={chemistryWeight.onBlur}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="num-teams"
                    className="flex items-center gap-1.5"
                  >
                    Number of Teams (optional)
                    <InfoTooltip label="Number of Teams info">
                      <p>Force an exact team count.</p>
                      <p>
                        Bypasses the lead cap and promotes housekeepers to
                        ad-hoc leads if needed.
                      </p>
                      <p>Wins over Target Team Size when both are set.</p>
                    </InfoTooltip>
                  </Label>
                  <Input
                    id="num-teams"
                    type="number"
                    min={TEAM_SHAPE_BOUNDS.num_teams.min}
                    max={TEAM_SHAPE_BOUNDS.num_teams.max}
                    step={1}
                    placeholder="Auto"
                    value={numTeams.text}
                    onChange={numTeams.onChange}
                    onBlur={numTeams.onBlur}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="target-team-size"
                    className="flex items-center gap-1.5"
                  >
                    Target Team Size (optional)
                    <InfoTooltip label="Target Team Size info">
                      <p>Soft staff-per-team target.</p>
                      <p>
                        The sidecar derives the team count from available
                        cleaners and bypasses the lead cap to honor it.
                      </p>
                      <p>Ignored when Number of Teams is set.</p>
                    </InfoTooltip>
                  </Label>
                  <Input
                    id="target-team-size"
                    type="number"
                    min={TEAM_SHAPE_BOUNDS.target_team_size.min}
                    max={TEAM_SHAPE_BOUNDS.target_team_size.max}
                    step={1}
                    placeholder="Auto"
                    value={targetTeamSize.text}
                    onChange={targetTeamSize.onChange}
                    onBlur={targetTeamSize.onBlur}
                  />
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Routing Type only feeds the legacy build_schedule_plan
                  RPC. The VRPTW sidecar pins start = end = office, so the
                  field is hidden when the sidecar engine is selected. */}
              {engine === "legacy" ? (
                <div className="space-y-2">
                  <Label
                    htmlFor="routing-type"
                    className="flex items-center gap-1.5"
                  >
                    Routing Type
                    <InfoTooltip label="Routing Type info">
                      <p>
                        Determines the start and end nodes used in the
                        Traveling Salesperson routing algorithm.
                      </p>
                    </InfoTooltip>
                  </Label>
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
              ) : null}

              <div className="space-y-2">
                <Label
                  htmlFor="cleaning-window"
                  className="flex items-center gap-1.5"
                >
                  Cleaning Window
                  <InfoTooltip label="Cleaning Window info">
                    <p>
                      Assumed cleaning window (in hours) used to estimate
                      how many cleaners are needed for the day.
                    </p>
                    <p>Lower the value to schedule more housekeepers.</p>
                    <p>
                      Increase to be more optimistic and potentially schedule
                      fewer housekeepers.
                    </p>
                  </InfoTooltip>
                </Label>
                <Input
                  id="cleaning-window"
                  type="number"
                  step={0.5}
                  value={cleaningWindow.text}
                  onChange={cleaningWindow.onChange}
                  onBlur={cleaningWindow.onBlur}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="max-hours"
                  className="flex items-center gap-1.5"
                >
                  Max Hours
                  <InfoTooltip label="Max Hours info">
                    <p>
                      Max total field hours before a team times out (does
                      not include travel to/from the office).
                    </p>
                    <p>
                      Lower this value if teams are getting too much to
                      handle.
                    </p>
                  </InfoTooltip>
                </Label>
                <Input
                  id="max-hours"
                  type="number"
                  step={0.5}
                  value={maxHours.text}
                  onChange={maxHours.onChange}
                  onBlur={maxHours.onBlur}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="target-staff"
                  className="flex items-center gap-1.5"
                >
                  Target Staff Count
                  <InfoTooltip label="Target Staff Count info">
                    <p>Target number of staff to schedule.</p>
                    <p>
                      Takes effect only if larger than the calculated
                      required number of staff.
                    </p>
                  </InfoTooltip>
                </Label>
                <Input
                  id="target-staff"
                  type="number"
                  placeholder="Optional"
                  value={targetStaffCount.text}
                  onChange={targetStaffCount.onChange}
                  onBlur={targetStaffCount.onBlur}
                />
              </div>
            </div>

          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* 3. Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
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

      {/* 4. Schedule board with shift status */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Schedule Board</h2>
          <ShiftStatusBar
            staffOnPlansWithoutShifts={shiftStatus.staffOnPlansWithoutShifts}
            shiftsNotOnPlans={shiftStatus.shiftsNotOnPlans}
            unmatchedShifts={shiftStatus.unmatchedShifts}
            isLoading={shiftsLoading}
          />
        </div>
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
          appointmentsLoading={appointmentsLoading || backlogLoading}
          onPlansChange={() => {
            refetchPlans();
            invalidateBacklog(planDate);
          }}
          refetchPlans={refetchPlans}
        />
      </div>
    </div>
  );
}