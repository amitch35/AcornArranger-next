-- VRPTW scheduler support RPCs.
-- Adds four functions used by the new Python sidecar build pipeline.
-- The legacy build_schedule_plan RPC is intentionally left untouched.
--
--   1. get_build_problem_payload   - emits the full problem as JSONB
--                                    (mirrors scripts/vrp-spike/export_day_fixture.sql)
--                                    with legacy double-unit window tightening applied
--                                    so the sidecar never handles the rc_properties.double_unit
--                                    relation directly. Emits effective_next_arrival per stop.
--   2. get_staff_property_affinity - historical staff<->property assignment score
--                                    (routing-stage soft cost input).
--   3. get_staff_pairing_affinity  - historical staff<->staff co-team score
--                                    (team-formation soft cost input).
--   4. commit_schedule_plan        - atomic writeback for a solved plan.

set check_function_bodies = off;


-- 1. Problem payload ---------------------------------------------------------

create or replace function public.get_build_problem_payload(
    p_plan_date         date,
    p_available_staff   bigint[],
    p_services          bigint[],
    p_omissions         bigint[] default '{}'::bigint[],
    p_cleaning_window   float default 6.0,
    p_max_hours         float default 6.5,
    p_target_staff_count integer default null,
    p_office_location   extensions.geometry default '0101000020E6100000D2DB44D213E95DC01D12088552AC4240'::extensions.geometry
)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'extensions'
as $func$
declare
    v_eligible_count integer;
    v_staff_count    integer;
    v_result         jsonb;
