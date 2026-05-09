set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.build_schedule_plan(available_staff bigint[], date_to_schedule date, office_location extensions.geometry, services bigint[], omissions bigint[], routing_type integer DEFAULT 1, cleaning_window double precision DEFAULT 6.0, max_hours double precision DEFAULT 8.0, target_staff_count integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  total_cleaning_time INTEGER := 0;
  total_travel_time INTEGER := 0;
  num_staff_needed INTEGER := 0;
  current_plan_id integer;
  travel_time INTEGER := 0;
  cleaning_time integer := 0;
  max_team_size integer := 0;
  appointment_order INTEGER[];
  appointment_source bigint;
  appointment_destination bigint;
  double_unit_ref bigint[];
  ordered_staff bigint[];
  team_makeups bigint[][]; 
  farthest_node bigint;
  num_teams integer := 0;
  starting_node bigint;
  ending_node bigint;
  available_staff_cnt integer;
  available_leads integer;
  num_scheduled_staff integer := 0;
  num_team_members integer := 0;
  earliest_checkout timestamptz; -- earliest departure_time found for given team's plan
  latest_checkin timestamptz; -- latest next_arrival_time (on same day) found for given team's plan
  checkout timestamptz;
  checkin timestamptz;
  minutes_spent  integer; -- tracking for number of minutes team will spend on travel and cleaning with current plan
BEGIN
  -- Get estimated total times for the day
  select f.total_cleaning_time, f.total_travel_time
  into total_cleaning_time, total_travel_time
  from public.get_total_time(date_to_schedule, office_location, services, omissions) as f;

  -- Determine number of housekeepers needed (using (default) 6 hour cleaning window as benchmark)
  num_staff_needed := greatest(ceil((total_cleaning_time + total_travel_time) / (cleaning_window * 60.0)), target_staff_count);

  -- Check if scheduling is necesarry
  if (num_staff_needed = 0) then
    RAISE sqlstate 'PT400' using
      message = concat('Scheduling unnecessary, total cleaning time --> ', total_cleaning_time, ', staff needed --> ', num_staff_needed),
      detail = 'build_schedule_plan: stopped',
      hint = 'Try adding services or removing appointments from the ommissions list. Also make sure the cleaning window is reasonable.';
    return;
  end if;

  Select count(user_id)
  into available_staff_cnt
  from public.rc_staff as s
  join public.roles as r on r.id = s.role
  where user_id = ANY(available_staff) and can_clean = true;

  -- raise exception 'Num Staff Needed --> % staff cnt --> %', num_staff_needed, available_staff_cnt;

  -- Check if enough available housekeepers
  if (available_staff_cnt < num_staff_needed) then
    RAISE sqlstate 'PT400' using
      message = concat('Not enough staff available who can clean, needed --> ', num_staff_needed, ', Available --> ', coalesce(array_length(available_staff, 1), 0), ', Available (who can clean) --> ', available_staff_cnt),
      detail = 'build_schedule_plan: failed',
      hint = 'Try adding to available staff or increasing the cleaning window';
    return;
  end if;

  -- Determine order of team assignemnt and available leads
  SELECT ARRAY_AGG(user_id)
  INTO ordered_staff
  FROM (
      SELECT s.user_id
      FROM public.rc_staff AS s
      JOIN public.roles AS r ON r.id = s.role
      WHERE s.user_id = ANY(available_staff) AND r.can_clean = true
      ORDER BY r.can_lead_team DESC, r.priority, RANDOM()
  ) AS lead_priority_ordered_users;

  Select count(user_id)
  into available_leads
  from public.rc_staff as s
  join public.roles as r on r.id = s.role
  where user_id = ANY(available_staff) and can_lead_team = true and can_clean = true;

  -- Make sure there is at least one lead to make a team
  if (available_leads < 1) then
    RAISE sqlstate 'PT400' using
      message = 'No leads available for schedule',
      detail = 'build_schedule_plan: failed',
      hint = 'Try adding a lead to available staff';
    return;
  end if;

  -- -- Initialize team makeups array
  num_teams := least(num_staff_needed, available_leads);
  max_team_size := ceil(array_length(ordered_staff,1) / (num_teams::float));
  team_makeups := ARRAY(
    SELECT ARRAY_FILL(NULL::bigint, ARRAY[max_team_size])
    FROM generate_series(1, num_teams)
  );

  -- raise exception 'Team Makeups Intitialized to --> % first element --> %', team_makeups, team_makeups[1:1];

  -- Determine team makeups
  FOR i IN 1..ceil(array_length(ordered_staff,1) / (num_teams::float)) LOOP
    FOR j in 1..num_teams loop
      IF (num_scheduled_staff < num_staff_needed) THEN
        -- Add lead to team makeup
        team_makeups[j][i] := ordered_staff[j+((i-1)*num_teams)];
        -- Increment number of scheduled staff
        num_scheduled_staff := num_scheduled_staff + 1;
      ELSE
        EXIT; -- Break if the required number of staff has been scheduled
      END IF;
    end loop;
    EXIT WHEN num_scheduled_staff >= num_staff_needed;
  END LOOP;

  -- raise exception 'Team Makeups Set to --> % first element --> %', team_makeups, team_makeups[1:1];

  -- Clear previous plans for this day
  update public.schedule_plans
  set valid = false
  where plan_date = date_to_schedule;

  -- For each team, add appointments to their schedule according to the farthest TSP method discussed until 8 hours would be exceeded (or if latest appointment checkin would be passed calculated with earliest appointment + time_spent)
  for i in 1..num_teams loop 
    -- Select Start and End nodes for TSP with routing_type
    select (
        SELECT a.appointment_id
        FROM public.rc_appointments AS a
        JOIN public.rc_properties AS p ON a.property = p.properties_id
        JOIN public.rc_addresses AS addr ON p.address = addr.id
        LEFT JOIN public.planned_appointment_ids as pa on pa.appointment_id = a.appointment_id
        WHERE a.app_status_id in (1, 2) 
          and a.service = ANY(services) 
          and DATE(a.departure_time) = date_to_schedule 
          and pa.appointment_id is null
          and (
            omissions IS NULL OR
            not a.appointment_id = ANY(omissions)
          )
        ORDER BY addr.location <-> office_location DESC
        LIMIT 1
      ) into farthest_node;
    
    select (
      case when routing_type = 1 then farthest_node -- Farthest to Office
        when routing_type = 2 then farthest_node    -- Farthest to Anywhere
        when routing_type = 3 then 1                -- Office to Farthest
        when routing_type = 4 then 1                -- Office to Anywhere
        when routing_type = 5 then 0                -- Start and end Anywhere
        else 0 -- Default to Start and end Anywhere
      end
    ) into starting_node;

    select (
      case when routing_type = 1 then 1           -- Farthest to Office
        when routing_type = 2 then 0              -- Farthest to Anywhere
        when routing_type = 3 then farthest_node  -- Office to Farthest
        when routing_type = 4 then 0              -- Office to Anywhere
        when routing_type = 5 then 0              -- Start and end Anywhere
        else 0 -- Default to Start and end Anywhere
      end
    ) into ending_node;

    -- Run Traveling Sales Person
    EXECUTE format(
      $format$
        SELECT ARRAY_AGG(node)
        FROM (
          SELECT distinct node, seq
          FROM extensions.pgr_TSPeuclidean(
            $tsp$
              WITH combined_locations AS (
                SELECT 1 as id, %1$L AS x, %2$L AS y
                UNION ALL
                SELECT a.appointment_id as id, ST_X(addr.location) AS x, ST_Y(addr.location) AS y
                FROM public.rc_appointments as a
                JOIN public.rc_properties as p ON a.property = p.properties_id
                JOIN public.rc_addresses as addr ON addr.id = p.address
                LEFT JOIN public.planned_appointment_ids as pa on pa.appointment_id = a.appointment_id and DATE(a.departure_time) = pa.plan_date
                WHERE a.app_status_id in (1, 2) 
                  and a.service = ANY(%3$L) 
                  and DATE(a.departure_time) = %4$L 
                  and pa.appointment_id is null
                  and (
                    %5$L IS NULL OR
                    not a.appointment_id = ANY(%5$L)
                  )
              )
              SELECT id, x, y FROM combined_locations;
            $tsp$, 
            %6$L,
            %7$L
          )
          order by seq
        ) as tsp_result
      $format$,
      ST_X(office_location), ST_Y(office_location), services, date_to_schedule, omissions, starting_node, ending_node
    ) INTO appointment_order;

    -- raise exception 'TSP Result Order --> %', appointment_order;

    -- Remove final (duplicate) value from list
    appointment_order := trim_array(appointment_order,1);

    -- Remove office from list to avoid scheduling it as an appointment
    appointment_order := array_remove(appointment_order, 1);

    -- raise exception 'TSP Result Order --> %', appointment_order;

    -- If less teams needed than expected exit and finish
    if appointment_order is null then
      insert into public.error_log (function_name, error_message)
      values ('build_schedule_plan', concat('Less teams needed than expected; num_staff_needed --> ', num_staff_needed, ', Teams Scheduled --> ', (i-1)));
      exit;
    end if;
    
    -- Initilaize trackers and assume the team can complete the first appointment
    num_team_members := (
      SELECT COUNT(*)
      FROM unnest(team_makeups[i:i]) AS staff
      WHERE staff IS NOT NULL
    );

    minutes_spent := ceil((
      select estimated_cleaning_mins 
      FROM public.rc_appointments a
      JOIN public.rc_properties p ON a.property = p.properties_id
      WHERE a.appointment_id = appointment_order[1]
      ) / num_team_members::float);

    select p.double_unit
    into double_unit_ref
    from public.rc_appointments as a 
    join public.rc_properties as p on a.property = p.properties_id 
    where a.appointment_id = appointment_order[1];

    -- Assign earliest_checkout and latest_checkin (being carful not to go past 4 if double unit has checkin and not past 6 after adding cleaning time to unit with no checking)
    select departure_time, (
      Case when double_unit_ref is not null then (
        CASE WHEN next_arrival_time is null or date(next_arrival_time) > date_to_schedule then coalesce(
          (
            select MIN(arrival_time) 
            from public.rc_appointments as a 
            join public.rc_properties as p on a.property = p.properties_id
            where a.app_status_id in (1, 2) and p.properties_id = any(double_unit_ref) and date(a.arrival_time) = date_to_schedule
          ),
          least(
            concat(date_to_schedule, ' 16:00:00+00')::timestamptz + (interval '1 minute' * minutes_spent), 
            concat(date_to_schedule, ' 18:00:00+00')::timestamptz
          )
        )
          else next_arrival_time
        end
        )
      else (
        CASE WHEN next_arrival_time is null then least(
            concat(date_to_schedule, ' 16:00:00+00')::timestamptz + (interval '1 minute' * minutes_spent), 
            concat(date_to_schedule, ' 18:00:00+00')::timestamptz
          )
          WHEN date(next_arrival_time) > date_to_schedule then least(
            concat(date_to_schedule, ' 16:00:00+00')::timestamptz + (interval '1 minute' * minutes_spent), 
            concat(date_to_schedule, ' 18:00:00+00')::timestamptz
          )
          else next_arrival_time
        end
      )
      end
    )
    into earliest_checkout, latest_checkin
    from public.rc_appointments
    where appointment_id = appointment_order[1];

    insert into public.schedule_plans (plan_date, team, valid)
    values (date_to_schedule, i, true)
    returning id into current_plan_id;

    insert into public.plan_staff (plan_id, staff_id, valid)
    select current_plan_id, staff, true
    from unnest(team_makeups[i:i]) as staff
    where staff is not null;
    
    insert into public.plan_appointments (plan_id, appointment_id, valid, ord)
    values (current_plan_id, appointment_order[1], true, 1);

    -- insert into public.error_log (function_name, error_message) -- DEBUG
    --     values ('build_schedule_plan', concat('Team ', i, ', Scheduled to 1 Appointments; minutes_spent = ', minutes_spent, ' earliest_checkout = ', earliest_checkout, ' latest_checkin = ', latest_checkin));

    FOR j IN 1..array_length(appointment_order, 1) - 1 LOOP -- -1 because pairs
      -- Get the source and destination appointment IDs
      appointment_source := appointment_order[j];
      appointment_destination := appointment_order[j + 1];

      cleaning_time := ceil((
        select estimated_cleaning_mins 
        FROM public.rc_appointments a
        JOIN public.rc_properties p ON a.property = p.properties_id
        WHERE a.appointment_id = appointment_destination
        ) / num_team_members::float
      );

      select departure_time, next_arrival_time
      into checkout, checkin
      from public.rc_appointments
      where appointment_id = appointment_destination;

      if (checkout < earliest_checkout) then
        earliest_checkout := checkout;
      end if;

      select p.double_unit
      into double_unit_ref
      from public.rc_appointments as a 
      join public.rc_properties as p on a.property = p.properties_id 
      where a.appointment_id = appointment_destination;

      -- Update latest checkin (use time it would take team to clean the unit to know how far past 4PM and accumulate up until 6 PM)
      select (
        case 
          when (checkin is not null and date(checkin) = date(date_to_schedule) and checkin > latest_checkin) then  checkin
          when double_unit_ref is null then greatest(latest_checkin, least(
            latest_checkin + (interval '1 minute' * cleaning_time), 
            concat(date_to_schedule, ' 18:00:00+00')::timestamptz
          ))
          when double_unit_ref is not null then greatest(
            latest_checkin, 
            coalesce(
              (
                select MIN(arrival_time) 
                from public.rc_appointments as a 
                join public.rc_properties as p on a.property = p.properties_id
                where a.app_status_id in (1, 2) and p.properties_id = any(double_unit_ref) and date(a.arrival_time) = date_to_schedule
              ),
              least(
                latest_checkin + (interval '1 minute' * cleaning_time), 
                concat(date_to_schedule, ' 18:00:00+00')::timestamptz
              )
            )
          )
          else latest_checkin
        end
      ) into latest_checkin;
      
      -- Fetch the travel time between the source and destination properties
      select coalesce((
        SELECT travel_time_minutes
        FROM public.travel_times
        WHERE src_address_id = (
          SELECT addr.id
          FROM public.rc_appointments a
          JOIN public.rc_properties p ON a.property = p.properties_id
          JOIN public.rc_addresses addr ON p.address = addr.id
          WHERE a.appointment_id = appointment_source
        )
        AND dest_address_id = (
          SELECT addr.id
          FROM public.rc_appointments a
          JOIN public.rc_properties p ON a.property = p.properties_id
          JOIN public.rc_addresses addr ON p.address = addr.id
          WHERE a.appointment_id = appointment_destination
        )
      ), 0) into travel_time;

      minutes_spent := minutes_spent + travel_time + cleaning_time;

      -- If team still spending less than 8 hours and time does not have them exceeding latest checkin
      if (minutes_spent < (max_hours * 60) and (earliest_checkout + (INTERVAL '1 minute' * minutes_spent)) < latest_checkin) then
        insert into public.plan_appointments (plan_id, appointment_id, valid, ord)
        values (current_plan_id, appointment_destination, true, j+1);
        
        -- insert into public.error_log (function_name, error_message) -- DEBUG
        -- values ('build_schedule_plan', concat('Team ', i, ', Scheduled to ', j+1, ' Appointments; minutes_spent = ', minutes_spent, ' earliest_checkout = ', earliest_checkout, ' latest_checkin = ', latest_checkin));
      else
        -- insert into public.error_log (function_name, error_message) -- DEBUG
        -- values ('build_schedule_plan', concat('Team ', i, ', ended. Scheduled to ', j, ' Appointments; minutes_spent = ', minutes_spent, ' earliest_checkout = ', earliest_checkout, ' latest_checkin = ', latest_checkin));
        Exit; -- move to scheduling the next team
      end if; 
    END LOOP;
  end loop;

  -- -- Check if all appointments were scheduled
  if 0 < (
    SELECT count(*)
    FROM public.rc_appointments as a
    JOIN public.rc_properties as p ON a.property = p.properties_id
    LEFT JOIN public.planned_appointment_ids as pa on pa.appointment_id = a.appointment_id
    WHERE a.app_status_id in (1, 2) 
      and a.service = ANY(services) 
      and DATE(a.departure_time) = date_to_schedule 
      and pa.appointment_id is null
      and (
        omissions IS NULL OR
        not a.appointment_id = ANY(omissions)
      )
  ) then
    insert into public.error_log (function_name, error_message)
    values ('build_schedule_plan', concat('Staff needed --> ', num_staff_needed, ' was incorrect ',(
      SELECT count(*)
      FROM public.rc_appointments as a
      JOIN public.rc_properties as p ON a.property = p.properties_id
      LEFT JOIN public.planned_appointment_ids as pa on pa.appointment_id = a.appointment_id
      WHERE a.app_status_id in (1, 2) 
        and a.service = ANY(services) 
        and DATE(a.departure_time) = date_to_schedule 
        and pa.appointment_id is null
        and (
          omissions IS NULL OR
          not a.appointment_id = ANY(omissions)
        )
      ),' appointments were left unscheduled, building again with 1 more staff'));
      PERFORM public.build_schedule_plan(
        available_staff,
        date_to_schedule,
        office_location,
        services,
        omissions,
        routing_type,
        cleaning_window,
        max_hours,
        num_staff_needed+1
      );
    return;
  end if;

END;
$function$
;

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
                   where a2.app_status_id in (1, 2) 
                    and p2.properties_id = any(p.double_unit)
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


