"""Midnight-timestamp scrubbing for ResortCleaning artifacts.

ResortCleaning frequently delivers appointments with `arrival_time`,
`departure_time`, or `next_arrival_time` set to 00:00 local on the plan date.
Those are not real times - they are a data-entry fallback upstream - and
treating them as hard constraints causes the legacy builder to wedge. The
sidecar discards them and lets the team-wide cleaning window drive feasibility
instead. If ResortCleaning ever starts delivering real times reliably this
module can be reduced or removed.
"""

from __future__ import annotations

from datetime import datetime

from .types import Appointment


def _is_midnight(ts: datetime | None) -> bool:
    if ts is None:
        return False
    return (
        ts.hour == 0
        and ts.minute == 0
        and ts.second == 0
        and ts.microsecond == 0
    )


def scrub_midnight_times(appts: list[Appointment]) -> tuple[list[Appointment], list[int]]:
    """Return (scrubbed_appointments, list_of_scrubbed_appointment_ids).

    Departure and effective_next_arrival are the only fields the solver
    actually reads. We null them out when they equal 00:00 so downstream
    window logic falls back to the team-wide cleaning window.
    Arrival_time is left intact - the double-unit tightening in SQL may have
    already used an arrival value, and by that point it is already encoded in
    `effective_next_arrival`.
    """
    scrubbed_ids: list[int] = []
    out: list[Appointment] = []
    for a in appts:
        changed = False
        dep = a.departure_time
        eff = a.effective_next_arrival
        nxt = a.next_arrival_time
        if _is_midnight(dep):
            dep = None
            changed = True
        if _is_midnight(eff):
            eff = None
            changed = True
        if _is_midnight(nxt):
            nxt = None
            # nxt is emitted only for diagnostics; do not mark as scrubbed
            # solely on its basis. But still propagate the cleared value.
        if changed:
            scrubbed_ids.append(a.appointment_id)
        out.append(a.model_copy(update={
            "departure_time": dep,
            "effective_next_arrival": eff,
            "next_arrival_time": nxt,
        }))
    return out, scrubbed_ids