begin
    -- Input validation. PT4xx SQLSTATEs are translated by PostgREST into the
    -- matching HTTP status, with message/detail/hint surfaced verbatim. This
    -- mirrors the legacy build_schedule_plan contract so the Next.js layer can
    -- relay errors from either engine without special-casing.
    if p_plan_date is null then
        raise sqlstate 'PT400' using
            message = 'get_build_problem_payload: p_plan_date is required',
            detail  = 'get_build_problem_payload: stopped',
            hint    = 'Pass a valid plan date (YYYY-MM-DD) for the day to build.';
    end if;

    if p_available_staff is null or array_length(p_available_staff, 1) is null then
        raise sqlstate 'PT400' using
            message = 'get_build_problem_payload: no available staff supplied',
            detail  = 'get_build_problem_payload: stopped',
            hint    = 'Pick at least one staff member in the Available Staff selector before building.';
    end if;

    if p_services is null or array_length(p_services, 1) is null then
        raise sqlstate 'PT400' using
            message = 'get_build_problem_payload: no services supplied',
            detail  = 'get_build_problem_payload: stopped',
            hint    = 'Pick at least one service in Build Options before building.';
    end if;

    -- Eligibility pre-check (matches the legacy get_total_time filter).
    select count(*) into v_eligible_count
    from public.rc_appointments a
    where a.app_status_id in (1, 2)
      and a.service = any(p_services)
      and date(a.departure_time) = p_plan_date
      and (
            coalesce(array_length(p_omissions, 1), 0) = 0
            or not a.appointment_id = any(p_omissions)
          );

    if v_eligible_count = 0 then
        raise sqlstate 'PT400' using
            message = format(
                'No eligible appointments for %s.', p_plan_date
            ),
            detail  = 'get_build_problem_payload: stopped',
            hint    = 'Try widening services, removing omissions, or confirm ResortCleaning has appointments for this day.';
    end if;

    -- Cleaner-eligible staff pre-check.
    select count(*) into v_staff_count
    from public.rc_staff s
    join public.roles    r on r.id = s.role
    where s.user_id = any(p_available_staff)
      and r.can_clean = true;

    if v_staff_count = 0 then
        raise sqlstate 'PT400' using
            message = 'No available staff with cleaning role for this build.',
            detail  = 'get_build_problem_payload: stopped',
            hint    = 'Add at least one cleaner-eligible staff member to Available Staff.';
    end if;

    -- Build the full payload. Same CTE structure as the original sql function.
    with params as (
        select
            p_plan_date          as plan_date,
            p_available_staff    as available_staff,
            p_services           as services,
            coalesce(p_omissions, '{}'::bigint[]) as omissions,
            p_cleaning_window    as cleaning_window,
            p_max_hours          as max_hours,
            p_target_staff_count as target_staff_count,
            p_office_location    as office_geom
    ),
    -- Eligibility mirrors the legacy builder's get_total_time: status in (1, 2),
    -- service in services, departure_time on the plan date, not in omissions.
    eligible_appts as (
        select a.appointment_id, a.arrival_time, a.departure_time,
               a.next_arrival_time, a.turn_around, a.app_status_id,
               a.property as property_id, a.service, a.cancelled_date
        from public.rc_appointments a
        join params on true
        where a.app_status_id in (1, 2)
          and a.service = any(params.services)
          and date(a.departure_time) = params.plan_date
          and (params.omissions is null or not a.appointment_id = any(params.omissions))
    ),
    -- Double-unit window tightening: for any stop whose property has rc_properties.double_unit
    -- set, find the earliest arrival_time of any appointment on the plan_date whose property
    -- is in that double_unit array. That value tightens next_arrival_time to the earlier of
    -- the two. This mirrors the lookup used by build_schedule_plan lines 240-263 / 319-345,
    -- hoisted into the data-staging layer so the sidecar never sees the double_unit relation.
    double_unit_earliest as (
        select ea.appointment_id,
               (
                   select min(a2.arrival_time)
                   from public.rc_appointments a2
                   join public.rc_properties p2 on p2.properties_id = a2.property
                   where p2.properties_id = any(p.double_unit)
                     and date(a2.arrival_time) = params.plan_date
               ) as linked_min_arrival
        from eligible_appts ea
        join public.rc_properties p on p.properties_id = ea.property_id
        join params on true
        where p.double_unit is not null
          and array_length(p.double_unit, 1) > 0
    ),
    appointments_json as (
        select jsonb_agg(
            jsonb_build_object(
                'appointment_id',          ea.appointment_id,
                'property_id',             ea.property_id,
                'property_name',           p.property_name,
                'service',                 ea.service,
                'app_status_id',           ea.app_status_id,
                'app_status',              ask.status,
                'arrival_time',            ea.arrival_time,
                'departure_time',          ea.departure_time,
                'next_arrival_time',       ea.next_arrival_time,
                -- effective_next_arrival: use the earlier of next_arrival_time and any
                -- double-unit linked arrival_time. Null when both are absent; the sidecar
                -- then falls back to the team cleaning window.
                'effective_next_arrival',  case
                    when due.linked_min_arrival is null then ea.next_arrival_time
                    when ea.next_arrival_time is null   then due.linked_min_arrival
                    else least(ea.next_arrival_time, due.linked_min_arrival)
                end,
                'turn_around',             ea.turn_around,
                'cancelled_date',          ea.cancelled_date,
                'estimated_cleaning_mins', p.estimated_cleaning_mins,
                'address_id',              p.address,
                'lat',                     extensions.ST_Y(addr.location),
                'lon',                     extensions.ST_X(addr.location)
            )
            order by ea.appointment_id
        ) as appointments
        from eligible_appts ea
        join public.rc_properties  p    on p.properties_id = ea.property_id
        join public.rc_addresses   addr on addr.id = p.address
        left join public.appointment_status_key ask on ask.status_id = ea.app_status_id
        left join double_unit_earliest due on due.appointment_id = ea.appointment_id
    ),
    day_addrs as (
        select distinct p.address as address_id
        from eligible_appts ea
        join public.rc_properties p on p.properties_id = ea.property_id
        where p.address is not null
    ),
    travel_times_json as (
        select jsonb_agg(
            jsonb_build_object(
                'src_address_id',      tt.src_address_id,
                'dest_address_id',     tt.dest_address_id,
                'travel_time_minutes', tt.travel_time_minutes
            )
            order by tt.src_address_id, tt.dest_address_id
        ) as travel_times
        from public.travel_times tt
        where tt.src_address_id  in (select address_id from day_addrs)
          and tt.dest_address_id in (select address_id from day_addrs)
    ),
    staff_json as (
        select jsonb_agg(
            jsonb_build_object(
                'user_id',       s.user_id,
                'name',          s.name,
                'role_id',       s.role,
                'role_title',    r.title,
                'can_clean',     r.can_clean,
                'can_lead_team', r.can_lead_team,
                'priority',      r.priority
            )
            order by r.can_lead_team desc nulls last, r.priority nulls last, s.name
        ) as staff
        from public.rc_staff s
        join public.roles    r on r.id = s.role
        join params on true
        where s.user_id = any(params.available_staff)
          and r.can_clean = true
    ),
    inputs_json as (
        select jsonb_build_object(
            'available_staff',    to_jsonb(params.available_staff),
            'services',           to_jsonb(params.services),
            'omissions',          to_jsonb(params.omissions),
            'cleaning_window',    params.cleaning_window,
            'max_hours',          params.max_hours,
            'target_staff_count', params.target_staff_count,
            'office_location',    jsonb_build_object(
                'lat', extensions.ST_Y(params.office_geom),
                'lon', extensions.ST_X(params.office_geom)
            )
        ) as inputs
        from params
    )
    select jsonb_build_object(
        'plan_date',    (select plan_date from params),
        'generated_at', now(),
        'inputs',       (select inputs from inputs_json),
        'appointments', coalesce((select appointments from appointments_json), '[]'::jsonb),
        'travel_times', coalesce((select travel_times from travel_times_json), '[]'::jsonb),
        'staff',        coalesce((select staff       from staff_json),         '[]'::jsonb)
    ) into v_result;

    return v_result;
