set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_build_problem_payload(p_plan_date date, p_available_staff bigint[], p_services bigint[], p_omissions bigint[] DEFAULT '{}'::bigint[], p_cleaning_window double precision DEFAULT 6.0, p_max_hours double precision DEFAULT 6.5, p_target_staff_count integer DEFAULT NULL::integer, p_office_location extensions.geometry DEFAULT '0101000020E6100000D2DB44D213E95DC01D12088552AC4240'::extensions.geometry)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
    v_eligible_count integer;
    v_staff_count    integer;
    v_missing_count  integer;
    v_missing_list   text;
    v_result         jsonb;
begin
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

    -- Missing time estimate pre-check
    with eligible as (
        select distinct p.properties_id, p.property_name
        from public.rc_appointments a
        join public.rc_properties   p on p.properties_id = a.property
        where a.app_status_id in (1, 2)
          and a.service = any(p_services)
          and date(a.departure_time) = p_plan_date
          and (
                coalesce(array_length(p_omissions, 1), 0) = 0
                or not a.appointment_id = any(p_omissions)
              )
          and (
                p.estimated_cleaning_mins is null
                or p.estimated_cleaning_mins <= 0
              )
    )
    select
        count(*),
        string_agg(
            coalesce(nullif(trim(e.property_name), ''), '(unnamed property)')
                || ' (#' || e.properties_id::text || ')',
            ', '
            order by coalesce(e.property_name, ''), e.properties_id
        )
    into v_missing_count, v_missing_list
    from eligible e;

    if v_missing_count > 0 then
        raise sqlstate 'PT400' using
            message = format(
                '%s %s missing a cleaning estimate. Open the property settings and set %s before re-running Build.',
                v_missing_count,
                case when v_missing_count = 1 then 'property is'
                     else 'properties are' end,
                case when v_missing_count = 1 then 'it'
                     else 'them' end
            ),
            detail  = 'get_build_problem_payload: stopped',
            hint    = 'Missing estimate for: ' || v_missing_list;
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
    -- the two. This mirrors the lookup used by build_schedule_plan,
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
$function$
;


