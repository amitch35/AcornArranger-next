"""Pydantic models for the sidecar's HTTP contract.

The Problem shape mirrors the JSONB payload returned by
`public.get_build_problem_payload`. Double-unit window tightening has already
been applied by the RPC (field: effective_next_arrival), so the sidecar does
not need to know about `rc_properties.double_unit` at all.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class OfficeLocation(BaseModel):
    lat: float
    lon: float


class ProblemInputs(BaseModel):
    available_staff: list[int]
    services: list[int]
    omissions: list[int] = Field(default_factory=list)
    cleaning_window: float = 6.0
    max_hours: float = 6.5
    target_staff_count: int | None = None
    office_location: OfficeLocation


class Appointment(BaseModel):
    appointment_id: int
    property_id: int
    property_name: str | None = None
    service: int | None = None
    app_status_id: int | None = None
    app_status: str | None = None
    arrival_time: datetime | None = None
    departure_time: datetime | None = None
    next_arrival_time: datetime | None = None
    effective_next_arrival: datetime | None = None
    turn_around: bool | None = None
    cancelled_date: datetime | None = None
    estimated_cleaning_mins: int | None = None
    address_id: int | None = None
    lat: float
    lon: float


class TravelTime(BaseModel):
    src_address_id: int
    dest_address_id: int
    travel_time_minutes: int


class Staff(BaseModel):
    user_id: int
    name: str | None = None
    role_id: int | None = None
    role_title: str | None = None
    can_clean: bool = True
    can_lead_team: bool = False
    priority: int | None = None


class Problem(BaseModel):
    plan_date: str
    generated_at: datetime | None = None
    inputs: ProblemInputs
    appointments: list[Appointment]
    travel_times: list[TravelTime] = Field(default_factory=list)
    staff: list[Staff]


class PropertyAffinityEntry(BaseModel):
    staff_id: int
    property_id: int
    score: float = Field(ge=0.0, le=1.0)


class PairingAffinityEntry(BaseModel):
    staff_a_id: int
    staff_b_id: int
    score: float = Field(ge=0.0, le=1.0)


class SolverOptions(BaseModel):
    time_limit_sec: int = Field(default=20, ge=1, le=120)
    # Property affinity contributes to routing cost: per-stop reward equals
    # `property_affinity_weight_minutes * max_over_team_of_scores`. Expressed in
    # minutes so the trade-off vs travel time is legible.
    property_affinity_weight_minutes: float = 2.0
    # Chemistry contributes to team-formation cost (pre-VRPTW). Weight is the
    # number of "synthetic minutes" worth of team-formation benefit a perfect
    # (score = 1.0) pair contributes. Default deliberately small so chemistry
    # biases composition without dominating travel-time routing.
    chemistry_weight: float = 2.0
    # When null, the number of teams is inferred from available staff and
    # target_staff_count. When set, it overrides that inference.
    num_teams: int | None = None
    target_team_size: int | None = None


class SolveRequest(BaseModel):
    problem: Problem
    property_affinity: list[PropertyAffinityEntry] = Field(default_factory=list)
    pairing_affinity: list[PairingAffinityEntry] = Field(default_factory=list)
    solver_opts: SolverOptions = Field(default_factory=SolverOptions)


class SolvedAppointment(BaseModel):
    appointment_id: int
    ord: int


class SolvedTeam(BaseModel):
    team: int
    staff_ids: list[int]
    lead_id: int | None = None
    appointment_ids: list[int]
    appointments: list[SolvedAppointment]
    travel_minutes: int
    service_minutes: int


class SolveDiagnostics(BaseModel):
    plan_date: str
    num_stops: int
    num_teams_requested: int
    num_teams_used: int
    dropped: list[int]
    total_travel_minutes: int
    objective: int | None = None
    solver_status: str
    midnight_stops_scrubbed: list[int] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class SolveResponse(BaseModel):
    plan: dict[str, Any]
    diagnostics: SolveDiagnostics