end;
$func$;

alter function public.get_build_problem_payload(
    date, bigint[], bigint[], bigint[], float, float, integer, extensions.geometry
) owner to postgres;


-- 2. Staff <-> property affinity --------------------------------------------

create or replace function public.get_staff_property_affinity(
    p_lookback_days integer default 180
)
returns table (
    staff_id    bigint,
    property_id bigint,
    score       numeric
)
language sql
stable
set search_path to 'public'
as $$
    with window_pairs as (
        select ps.staff_id,
               a.property                     as property_id,
               count(distinct sp.plan_date)   as pair_days
        from public.schedule_plans    sp
        join public.plan_staff        ps on ps.plan_id = sp.id
        join public.plan_appointments pa on pa.plan_id = sp.id
        join public.rc_appointments   a  on a.appointment_id = pa.appointment_id
        where sp.valid = true
          and ps.valid = true
          and pa.valid = true
          and sp.plan_date >= current_date - p_lookback_days
          and sp.plan_date <  current_date
          and ps.staff_id is not null
          and a.property  is not null
        group by ps.staff_id, a.property
    ),
    per_staff_max as (
        select staff_id, max(pair_days) as max_pair_days
        from window_pairs
        group by staff_id
    )
    select wp.staff_id,
           wp.property_id,
           -- Per-staff-max normalization so a high-volume staff's best property lands at
           -- 1.0 and the rest scale down. Mid-volume staff are not drowned out by top
           -- performers, which matters when the solver picks "does this team have a
           -- specialist for this property?" via max()-over-team at solve time.
           (wp.pair_days::numeric / greatest(psm.max_pair_days, 1))::numeric as score
    from window_pairs  wp
    join per_staff_max psm on psm.staff_id = wp.staff_id;
$$;

alter function public.get_staff_property_affinity(integer) owner to postgres;


-- 3. Staff <-> staff pairing affinity ---------------------------------------

create or replace function public.get_staff_pairing_affinity(
    p_lookback_days integer default 90
)
returns table (
    staff_a_id bigint,
    staff_b_id bigint,
    score      numeric
)
language sql
stable
set search_path to 'public'
as $$
    -- Symmetric, role-agnostic: score = "how natural is it to put these two on a team".
    -- Enforce staff_a_id < staff_b_id so each unordered pair appears exactly once.
    with pairs_per_day as (
        select sp.plan_date,
               a.staff_id as staff_a_id,
               b.staff_id as staff_b_id
        from public.schedule_plans sp
        join public.plan_staff a on a.plan_id = sp.id and a.valid
        join public.plan_staff b on b.plan_id = sp.id and b.valid
        where sp.valid = true
          and sp.plan_date >= current_date - p_lookback_days
          and sp.plan_date <  current_date
          and a.staff_id is not null
          and b.staff_id is not null
          and a.staff_id <  b.staff_id
    ),
    pair_counts as (
        select staff_a_id, staff_b_id, count(distinct plan_date) as days
        from pairs_per_day
        group by staff_a_id, staff_b_id
    ),
    staff_day_totals as (
        -- Max distinct days any one staff member appears in a pairing in the window.
        -- Used as the normalizing denominator so frequently-scheduled staff don't have
        -- every pairing they touch score close to 1.
        select staff_id, max(days) as max_days
        from (
            select staff_a_id as staff_id, days from pair_counts
            union all
            select staff_b_id as staff_id, days from pair_counts
        ) u
        group by staff_id
    )
    select pc.staff_a_id,
           pc.staff_b_id,
           -- Normalize against the busier of the two staff members so a person who
           -- appears on many teams doesn't push all their pairings near 1.
           (pc.days::numeric
              / greatest(greatest(coalesce(ma.max_days, 1), coalesce(mb.max_days, 1)), 1)
           )::numeric as score
    from pair_counts pc
    left join staff_day_totals ma on ma.staff_id = pc.staff_a_id
    left join staff_day_totals mb on mb.staff_id = pc.staff_b_id;
$$;

alter function public.get_staff_pairing_affinity(integer) owner to postgres;


-- 4. Atomic writeback for a solved plan --------------------------------------

create or replace function public.commit_schedule_plan(
    p_plan_date date,
    p_plan      jsonb
)
returns jsonb
language plpgsql
set search_path to 'public'
as $func$
declare
    v_team           jsonb;
    v_team_number    smallint;
    v_plan_id        bigint;
    v_plan_ids       bigint[] := '{}';
    v_staff_id       bigint;
    v_appt_id        bigint;
    v_ord            smallint;
    v_appt_entry     jsonb;
begin
    -- Validate inputs FIRST so a bad payload aborts before we touch existing rows.
    -- PT4xx SQLSTATEs propagate to PostgREST as the matching HTTP status with
    -- message/detail/hint preserved, mirroring legacy build_schedule_plan errors.
    if p_plan_date is null then
        raise sqlstate 'PT400' using
            message = 'commit_schedule_plan: p_plan_date is required',
            detail  = 'commit_schedule_plan: stopped before write',
            hint    = 'Pass a valid plan date (YYYY-MM-DD) for the day being rebuilt.';
    end if;

    if p_plan is null
       or p_plan->'teams' is null
       or jsonb_typeof(p_plan->'teams') <> 'array' then
        raise sqlstate 'PT400' using
            message = 'commit_schedule_plan: p_plan.teams is required and must be an array',
            detail  = 'commit_schedule_plan: stopped before write',
            hint    = 'The sidecar must return { plan: { teams: [...] } }. Toggle Engine to Legacy RPC in Build Options as a fallback.';
    end if;

    -- Invalidate any existing valid plans (and their children) for the date, matching
    -- the legacy build_schedule_plan's "replace the day wholesale" semantics.
    -- If a later raise aborts the function, this transaction rolls back so the
    -- existing plans are preserved.
    update public.plan_appointments pa
       set valid = false
      from public.schedule_plans sp
     where sp.id = pa.plan_id
       and sp.plan_date = p_plan_date
       and sp.valid = true;

    update public.plan_staff ps
       set valid = false
      from public.schedule_plans sp
     where sp.id = ps.plan_id
       and sp.plan_date = p_plan_date
       and sp.valid = true;

    update public.schedule_plans
       set valid = false
     where plan_date = p_plan_date
       and valid = true;

    for v_team in select * from jsonb_array_elements(p_plan->'teams')
    loop
        v_team_number := nullif(v_team->>'team', '')::smallint;
        if v_team_number is null then
            -- Fall back to 1-based position when the sidecar omits an explicit team number.
            v_team_number := coalesce(array_length(v_plan_ids, 1), 0) + 1;
        end if;

        insert into public.schedule_plans (plan_date, team, valid)
        values (p_plan_date, v_team_number, true)
        returning id into v_plan_id;

        v_plan_ids := v_plan_ids || v_plan_id;

        if v_team ? 'staff_ids' then
            for v_staff_id in
                select (s.value)::bigint
                from jsonb_array_elements_text(v_team->'staff_ids') s
            loop
                insert into public.plan_staff (plan_id, staff_id, valid)
                values (v_plan_id, v_staff_id, true);
            end loop;
        end if;

        v_ord := 1;
        if v_team ? 'appointment_ids' then
            for v_appt_id in
                select (s.value)::bigint
                from jsonb_array_elements_text(v_team->'appointment_ids') s
            loop
                insert into public.plan_appointments (plan_id, appointment_id, valid, ord)
                values (v_plan_id, v_appt_id, true, v_ord);
                v_ord := v_ord + 1;
            end loop;
        elsif v_team ? 'appointments' then
            -- Optional richer format: [{ "appointment_id": N, "ord": M }, ...]
            for v_appt_entry in
                select * from jsonb_array_elements(v_team->'appointments')
            loop
                insert into public.plan_appointments (plan_id, appointment_id, valid, ord)
                values (
                    v_plan_id,
                    (v_appt_entry->>'appointment_id')::bigint,
                    true,
                    coalesce(nullif(v_appt_entry->>'ord', '')::smallint, v_ord)
                );
                v_ord := v_ord + 1;
            end loop;
        end if;
    end loop;

    -- Guard against a payload whose teams array was non-empty but produced no
    -- writes (e.g. all teams skipped because they had no team number AND no
    -- staff_ids/appointment_ids). The raise rolls back the invalidations above.
    if coalesce(array_length(v_plan_ids, 1), 0) = 0 then
        raise sqlstate 'PT400' using
            message = 'commit_schedule_plan: no teams committed',
            detail  = 'commit_schedule_plan: rolled back, nothing to write',
            hint    = 'The solver returned a plan with zero usable teams. Inspect sidecar diagnostics or fall back to the Legacy RPC.';
    end if;

    return jsonb_build_object(
        'plan_date', p_plan_date,
        'plan_ids',  to_jsonb(v_plan_ids)
    );
end;
$func$;

alter function public.commit_schedule_plan(date, jsonb) owner to postgres;


-- Permissions: mirror the legacy RPC's access surface so `authorized_user` roles
-- (via Next.js `withMinRole`) can reach these over PostgREST.
-- grant execute on function public.get_build_problem_payload(
--     date, bigint[], bigint[], bigint[], float, float, integer, extensions.geometry
-- ) to anon, authenticated, service_role;

-- grant execute on function public.get_staff_property_affinity(integer)
--     to anon, authenticated, service_role;

-- grant execute on function public.get_staff_pairing_affinity(integer)
--     to anon, authenticated, service_role;

-- grant execute on function public.commit_schedule_plan(date, jsonb)
--     to anon, authenticated, service_role;
