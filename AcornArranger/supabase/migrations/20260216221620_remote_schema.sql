


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgrouting" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_permission" AS ENUM (
    'rc_addresses.select',
    'rc_appointments.select',
    'rc_properties.select',
    'rc_properties.update',
    'rc_staff.select',
    'rc_tokens.select',
    'roles.select',
    'roles.update',
    'schedule_plans.select',
    'schedule_plans.update',
    'schedule_plans.insert',
    'plan_appointments.select',
    'plan_appointments.update',
    'plan_appointments.insert',
    'plan_staff.select',
    'plan_staff.update',
    'plan_staff.insert',
    'service_key.select',
    'appointment_status_key.select',
    'property_status_key.select',
    'staff_status_key.select',
    'appointments_staff.select',
    'error_log.select',
    'error_log.insert',
    'http_response.select',
    'http_response.insert',
    'travel_times.select',
    'send_schedule_job_queue.insert'
);


ALTER TYPE "public"."app_permission" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'authenticated',
    'authorized_user'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authorize"("requested_permission" "public"."app_permission") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  bind_permissions int;
begin
  select count(*)
  from public.role_permissions
  where role_permissions.permission = authorize.requested_permission
    and role_permissions.role = (auth.jwt() ->> 'user_role')::public.app_role
  into bind_permissions;
  
  return bind_permissions > 0;
end;
$$;


ALTER FUNCTION "public"."authorize"("requested_permission" "public"."app_permission") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_schedule_plan"("available_staff" bigint[], "date_to_schedule" "date", "office_location" "extensions"."geometry", "services" bigint[], "omissions" bigint[], "routing_type" integer DEFAULT 1, "cleaning_window" double precision DEFAULT 6.0, "max_hours" double precision DEFAULT 8.0, "target_staff_count" integer DEFAULT 0) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $_$
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
            where p.properties_id = any(double_unit_ref) and date(a.arrival_time) = date_to_schedule
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
                where p.properties_id = any(double_unit_ref) and date(a.arrival_time) = date_to_schedule
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
$_$;


ALTER FUNCTION "public"."build_schedule_plan"("available_staff" bigint[], "date_to_schedule" "date", "office_location" "extensions"."geometry", "services" bigint[], "omissions" bigint[], "routing_type" integer, "cleaning_window" double precision, "max_hours" double precision, "target_staff_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."copy_schedule_plan"("schedule_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare 
  plan record;
  appointment record;
  new_plan_id bigint; 
  plan_staff_ids bigint[];
  result boolean;
begin
  for plan in (select * from public.schedule_plans where plan_date = schedule_date and valid = true) loop
    -- Insert new plan for the given day which is valid and has the same team number
    insert into public.schedule_plans (plan_date, team, valid) 
    values ( 
      schedule_date, 
      plan.team, 
      true 
    ) 
    returning id into new_plan_id; 
    -- Insert all the same staff for that new plan
    insert into public.plan_staff (plan_id, staff_id, valid)
    select new_plan_id, staff_id, valid 
    from public.plan_staff 
    where plan_id = plan.id 
      and valid = true;
    -- Insert all the same appointments for that new plan that are incomplete and not cancelled
    insert into public.plan_appointments (plan_id, appointment_id, valid, ord)
    select new_plan_id, pa.appointment_id, pa.valid, pa.ord
    from public.plan_appointments as pa
    join public.rc_appointments as ra on pa.appointment_id = ra.appointment_id     
    where plan_id = plan.id 
      and valid = true 
      and ra.app_status_id in (1,2);
    -- invalidate the old plan in schedule_plans 
    update public.schedule_plans
    set valid = false
    where id = plan.id;
  end loop;
end;
$$;


ALTER FUNCTION "public"."copy_schedule_plan"("schedule_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."custom_access_token_hook"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
  declare
    claims jsonb;
    user_role public.app_role;
  begin
    -- Check if the user is marked as admin in the profiles table
    select role into user_role from public.user_roles where user_id = (event->>'user_id')::uuid;

    claims := event->'claims';

    if user_role is not null then
      -- Set the claim
      claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
    else
      claims := jsonb_set(claims, '{user_role}', 'null');
    end if;

    -- Update the 'claims' object in the original event
    event := jsonb_set(event, '{claims}', claims);

    -- Return the modified or original event
    return event;
  end;
$$;


ALTER FUNCTION "public"."custom_access_token_hook"("event" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_geom_and_placeid_from_address"("address" "text", OUT "geom" "extensions"."geometry", OUT "place_id" "text") RETURNS "record"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE 
  response_id BIGINT;
  http_status INT;
  json_data JSONB;
BEGIN
  -- Call GET request for geocode
  SELECT public.http_get_geocode(address) INTO response_id;

  ASSERT ((SELECT 1 FROM public.http_response WHERE id = response_id));
  
  -- Place Location data into json object
  SELECT status, content
  INTO http_status, json_data
  FROM public.http_response 
  WHERE id = response_id;

  if http_status != 200 then
    insert into public.error_log (function_name, error_message)
    values ('get_geom_and_placeid_from_address', concat('GET Geocode status code not 200 --> ', http_status, ' Response Id --> ', response_id));
    geom := null;
    place_id := null;
    return;
  end if;

  geom := extensions.ST_SetSRID(
    extensions.ST_MakePoint(
      (json_data#>>'{results,0,geometry,location,lng}')::FLOAT, 
      (json_data#>>'{results,0,geometry,location,lat}')::FLOAT
    ),
    4326
  );

  place_id := json_data#>>'{results,0,place_id}';
END;
$$;


ALTER FUNCTION "public"."get_geom_and_placeid_from_address"("address" "text", OUT "geom" "extensions"."geometry", OUT "place_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_geom_from_address"("address" "text") RETURNS "extensions"."geometry"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare 
  response_id bigint;
  http_status int;
  json_data jsonb;
begin
  -- Call GET request for geocode
  select public.http_get_geocode(address) into response_id;

  ASSERT ((SELECT 1 FROM public.http_response WHERE id = response_id));
  
  -- Place Location data into json object
  select status, content
  into http_status, json_data
  from public.http_response 
  where id = response_id;

  if http_status != 200 then
    insert into public.error_log (function_name, error_message)
    values ('get_geom_from_address', concat('GET Geocode status code not 200 --> ', http_status, ' Response Id --> ', response_id));
    return null;
  end if;

  return(extensions.ST_SetSRID(
    extensions.ST_MakePoint(
      (json_data#>>'{results,0,geometry,location,lng}')::float, 
      (json_data#>>'{results,0,geometry,location,lat}')::float
    ),
    4326)
  );
end;
$$;


ALTER FUNCTION "public"."get_geom_from_address"("address" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_rc_token"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if not exists (select 1 from public.rc_tokens where expires > now() and now() < created_at + (interval '1 hour' * 6)) then
    -- Use POST to retrieve a new token
    INSERT INTO public.rc_tokens (access_token, expires) 
    SELECT content::json->>'access_token', now() + (content::json->>'expires_in')::int * interval '1 second'
      FROM extensions.http((
              'POST',
              'https://auth.resortcleaning.com/auth/realms/rc/protocol/openid-connect/token',
              ARRAY[extensions.http_header('Host','auth.resortcleaning.com')],
              'application/x-www-form-urlencoded',
              extensions.urlencode(
                jsonb_build_object(
                    'grant_type','password', 
                    'scope','openid', 
                    'client_id','web_client', 
                    'username', (select decrypted_secret from vault.decrypted_secrets where name = 'RC_Username'),
                    'password', (select decrypted_secret from vault.decrypted_secrets where name = 'RC_Password')
                    )
                )
            )::extensions.http_request);
  end if;
  return (
    select decrypted_access_token 
    from public.decrypted_rc_tokens 
    where expires > now() and now() < created_at + (interval '1 hour' * 6)
  );
end;
$$;


ALTER FUNCTION "public"."get_rc_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_staff_shifts"("date_from" "date", "date_to" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare 
  response_id bigint;
  http_status int;
  json_data jsonb;
  shift_data jsonb;
  result_list jsonb := '[]'::jsonb;
  staff_user_id bigint;
  staff_name text;
begin

  -- Call GET request for shifts
  select public.http_get_shifts(date_from, date_to) into response_id;

  ASSERT ((SELECT 1 FROM public.http_response WHERE id = response_id));

  -- Place response data into json object
  select h.status, h.content
  into http_status, json_data
  from public.http_response as h
  where id = response_id;

  -- Handle failed API response
  if http_status != 200 then
    insert into public.error_log (function_name, error_message)
    values (
      'get_staff_shifts',
      concat('GET Shifts (Homebase) status code not 200 --> ', http_status, ' Response Id --> ', response_id)
    );
    return '[]'::jsonb;
  end if;

  -- Loop through each shift in the JSON array
  for shift_data in
    select * from jsonb_array_elements(json_data)
  loop
    -- Reset vars each iteration
    staff_user_id := null;
    staff_name := null;

    -- Try to find a match
    select user_id, name
    into staff_user_id, staff_name
    from public.rc_staff
    where hb_user_id = (shift_data->>'user_id')::bigint;

    -- Append to result list, regardless of match
    result_list := result_list || jsonb_build_object(
      'matched', staff_user_id is not null,
      'user_id', staff_user_id,
      'name', staff_name,
      'shift', shift_data
    );
  end loop;

  return result_list;
end;
$$;


ALTER FUNCTION "public"."get_staff_shifts"("date_from" "date", "date_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_time"("date_to_check" "date", "office_location" "extensions"."geometry", "services" bigint[], "omissions" bigint[], OUT "total_cleaning_time" integer, OUT "total_travel_time" integer) RETURNS "record"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $_$
DECLARE
  travel_time INTEGER := 0;
  property_order INTEGER[];
  property_source bigint;
  property_destination bigint;
BEGIN
  -- Calculate the total estimated cleaning time for all appointments scheduled for the specified day
  select coalesce((
    SELECT SUM(p.estimated_cleaning_mins)
    FROM public.rc_appointments as a
    JOIN public.rc_properties as p ON a.property = p.properties_id
    WHERE a.app_status_id in (1, 2) 
      and a.service = ANY(services) 
      and DATE(a.departure_time) = date_to_check 
      and (
        omissions IS NULL OR
        not a.appointment_id = ANY(omissions)
      )
  ), 0) into total_cleaning_time;

  total_travel_time := 0;
  
  if (total_cleaning_time = 0) then
    total_cleaning_time := 0;
    return; -- No appointments found for day
  end if;

  -- Determine assumed optimal order of properties using the Traveling Salesman Problem
  EXECUTE format(
    $format$
      SELECT array_agg(node)
      from (
        select distinct node, seq
        FROM extensions.pgr_TSPeuclidean(
        $tsp$
          WITH combined_locations AS (
            SELECT 1 as id, %1$L AS x, %2$L AS y
            UNION ALL
            SELECT a.appointment_id as id, extensions.ST_X(addr.location) AS x, extensions.ST_Y(addr.location) AS y
            FROM public.rc_appointments as a
            JOIN public.rc_properties as p ON a.property = p.properties_id
            JOIN public.rc_addresses as addr ON addr.id = p.address
            WHERE  a.app_status_id in (1, 2) 
              and a.service = ANY(%3$L) 
              and DATE(a.departure_time) = %4$L 
              and (
                %5$L IS NULL OR
                not a.appointment_id = ANY(%5$L)
              )
          )
          SELECT id, x, y FROM combined_locations;
        $tsp$, 1, 0)
        order by seq
      ) as tsp_result
    $format$,
    extensions.ST_X(office_location), extensions.ST_Y(office_location), services, date_to_check, omissions
  ) INTO property_order;

  property_order := trim_array(property_order,1);

  property_order := array_remove(property_order, 1);

  -- Calculate the total travel time between properties
  FOR i IN 1..array_length(property_order, 1) - 1 LOOP
    -- Get the source and destination property IDs
    property_source := property_order[i];
    property_destination := property_order[i + 1];
    
    -- Fetch the travel time between the source and destination properties
    select coalesce((
      SELECT travel_time_minutes
      FROM public.travel_times
      WHERE src_address_id = (
        SELECT addr.id
        FROM public.rc_appointments a
        JOIN public.rc_properties p ON a.property = p.properties_id
        JOIN public.rc_addresses addr ON p.address = addr.id
        WHERE a.appointment_id = property_source
      )
      AND dest_address_id = (
        SELECT addr.id
        FROM public.rc_appointments a
        JOIN public.rc_properties p ON a.property = p.properties_id
        JOIN public.rc_addresses addr ON p.address = addr.id
        WHERE a.appointment_id = property_destination
      )
    ), 0) into travel_time;

    -- Accumulate the total travel time
    total_travel_time := total_travel_time + travel_time;
  END LOOP;

  -- Return the total time (cleaning time + travel time) in minutes
  RETURN;
END;
$_$;


ALTER FUNCTION "public"."get_total_time"("date_to_check" "date", "office_location" "extensions"."geometry", "services" bigint[], "omissions" bigint[], OUT "total_cleaning_time" integer, OUT "total_travel_time" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'auth', 'public'
    AS $$
declare
begin
  insert into public.users (id, display_name, email)
  values (new.id, (new.raw_user_meta_data->>'display_name'), new.email);
  
  insert into public.user_roles (user_id, role) values (new.id, 'authenticated');
  
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."http_get_appointments"("date_from" timestamp with time zone, "date_to" timestamp with time zone) RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  r_status int;
  r_content_type text;
  r_headers text;
  r_content text;
  r_id bigint;
begin

  -- Set necessary timeouts
  PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT', '15');
  PERFORM extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '5');

  SELECT status, content_type, headers::text, content::text
  INTO r_status, r_content_type, r_headers, r_content
  FROM extensions.http((
    'GET',
    concat(
      'https://api.resortcleaning.com/base/v1/appointments?filter[aptBetween]=', 
      TO_CHAR(date_from, 'YYYY/MM/DD'), '-', TO_CHAR(date_to, 'YYYY/MM/DD'), 
      '&per_page=0'
    ),
    ARRAY[extensions.http_header('Host','api.resortcleaning.com'), extensions.http_header('Authorization', concat('Bearer ', public.get_rc_token()))],
    NULL,
    NULL
  )::extensions.http_request);
  insert into public.http_response (status, content_type, headers, content)
  values (r_status, r_content_type, r_headers, r_content)
  returning id into r_id;
  return r_id;
end;
$$;


ALTER FUNCTION "public"."http_get_appointments"("date_from" timestamp with time zone, "date_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."http_get_distance_matrix"("origin_place_ids" "text"[], "destination_place_ids" "text"[]) RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    r_status INT;
    r_content_type TEXT;
    r_headers TEXT;
    r_content TEXT;
    r_id BIGINT;
    origin_ids TEXT;
    destination_ids TEXT;
BEGIN
    -- Construct origin place_ids string
    SELECT array_to_string(ARRAY(SELECT 'place_id:' || place_id FROM unnest(origin_place_ids) as place_id), '|') INTO origin_ids;

    -- Construct destination place_ids string
    SELECT array_to_string(ARRAY(SELECT 'place_id:' || place_id FROM unnest(destination_place_ids) as place_id), '|') INTO destination_ids;

    -- Call Google Distance Matrix API
    SELECT status, content_type, headers::TEXT, content::TEXT
    INTO r_status, r_content_type, r_headers, r_content
    FROM extensions.http((
        'GET',
        CONCAT(
            'https://maps.googleapis.com/maps/api/distancematrix/json?destinations=',
            destination_ids,
            '&origins=',
            origin_ids,
            '&key=',
            (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'GM_API_KEY')
        ),
        ARRAY[extensions.http_header('Accept', 'application/json')],
        NULL,
        NULL
    )::extensions.HTTP_REQUEST);

    -- Insert response into http_response table
    INSERT INTO public.http_response (status, content_type, headers, content)
    VALUES (r_status, r_content_type, r_headers, r_content)
    RETURNING id INTO r_id;

    RETURN r_id;
END;
$$;


ALTER FUNCTION "public"."http_get_distance_matrix"("origin_place_ids" "text"[], "destination_place_ids" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."http_get_employees"() RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  r_status int;
  r_content_type text;
  r_headers text;
  r_content text;
  r_id bigint;
begin
  SELECT status, content_type, headers::text, content::text
  INTO r_status, r_content_type, r_headers, r_content
  FROM extensions.http((
    'GET',
    concat(
    'https://api.joinhomebase.com/locations/', 
    (select decrypted_secret from vault.decrypted_secrets where name = 'HB_location_uuid'),
    '/employees?with_archived=false'
    ),
    ARRAY[extensions.http_header('Authorization', concat('Bearer ', (select decrypted_secret from vault.decrypted_secrets where name = 'HB_API_KEY')))],
    NULL,
    NULL
  )::extensions.http_request);
  insert into public.http_response (status, content_type, headers, content)
  values (r_status, r_content_type, r_headers, r_content)
  returning id into r_id;
  return r_id;
end;
$$;


ALTER FUNCTION "public"."http_get_employees"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."http_get_geocode"("address" "text") RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  r_status int;
  r_content_type text;
  r_headers text;
  r_content text;
  r_id bigint;
begin
  SELECT status, content_type, headers::text, content::text
  INTO r_status, r_content_type, r_headers, r_content
  FROM extensions.http((
    'GET',
    concat(
    'https://maps.googleapis.com/maps/api/geocode/json?address=', 
    extensions.urlencode(address),
    '&key=',
    (select decrypted_secret from vault.decrypted_secrets where name = 'GM_API_KEY')
    ),
    ARRAY[extensions.http_header('Accept', 'application/json')],
    NULL,
    NULL
  )::extensions.http_request);
  insert into public.http_response (status, content_type, headers, content)
  values (r_status, r_content_type, r_headers, r_content)
  returning id into r_id;
  return r_id;
end;
$$;


ALTER FUNCTION "public"."http_get_geocode"("address" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."http_get_properties"() RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  r_status int;
  r_content_type text;
  r_headers text;
  r_content text;
  r_id bigint;
begin

  -- Set necessary timeouts
  PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT', '10');
  PERFORM extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '5');

  SELECT status, content_type, headers::text, content::text
  INTO r_status, r_content_type, r_headers, r_content
  FROM extensions.http((
    'GET',
    'https://api.resortcleaning.com/base/v1/property/cleaner?per_page=0', 
    ARRAY[extensions.http_header('Host','api.resortcleaning.com'), extensions.http_header('Authorization', concat('Bearer ', public.get_rc_token()))],
    NULL,
    NULL
  )::extensions.http_request);
  insert into public.http_response (status, content_type, headers, content)
  values (r_status, r_content_type, r_headers, r_content)
  returning id into r_id;
  return r_id;
end;
$$;


ALTER FUNCTION "public"."http_get_properties"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."http_get_shifts"("date_from" timestamp with time zone, "date_to" timestamp with time zone) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  r_status int;
  r_content_type text;
  r_headers text;
  r_content text;
  r_id bigint;
begin
  SELECT status, content_type, headers::text, content::text
  INTO r_status, r_content_type, r_headers, r_content
  FROM extensions.http((
    'GET',
    concat(
    'https://api.joinhomebase.com/locations/', 
    (select decrypted_secret from vault.decrypted_secrets where name = 'HB_location_uuid'),
    '/shifts?start_date=',TO_CHAR(date_from, 'YYYY-MM-DD'), '&end_date=', TO_CHAR(date_to, 'YYYY-MM-DD'), 
      '&per_page=0'
    ),
    ARRAY[extensions.http_header('Authorization', concat('Bearer ', (select decrypted_secret from vault.decrypted_secrets where name = 'HB_API_KEY')))],
    NULL,
    NULL
  )::extensions.http_request);
  insert into public.http_response (status, content_type, headers, content)
  values (r_status, r_content_type, r_headers, r_content)
  returning id into r_id;
  return r_id;
end;
$$;


ALTER FUNCTION "public"."http_get_shifts"("date_from" timestamp with time zone, "date_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."http_get_staff"() RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  r_status int;
  r_content_type text;
  r_headers text;
  r_content text;
  r_id bigint;
begin
  SELECT status, content_type, headers::text, content::text
  INTO r_status, r_content_type, r_headers, r_content
  FROM extensions.http((
    'GET',
    concat(
    'https://api.resortcleaning.com/base/v1/company/staff/cl?filter[status_id]=', 
    '1,2,3',
    '&per_page=0'
    ),
    ARRAY[extensions.http_header('Host','api.resortcleaning.com'), extensions.http_header('Authorization', concat('Bearer ', public.get_rc_token()))],
    NULL,
    NULL
  )::extensions.http_request);
  insert into public.http_response (status, content_type, headers, content)
  values (r_status, r_content_type, r_headers, r_content)
  returning id into r_id;
  return r_id;
end;
$$;


ALTER FUNCTION "public"."http_get_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."http_put_appointment_staff"("appointment_id" bigint, "assignment_json" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  r_status int;
  r_content_type text;
  r_headers text;
  r_content text;
  r_id bigint;
begin

  -- RAISE EXCEPTION 'Recieved json --> %', jsonb_pretty(assignment_json);

  -- Set necessary timeouts
  PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT', '10');
  PERFORM extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '5');

  SELECT status, content_type, headers::text, content::text
  INTO r_status, r_content_type, r_headers, r_content
  FROM extensions.http((
    'PUT',
    concat(
      'https://api.resortcleaning.com/base/v1/appointment/', 
      appointment_id, 
      '/staff'
    ),
    ARRAY[extensions.http_header('Host','api.resortcleaning.com'), extensions.http_header('Authorization', concat('Bearer ', public.get_rc_token()))],
    'application/json',
    assignment_json::text
  )::extensions.http_request);
  insert into public.http_response (status, content_type, headers, content)
  values (r_status, r_content_type, r_headers, r_content)
  returning id into r_id;
  return r_id;
end;
$$;


ALTER FUNCTION "public"."http_put_appointment_staff"("appointment_id" bigint, "assignment_json" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."plan_add_appointment"("target_plan" bigint, "appointment_to_add" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare 
  plan_id bigint;
begin
  if (select 1 from public.schedule_plans where id = target_plan) then
    -- Make sure the appointment is not already scheduled to that appointment that day
    if (
      select 1 
      from public.schedule_plans as sp
      join public.plan_appointments as pa on pa.plan_id = sp.id
      where pa.appointment_id = appointment_to_add
        and pa.plan_id = target_plan
        and pa.valid = true
        and sp.valid = true
      ) then
      RAISE sqlstate 'PT400' using
        detail = 'REPEATED_ACTION',
        message = concat('Appointment ', appointment_to_add, ' already scheduled to plan ', target_plan);
      return;
    end if;

  -- Make sure that plan is not already sent to ResortCleaning
    if (
      select 1 
      from public.schedule_plans as sp
      join public.plan_appointments as pa on pa.plan_id = sp.id
      where pa.sent_to_rc is not null
        and pa.plan_id = target_plan
        and pa.valid = true
        and sp.valid = true
      limit 1
      ) then
      RAISE sqlstate 'PT400' using
        detail = 'IMMUTABLE',
        message = concat('Plan ', target_plan, ' has already been sent to ResortCleaning and is now immutable');
      return;
    end if;

    -- -- Restrict Adding appointments to more than one team per day
    -- if (
    --   select 1 
    --   from public.schedule_plans as sp
    --   join public.plan_appointments as pa on pa.plan_id = sp.id
    --   where pa.appointment_id = appointment_to_add
    --     and sp.plan_date = (select plan_date from public.schedule_plans where id = target_plan)
    --     and pa.valid = true
    --     and sp.valid = true
    --   ) then
    --   RAISE sqlstate 'PT400' using
    --     detail = 'REPEATED_APPOINTMENT',
    --     message = concat('Appointment ', appointment_to_add, ' already scheduled to plan ', target_plan);
    --   return;
    -- end if;
  
    insert into public.plan_appointments (plan_id, appointment_id, valid) 
    values (target_plan, appointment_to_add, true);
  else
    RAISE sqlstate 'PT404' using
      message = 'Schedule Plan not found',
      detail = concat('No schedule plan found for plan ', target_plan),
      hint = 'Try /plans to find a plan_id';
  end if;
end;
$$;


ALTER FUNCTION "public"."plan_add_appointment"("target_plan" bigint, "appointment_to_add" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."plan_add_staff"("target_plan" bigint, "staff_to_add" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare 

begin
  if (select 1 from public.schedule_plans where id = target_plan) then
    -- Make sure the staff member is not already scheduled to that plan that day
    if (
      select 1 
      from public.schedule_plans as sp
      join public.plan_staff as ps on ps.plan_id = sp.id
      where ps.staff_id = staff_to_add
        and ps.plan_id = target_plan
        and ps.valid = true
        and sp.valid = true
      ) then
      RAISE sqlstate 'PT400' using
        detail = 'REPEATED_ACTION',
        message = concat('Staff ', staff_to_add, ' already on plan ', target_plan);
      return;
    end if;

    -- Make sure that plan is not already sent to ResortCleaning
    if (
      select 1 
      from public.schedule_plans as sp
      join public.plan_appointments as pa on pa.plan_id = sp.id
      where pa.sent_to_rc is not null
        and pa.plan_id = target_plan
        and pa.valid = true
        and sp.valid = true
      limit 1
      ) then
      RAISE sqlstate 'PT400' using
        detail = 'IMMUTABLE',
        message = concat('Plan ', target_plan, ' has already been sent to ResortCleaning and is now immutable');
      return;
    end if;

    -- -- Restrict Adding staff to more than one team per day
    -- if (
    --   select 1 
    --   from public.schedule_plans as sp
    --   join public.plan_staff as ps on ps.plan_id = sp.id
    --   where ---
    --   ) then
    --   insert into public.error_log (function_name, error_message) 
    --   values ('team_plan_add_staff', concat('Staff ', staff_to_add,  ' is already assigned to another team for ', target_plan_date));
    --   return;
    -- end if;
  
    insert into public.plan_staff (plan_id, staff_id, valid) 
    values (target_plan, staff_to_add, true);
  else
    RAISE sqlstate 'PT404' using
      message = concat('No schedule plan found for plan ', target_plan),
      detail = 'Schedule Plan not found',
      hint = 'Try /plans to find a plan_id';
  end if;
end;
$$;


ALTER FUNCTION "public"."plan_add_staff"("target_plan" bigint, "staff_to_add" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."plan_create_new"("target_plan_date" "date") RETURNS TABLE("id" bigint, "plan_date" "date", "team" smallint)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$ 
declare 
  plan_id bigint; 
begin 
  insert into public.schedule_plans (plan_date, team, valid) 
  values ( 
    target_plan_date, 
    ( select coalesce(max(sp.team),0)+1 from public.schedule_plans as sp where sp.plan_date = target_plan_date and sp.valid = true ), 
    true 
  ) 
  returning * into plan_id; 
  return query select sp.id, sp.plan_date, sp.team from public.schedule_plans as sp where sp.id = plan_id; 
end; 
$$;


ALTER FUNCTION "public"."plan_create_new"("target_plan_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."plan_remove_appointment"("target_plan" bigint, "appointment_to_remove" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare 
  
begin
  update public.plan_appointments
  set
    valid = false
  where
    appointment_id = appointment_to_remove
    and plan_id = target_plan;
end;
$$;


ALTER FUNCTION "public"."plan_remove_appointment"("target_plan" bigint, "appointment_to_remove" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."plan_remove_staff"("target_plan" bigint, "staff_to_remove" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare 
  
begin
  update public.plan_staff
  set
    valid = false
  where
    staff_id = staff_to_remove
    and plan_id = target_plan;
end;
$$;


ALTER FUNCTION "public"."plan_remove_staff"("target_plan" bigint, "staff_to_remove" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_send_schedule_job_queue"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  job RECORD;
  result boolean;
  processed_dates DATE[] := '{}';
BEGIN
  FOR job IN (SELECT * FROM public.send_schedule_job_queue WHERE status = 'pending' ORDER BY created_at) LOOP
    -- Skip if this date has already been processed
    IF job.schedule_date = ANY(processed_dates) THEN
      -- raise exception 'Skipping duplicate send job for one of dates --> %', processed_dates;
      CONTINUE;
    END IF;
    -- Update the job status to 'processing'
    UPDATE public.send_schedule_job_queue SET status = 'processing', updated_at = NOW() WHERE id = job.id;
    
    BEGIN
      -- Call function to process the job
      SELECT public.send_rc_schedule_plans(job.schedule_date) into result;
      if (result) then
        -- If successful, update the job status to 'completed'
        UPDATE public.send_schedule_job_queue SET status = 'completed', updated_at = NOW() WHERE (id = job.id) or (schedule_date = job.schedule_date and status = 'pending');
        -- Add to processed list
        processed_dates := array_append(processed_dates, job.schedule_date);
      else
        -- There was an error in execution, update the job status to 'failed'
        UPDATE public.send_schedule_job_queue SET status = 'failed', updated_at = NOW() WHERE id = job.id;
      end if;
    EXCEPTION WHEN OTHERS THEN
      -- If there is an error, update the job status to 'failed'
      UPDATE public.send_schedule_job_queue SET status = 'failed', updated_at = NOW() WHERE id = job.id;
      -- log the error
      INSERT INTO public.error_log (function_name, error_message) 
      VALUES ('process_job_queue', CONCAT('Error processing schedule for date --> ', job.schedule_date, ': ', SQLERRM));
    END;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."process_send_schedule_job_queue"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rc_tokens_encrypt_secret_access_token"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
		BEGIN
		        new.access_token = CASE WHEN new.access_token IS NULL THEN NULL ELSE
			CASE WHEN 'b812bcee-378e-4d89-91db-d4d21313361d' IS NULL THEN NULL ELSE pg_catalog.encode(
			  pgsodium.crypto_aead_det_encrypt(
				pg_catalog.convert_to(new.access_token, 'utf8'),
				pg_catalog.convert_to(('')::text, 'utf8'),
				'b812bcee-378e-4d89-91db-d4d21313361d'::uuid,
				NULL
			  ),
				'base64') END END;
		RETURN new;
		END;
		$$;


ALTER FUNCTION "public"."rc_tokens_encrypt_secret_access_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."schedule_send_rc_schedule_plans"("schedule_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.send_schedule_job_queue (schedule_date, status) VALUES (schedule_date, 'pending');
END;
$$;


ALTER FUNCTION "public"."schedule_send_rc_schedule_plans"("schedule_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_rc_schedule_plans"("schedule_date" "date") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare 
  plan record;
  appointment record;
  plan_staff_ids bigint[];
  result boolean;
  no_error boolean;
begin
  no_error = true; -- Flag to indicate success for calling functions.
  for plan in (select * from public.schedule_plans where plan_date = schedule_date and valid = true) loop
    -- raise exception 'Sending plan id --> %', plan.id;
    SELECT ARRAY_AGG(staff_id)
    INTO plan_staff_ids
    FROM (
        SELECT s.staff_id
        FROM public.plan_staff AS s
        WHERE plan_id = plan.id and valid = true
    ) AS current_plan_staff_list;
    -- raise exception 'Sending staff ids --> %', plan_staff_ids;
    for appointment in (select * from public.plan_appointments where plan_id = plan.id and valid = true and sent_to_rc is null) loop
      -- Send any non-cancelled clean
      if (5 != (select app_status_id from public.rc_appointments where rc_appointments.appointment_id = appointment.appointment_id order by app_status_id limit 1)) then
        if (schedule_date != (select DATE(departure_time) from public.rc_appointments where rc_appointments.appointment_id = appointment.appointment_id order by app_status_id limit 1)) then -- Ensure only sending appointments that are still for the given day
          update public.plan_appointments
          set
            valid = false
          where plan_id = plan.id and plan_appointments.appointment_id = appointment.appointment_id and valid = true;
        else
          -- raise exception 'Sending appointment id --> %', appointment.appointment_id;
          select public.set_rc_appointment_staff(appointment.appointment_id, plan_staff_ids) into result;
          if (result = false) then
            insert into public.error_log (function_name, error_message) values ('send_rc_schedule_plans', concat('Error when setting staff in plan --> ', plan.id, ' to appointment --> ', appointment.appointment_id));
            no_error = false;
          else
            -- raise exception 'Sent appointment id --> %, updating plan_appointment --> %', appointment.appointment_id, appointment.id;
            update public.plan_appointments
            set sent_to_rc = now()
            where id = appointment.id;
          end if;
        end if;
      end if;
    end loop;
  end loop;
  return no_error;
end;
$$;


ALTER FUNCTION "public"."send_rc_schedule_plans"("schedule_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_rc_appointment_staff"("appointment_id" bigint, "staff_ids" bigint[]) RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare 
  response_id int;
  http_status int;
  assignment_json jsonb;

begin
  -- Build the assignment_json object
  assignment_json := jsonb_build_object(
    'info', jsonb_build_object(
      'assign_type', 0,
      'group_id', 0
    ),
    'staff', jsonb_agg(
      jsonb_build_object(
        'user_id', staff_ids[i],
        'profession_type_id', '1'
      )
    )
  )
  from generate_subscripts(staff_ids, 1) as i;

  -- Call PUT request for appointments staff setting
  select public.http_put_appointment_staff(appointment_id, assignment_json) into response_id;

  ASSERT ((SELECT 1 FROM public.http_response WHERE id = response_id));
  
  -- Place Status of PUT into http_status
  select status
  into http_status
  from public.http_response 
  where id = response_id;

  if http_status != 200 then
    insert into public.error_log (function_name, error_message)
    values ('set_rc_appointment_staff', concat('PUT Appointment Staff status code not 200 --> ', http_status, ' Response Id --> ', response_id));
    return false;
  end if;
  
  return true;
end;
$$;


ALTER FUNCTION "public"."set_rc_appointment_staff"("appointment_id" bigint, "staff_ids" bigint[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_staff_group"("appt_id" bigint, "staff_json" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare 
  staff_data jsonb;
  staff_user_id bigint;
begin

  -- Loop through each user in the json data
  for staff_data in
    select * from jsonb_array_elements(staff_json)
  loop
    -- Get the staff_id from the json object
    select (staff_data#>>'{Basic,user_id}')::bigint into staff_user_id;
    -- Check if the staff already exists in staff table
    if not exists (select 1 from public.rc_staff where user_id = staff_user_id) then
      perform update_staff();
      if not exists (select 1 from public.rc_staff where user_id = staff_user_id) then
        RAISE EXCEPTION 'Nonexistent Staff ID--> %', staff_user_id;
      end if;
    end if;
    -- Check if the staff_id already exists in join table
    if not exists (select 1 from public.appointments_staff where appointment_id = appt_id and staff_id = staff_user_id) then
      -- Add a new join record
      insert into public.appointments_staff (appointment_id, staff_id)
      values (
        appt_id,
        staff_user_id
      );
    end if;
  end loop;

  -- Remove staff that are not in staff_json
  DELETE from public.appointments_staff
  where appointment_id = appt_id
    and staff_id not in (
      select (staff_info#>>'{Basic,user_id}')::bigint
      from jsonb_array_elements(staff_json) AS staff_info
    );
end;
$$;


ALTER FUNCTION "public"."set_staff_group"("appt_id" bigint, "staff_json" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_travel_times"("address_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  destination_ids BIGINT[];
  chunk_destination_ids BIGINT[];
  chunk_destination_place_ids TEXT[];
  origin_place_id TEXT;
  response_id BIGINT;
  http_status int;
  json_data jsonb;
BEGIN
  -- Get the origin place_id for the given address_id
  SELECT place_id INTO origin_place_id FROM public.rc_addresses WHERE id = address_id;

  -- Get all destination address ids
  destination_ids := ARRAY(SELECT id FROM public.rc_addresses WHERE id != address_id order by id);

  -- Loop through destination addresses in chunks of 25 or fewer
  FOR i IN 1..CEIL(ARRAY_LENGTH(destination_ids, 1) / 25.0) LOOP
    -- Get chunk of destination address ids
    select destination_ids[(i-1)*25+1 : i*25] into chunk_destination_ids;

    -- Get corresponding place_ids for the chunk of destination address ids
    SELECT ARRAY(
      SELECT place_id FROM public.rc_addresses WHERE id = ANY(chunk_destination_ids) order by id
    ) INTO chunk_destination_place_ids;
    
    -- Call http_get_distance_matrix function with origin and chunk of destination ids
    select public.http_get_distance_matrix(
      ARRAY[origin_place_id],  -- Origin place_id
      chunk_destination_place_ids   -- Chunk of destination place_ids
    ) into response_id;

    ASSERT ((SELECT 1 FROM public.http_response WHERE id = response_id));

    -- Place matrix data into json object
    select status, content
    into http_status, json_data
    from public.http_response 
    where id = response_id;

    if http_status != 200 then
      insert into public.error_log (function_name, error_message)
      values ('set_travel_times', concat('GET Distance Matrix status code not 200 --> ', http_status, ' Response Id --> ', response_id));
      return;
    end if;

    -- raise exception 'Distance Matrix Data #% from src_address_id --> %, --> %', i, address_id, json_data;

    -- Insert travel times into travel_times table based on the response
    INSERT INTO public.travel_times (src_address_id, dest_address_id, travel_time_minutes, distance_in_meters)
    SELECT
        address_id AS src_address_id,
        dest_id AS dest_address_id,
        (json_data->'rows'->0->'elements'->((dest_index-1)::int)->'duration'->>'value')::SMALLINT / 60 AS travel_time_minutes,
        (json_data->'rows'->0->'elements'->((dest_index-1)::int)->'distance'->>'value')::INTEGER AS distance_in_meters
    FROM unnest(chunk_destination_ids) WITH ORDINALITY AS d(dest_id, dest_index);
    -- Insert in reverse order of source and destination as well
    INSERT INTO public.travel_times (src_address_id, dest_address_id, travel_time_minutes, distance_in_meters)
    SELECT
        dest_id AS src_address_id,
        address_id AS dest_address_id,
        (json_data->'rows'->0->'elements'->((dest_index-1)::int)->'duration'->>'value')::SMALLINT / 60 AS travel_time_minutes,
        (json_data->'rows'->0->'elements'->((dest_index-1)::int)->'distance'->>'value')::INTEGER AS distance_in_meters
    FROM unnest(chunk_destination_ids) WITH ORDINALITY AS d(dest_id, dest_index);

  END LOOP;
END;
$$;


ALTER FUNCTION "public"."set_travel_times"("address_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_appointments"("date_from" timestamp with time zone, "date_to" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare 
  response_id int;
  http_status int;
  json_data jsonb;
  appt_data jsonb;
  appt_id bigint;
  property_id bigint;
begin
  -- Call GET request for appointments
  select public.http_get_appointments(date_from, date_to) into response_id;

  ASSERT ((SELECT 1 FROM public.http_response WHERE id = response_id));
  
  -- Place Staff data into json object
  select status, content
  into http_status, json_data
  from public.http_response 
  where id = response_id;

  if http_status != 200 then
    insert into public.error_log (function_name, error_message)
    values ('update_appointments', concat('GET Appointments status code not 200 --> ', http_status, ' Response Id --> ', response_id));
    return;
  end if;

  -- Loop through each appointment in the json data
  for appt_data in
    select * from jsonb_array_elements((json_data->>'data')::jsonb)
  loop
    -- Get the appointment_id from the json object
    select (appt_data->>'appointment_id')::bigint into appt_id;
    select (appt_data#>>'{Property,properties_id}')::bigint into property_id;
    -- Check if the property already exists in properties table
    if not exists (select 1 from public.rc_properties where properties_id = property_id) then
      perform public.update_properties();
      if not exists (select 1 from public.rc_properties where properties_id = property_id) then
        RAISE EXCEPTION 'Nonexistent Property ID--> %', property_id;
      end if;
    end if;
    -- Check if the service is already known in service key table
    if ((appt_data#>>'{Service,id}')::bigint != 21942) then
      if not exists (select 1 from public.service_key where service_id = (appt_data#>>'{Service,id}')::bigint) then
        insert into public.service_key (service_id, name)
        values ((appt_data#>>'{Service,id}')::bigint, (appt_data#>>'{Service,name}')::text);
      end if;
    end if;
    -- Check if the appointment_id already exists in appointments table
    if exists (select 1 from public.rc_appointments where appointment_id = appt_id) then
      -- Update the existing record
      update public.rc_appointments
      set
        arrival_time = TO_TIMESTAMP((appt_data->>'arrival_date') || ' ' || (appt_data->>'arrival_time'), 'YYYY-MM-DD HH24:MI:SS'),
        departure_time = TO_TIMESTAMP((appt_data->>'departure_date') || ' ' || (appt_data->>'departure_time'), 'YYYY-MM-DD HH24:MI:SS'),
        next_arrival_time = TO_TIMESTAMP((appt_data->>'next_arrival_date') || ' ' || (appt_data->>'next_arrival_time'), 'YYYY-MM-DD HH24:MI:SS'),
        turn_around = (appt_data->>'turn_around')::boolean,
        app_status_id = (appt_data#>>'{Status,app_status_id}')::smallint,
        property = (appt_data#>>'{Property,properties_id}')::bigint,
        cancelled_date = (appt_data->>'cancelled_date')::timestamptz,
        service = (appt_data#>>'{Service,id}')::bigint
      where appointment_id = appt_id;
    else
      -- Add a new appointment record
      insert into public.rc_appointments (appointment_id, arrival_time, departure_time, next_arrival_time, turn_around, app_status_id, property, cancelled_date, service)
      values (
        appt_id, 
        TO_TIMESTAMP((appt_data->>'arrival_date') || ' ' || (appt_data->>'arrival_time'), 'YYYY-MM-DD HH24:MI:SS'), 
        TO_TIMESTAMP((appt_data->>'departure_date') || ' ' || (appt_data->>'departure_time'), 'YYYY-MM-DD HH24:MI:SS'), 
        TO_TIMESTAMP((appt_data->>'next_arrival_date') || ' ' || (appt_data->>'next_arrival_time'), 'YYYY-MM-DD HH24:MI:SS'), 
        (appt_data->>'turn_around')::boolean, 
        (appt_data#>>'{Status,app_status_id}')::smallint,
        (appt_data#>>'{Property,properties_id}')::bigint, 
        (appt_data->>'cancelled_date')::timestamptz,
        (appt_data#>>'{Service,id}')::bigint
      );
    end if;
    -- Update or create Staff group
    perform public.set_staff_group(appt_id, appt_data->'Staff');
  end loop;
end;
$$;


ALTER FUNCTION "public"."update_appointments"("date_from" timestamp with time zone, "date_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_employee_roles"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare 
  response_id bigint;
  http_status int;
  json_data jsonb;
  user_data jsonb;
  role_id bigint;
  staff_user_id bigint;
  homebase_user_id bigint;
  log_id bigint;
begin

  -- Call GET request for staff
  select public.http_get_employees() into response_id;

  ASSERT ((SELECT 1 FROM public.http_response WHERE id = response_id));
  
  -- Place Staff data into json object
  select h.status, h.content
  into http_status, json_data
  from public.http_response as h
  where id = response_id;

  if http_status != 200 then
    insert into public.error_log (function_name, error_message)
    values ('update_employee_roles', concat('GET Employees (Homebase) status code not 200 --> ', http_status, ' Response Id --> ', response_id));
    return;
  end if;

  -- Loop through each user in the json data
  for user_data in
    select * from jsonb_array_elements(json_data)
  loop
    -- Find Matching Staff in ResortCleaning Staff table
    if exists (select 1 from public.rc_staff where extensions.soundex(first_name) = extensions.soundex(user_data->>'first_name') and extensions.soundex(last_name) = extensions.soundex(user_data->>'last_name')) then
      select user_id into staff_user_id from public.rc_staff where extensions.soundex(first_name) = extensions.soundex(user_data->>'first_name') and extensions.soundex(last_name) = extensions.soundex(user_data->>'last_name');
      -- Get the roles table id for the default role
      if exists (select 1 from public.roles where title = user_data#>>'{job,default_role}') then
        select id from public.roles where title = (user_data#>>'{job,default_role}') into role_id;
      else
        if (user_data#>>'{job,default_role}') is null then
        role_id := null;
        else
          insert into public.roles (title)
          values (user_data#>>'{job,default_role}')
          returning id into role_id;
        end if;
      end if;
      -- Update the existing record (changing Homebase user_id only if necesarry)
      select (user_data->>'id')::bigint into homebase_user_id;
      if (homebase_user_id is distinct from (select hb_user_id from public.rc_staff where user_id = staff_user_id)) then
        update public.rc_staff
        set
          role = role_id,
          hb_user_id = homebase_user_id
        where user_id = staff_user_id;
      else
        update public.rc_staff
        set
          role = role_id
        where user_id = staff_user_id;
      end if;
    end if;
  end loop;
end;
$$;


ALTER FUNCTION "public"."update_employee_roles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_properties"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare 
  response_id bigint;
  http_status int;
  json_data jsonb;
  property_data jsonb;
  property_id bigint;
  address_id bigint;
  loc_geom extensions.geometry;
  loc_place_id text;
begin
  -- Call GET request for staff
  select public.http_get_properties() into response_id;

  ASSERT ((SELECT 1 FROM public.http_response WHERE id = response_id));
  
  -- Place Staff data into json object
  select status, content
  into http_status, json_data
  from public.http_response 
  where id = response_id;

  if http_status != 200 then
    insert into public.error_log (function_name, error_message)
    values ('update_properties', concat('GET Properties status code not 200 --> ', http_status, ' Response Id --> ', response_id));
    return;
  end if;

  -- Loop through each property in the json data
  for property_data in
    select * from jsonb_array_elements((json_data->>'data')::jsonb)
  loop
    address_id = null;
    -- Get the property_id from the json object
    select (property_data#>>'{properties,properties_id}')::bigint into property_id;

    -- Update or create address of property
    if ((property_data#>>'{properties,Address,address}') is not null) then
      if exists (select 1 from public.rc_addresses where address = (property_data#>>'{properties,Address,address}')::text) then
          select id into address_id from public.rc_addresses where address = (property_data#>>'{properties,Address,address}')::text;
      else
        select g.geom, g.place_id into loc_geom, loc_place_id from public.get_geom_and_placeid_from_address(concat(
            property_data#>>'{properties,Address,address}', ', ', 
            property_data#>>'{properties,Address,city}', ', ', 
            property_data#>>'{properties,Address,State,state_name}', ' ', 
            property_data#>>'{properties,Address,postal_code}', ', ', 
            property_data#>>'{properties,Address,Country,country}'
          )) as g;
        insert into public.rc_addresses (address, city, postal_code, state_name, country_code, country, location, place_id)
        values (
          property_data#>>'{properties,Address,address}',
          property_data#>>'{properties,Address,city}',
          property_data#>>'{properties,Address,postal_code}',
          property_data#>>'{properties,Address,State,state_name}',
          property_data#>>'{properties,Address,Country,country_code}',
          property_data#>>'{properties,Address,Country,country}',
          loc_geom,
          loc_place_id
        )
        returning id into address_id;
        perform public.set_travel_times(address_id);
      end if;
    end if;

    -- Check if the property_id already exists in properties table
    if exists (select 1 from public.rc_properties where properties_id = property_id) then
      -- Update the existing record
      update public.rc_properties
      set
        property_name = property_data#>>'{properties,property_name}',
        address = address_id,
        status_id = (property_data#>>'{Status,status_id}')::smallint
      where properties_id = property_id;
    else
      -- Add a new property record
      insert into public.rc_properties (properties_id, property_name, address, status_id)
      values (
        property_id,
        property_data#>>'{properties,property_name}',
        address_id,
        (property_data#>>'{Status,status_id}')::smallint
      );
    end if;
  end loop;
end;
$$;


ALTER FUNCTION "public"."update_properties"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_staff"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare 
  response_id bigint;
  http_status int;
  json_data jsonb;
  user_data jsonb;
  staff_user_id bigint;
  log_id bigint;
begin

  -- Call GET request for staff
  select public.http_get_staff() into response_id;

  ASSERT ((SELECT 1 FROM public.http_response WHERE id = response_id));
  
  -- Place Staff data into json object
  select h.status, h.content
  into http_status, json_data
  from public.http_response as h
  where id = response_id;

  if http_status != 200 then
    insert into public.error_log (function_name, error_message)
    values ('update_staff', concat('GET Staff status code not 200 --> ', http_status, ' Response Id --> ', response_id));
    return;
  end if;

  -- Loop through each user in the json data
  for user_data in
    select * from jsonb_array_elements((json_data->>'data')::jsonb)
  loop
    -- Get the user_id from the json object
    select (user_data->>'user_id')::bigint into staff_user_id;
    -- Check if the user_id already exists in staff table
    if exists (select 1 from public.rc_staff where user_id = staff_user_id) then
      -- Update the existing record
      update public.rc_staff
      set
        name = user_data->>'name',
        first_name = user_data->>'first_name',
        last_name = user_data->>'last_name',
        status_id = (user_data#>>'{Status,status_id}')::smallint
      where user_id = staff_user_id;
    else
      -- Add a new staff record
      insert into public.rc_staff (user_id, name, first_name, last_name, status_id)
      values (
        staff_user_id,
        user_data->>'name',
        user_data->>'first_name',
        user_data->>'last_name',
        (user_data#>>'{Status,status_id}')::smallint
      );
    end if;
  end loop;

  perform public.update_employee_roles();
end;
$$;


ALTER FUNCTION "public"."update_staff"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."appointment_status_key" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status_id" smallint NOT NULL,
    "status" "text"
);


ALTER TABLE "public"."appointment_status_key" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments_staff" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "appointment_id" bigint,
    "staff_id" bigint
);


ALTER TABLE "public"."appointments_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rc_appointments" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "appointment_id" bigint,
    "arrival_time" timestamp with time zone,
    "departure_time" timestamp with time zone,
    "next_arrival_time" timestamp with time zone,
    "turn_around" boolean,
    "app_status_id" smallint,
    "property" bigint,
    "cancelled_date" timestamp with time zone,
    "service" bigint
);


ALTER TABLE "public"."rc_appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rc_properties" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "properties_id" bigint,
    "property_name" "text",
    "address" bigint,
    "status_id" smallint,
    "estimated_cleaning_mins" smallint,
    "double_unit" bigint[]
);


ALTER TABLE "public"."rc_properties" OWNER TO "postgres";


COMMENT ON COLUMN "public"."rc_properties"."estimated_cleaning_mins" IS 'Estimated time in minutes cleaning the property will take for one person';



CREATE TABLE IF NOT EXISTS "public"."rc_staff" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" bigint,
    "name" "text",
    "first_name" "text",
    "last_name" "text",
    "status_id" smallint,
    "role" bigint,
    "hb_user_id" bigint
);


ALTER TABLE "public"."rc_staff" OWNER TO "postgres";


COMMENT ON COLUMN "public"."rc_staff"."hb_user_id" IS 'Homebase specific User ID matched by name between ResortCleaning and Homebase';



CREATE TABLE IF NOT EXISTS "public"."service_key" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "service_id" bigint NOT NULL,
    "name" "text"
);


ALTER TABLE "public"."service_key" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."appointment_details" WITH ("security_invoker"='on') AS
 SELECT "a"."appointment_id",
    "a"."departure_time",
    "p"."property_name",
    "s"."name" AS "staff_name",
    "a"."turn_around",
    "a"."next_arrival_time" AS "next_arrival",
    "ask"."status",
    "sk"."name" AS "service_name"
   FROM ((((("public"."rc_appointments" "a"
     JOIN "public"."rc_properties" "p" ON (("a"."property" = "p"."properties_id")))
     LEFT JOIN "public"."appointments_staff" "ast" ON (("a"."appointment_id" = "ast"."appointment_id")))
     LEFT JOIN "public"."rc_staff" "s" ON (("ast"."staff_id" = "s"."user_id")))
     LEFT JOIN "public"."appointment_status_key" "ask" ON (("a"."app_status_id" = "ask"."status_id")))
     LEFT JOIN "public"."service_key" "sk" ON (("a"."service" = "sk"."service_id")))
  ORDER BY ("date"("a"."departure_time")) DESC, "s"."name", "p"."property_name", "a"."appointment_id";


ALTER VIEW "public"."appointment_details" OWNER TO "postgres";


ALTER TABLE "public"."appointment_status_key" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."appointment_status_key_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."appointments_staff" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."appointments_staff_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."rc_tokens" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "access_token" "text",
    "expires" timestamp with time zone
);


ALTER TABLE "public"."rc_tokens" OWNER TO "postgres";


SECURITY LABEL FOR "pgsodium" ON COLUMN "public"."rc_tokens"."access_token" IS 'ENCRYPT WITH KEY ID b812bcee-378e-4d89-91db-d4d21313361d';



CREATE OR REPLACE VIEW "public"."decrypted_rc_tokens" WITH ("security_invoker"='on') AS
 SELECT "id",
    "created_at",
    "access_token",
        CASE
            WHEN ("access_token" IS NULL) THEN NULL::"text"
            ELSE
            CASE
                WHEN ('b812bcee-378e-4d89-91db-d4d21313361d' IS NULL) THEN NULL::"text"
                ELSE "convert_from"("pgsodium"."crypto_aead_det_decrypt"("decode"("access_token", 'base64'::"text"), "convert_to"(''::"text", 'utf8'::"name"), 'b812bcee-378e-4d89-91db-d4d21313361d'::"uuid", NULL::"bytea"), 'utf8'::"name")
            END
        END AS "decrypted_access_token",
    "expires"
   FROM "public"."rc_tokens";


ALTER VIEW "public"."decrypted_rc_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."error_log" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "function_name" "text",
    "error_message" "text"
);


ALTER TABLE "public"."error_log" OWNER TO "postgres";


ALTER TABLE "public"."error_log" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."error_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."http_response" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" integer,
    "content_type" "text",
    "headers" "text",
    "content" "text"
);


ALTER TABLE "public"."http_response" OWNER TO "postgres";


ALTER TABLE "public"."http_response" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."http_response_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."plan_appointments" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plan_id" bigint,
    "appointment_id" bigint,
    "sent_to_rc" timestamp with time zone,
    "valid" boolean DEFAULT false NOT NULL,
    "ord" smallint
);


ALTER TABLE "public"."plan_appointments" OWNER TO "postgres";


ALTER TABLE "public"."plan_appointments" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."plan_appointments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."plan_staff" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plan_id" bigint,
    "staff_id" bigint,
    "valid" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."plan_staff" OWNER TO "postgres";


ALTER TABLE "public"."plan_staff" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."plan_staff_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."schedule_plans" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plan_date" "date",
    "team" smallint,
    "valid" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."schedule_plans" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."planned_appointment_ids" WITH ("security_invoker"='on') AS
 SELECT "plan"."id" AS "plan_id",
    "plan"."plan_date",
    "pa"."appointment_id"
   FROM ("public"."schedule_plans" "plan"
     JOIN "public"."plan_appointments" "pa" ON (("pa"."plan_id" = "plan"."id")))
  WHERE (("plan"."valid" = true) AND ("pa"."valid" = true))
  ORDER BY "plan"."plan_date" DESC, "plan"."id" DESC, "pa"."appointment_id";


ALTER VIEW "public"."planned_appointment_ids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_status_key" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status_id" smallint NOT NULL,
    "status" "text"
);


ALTER TABLE "public"."property_status_key" OWNER TO "postgres";


ALTER TABLE "public"."property_status_key" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."property_status_key_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."rc_addresses" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "address" "text",
    "city" "text",
    "postal_code" "text",
    "state_name" "text" DEFAULT 'California'::"text",
    "country_code" "text" DEFAULT 'US'::"text",
    "country" "text" DEFAULT 'USA'::"text",
    "location" "extensions"."geometry"(Point,4326),
    "place_id" "text"
);


ALTER TABLE "public"."rc_addresses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."rc_addresses"."place_id" IS 'Google Maps Place Id';



ALTER TABLE "public"."rc_addresses" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."rc_addresses_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."rc_appointments" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."rc_appointments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."rc_properties" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."rc_properties_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."rc_staff" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."rc_staff_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."rc_tokens" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."rc_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" bigint NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "permission" "public"."app_permission" NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."role_permissions" IS 'Application permissions for each role.';



ALTER TABLE "public"."role_permissions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."role_permissions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "priority" integer DEFAULT 500 NOT NULL,
    "title" "text",
    "description" "text",
    "can_lead_team" boolean DEFAULT false NOT NULL,
    "can_clean" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."roles" IS 'Job titles populated by Homebase but all other attributes are managed in AcornArranger';



COMMENT ON COLUMN "public"."roles"."can_lead_team" IS 'Boolean for if a staff member can lead a housekeeping team or not';



COMMENT ON COLUMN "public"."roles"."can_clean" IS 'If staff should be considered in scheduling process for appointments';



CREATE OR REPLACE VIEW "public"."schedule_plan_details" WITH ("security_invoker"='on') AS
 SELECT "a"."appointment_id",
    "a"."departure_time",
    "sp"."team",
    "p"."property_name",
    "s"."name" AS "staff_name",
    "a"."next_arrival_time" AS "next_arrival",
    "sk"."name" AS "service_name",
    "pa"."sent_to_rc",
    "p"."estimated_cleaning_mins",
    "pa"."ord",
    "ask"."status"
   FROM ((((((("public"."schedule_plans" "sp"
     JOIN "public"."plan_appointments" "pa" ON (("pa"."plan_id" = "sp"."id")))
     JOIN "public"."rc_appointments" "a" ON (("a"."appointment_id" = "pa"."appointment_id")))
     JOIN "public"."rc_properties" "p" ON (("a"."property" = "p"."properties_id")))
     LEFT JOIN "public"."plan_staff" "ps" ON (("ps"."plan_id" = "sp"."id")))
     LEFT JOIN "public"."rc_staff" "s" ON (("ps"."staff_id" = "s"."user_id")))
     LEFT JOIN "public"."appointment_status_key" "ask" ON (("a"."app_status_id" = "ask"."status_id")))
     LEFT JOIN "public"."service_key" "sk" ON (("a"."service" = "sk"."service_id")))
  WHERE (("sp"."valid" = true) AND ("pa"."valid" = true) AND (("ps"."staff_id" IS NULL) OR ("ps"."valid" = true)))
  ORDER BY ("date"("a"."departure_time")) DESC, "sp"."team", "s"."name", "pa"."ord" DESC, "p"."property_name", "a"."appointment_id";


ALTER VIEW "public"."schedule_plan_details" OWNER TO "postgres";


ALTER TABLE "public"."schedule_plans" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."schedule_plans_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."send_schedule_job_queue" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "schedule_date" "date",
    "status" "text" DEFAULT 'pending'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."send_schedule_job_queue" OWNER TO "postgres";


ALTER TABLE "public"."send_schedule_job_queue" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."send_schedule_job_queue_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."service_key" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."service_key_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."staff_status_key" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status_id" smallint NOT NULL,
    "status" "text"
);


ALTER TABLE "public"."staff_status_key" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."staff_details" WITH ("security_invoker"='on') AS
 SELECT "s"."user_id",
    "s"."name",
    "ssk"."status",
    "r"."title"
   FROM (("public"."rc_staff" "s"
     LEFT JOIN "public"."staff_status_key" "ssk" ON (("s"."status_id" = "ssk"."status_id")))
     LEFT JOIN "public"."roles" "r" ON (("s"."role" = "r"."id")))
  ORDER BY "s"."status_id", "s"."name";


ALTER VIEW "public"."staff_details" OWNER TO "postgres";


ALTER TABLE "public"."staff_status_key" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."staff_status_key_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."titles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."travel_times" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "src_address_id" bigint NOT NULL,
    "dest_address_id" bigint NOT NULL,
    "travel_time_minutes" smallint NOT NULL,
    "distance_in_meters" integer
);


ALTER TABLE "public"."travel_times" OWNER TO "postgres";


ALTER TABLE "public"."travel_times" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."travel_times_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_roles" IS 'Application roles for each user.';



ALTER TABLE "public"."user_roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "email" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'Profile data for each user.';



COMMENT ON COLUMN "public"."users"."id" IS 'References the internal Supabase Auth user.';



ALTER TABLE ONLY "public"."rc_addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_status_key"
    ADD CONSTRAINT "appointment_status_key_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_status_key"
    ADD CONSTRAINT "appointment_status_key_status_id_key" UNIQUE ("status_id");



ALTER TABLE ONLY "public"."rc_appointments"
    ADD CONSTRAINT "appointments_appointment_id_key" UNIQUE ("appointment_id");



ALTER TABLE ONLY "public"."rc_appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointments_staff"
    ADD CONSTRAINT "appointments_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."error_log"
    ADD CONSTRAINT "error_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."http_response"
    ADD CONSTRAINT "http_response_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_appointments"
    ADD CONSTRAINT "plan_appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_staff"
    ADD CONSTRAINT "plan_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rc_properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rc_properties"
    ADD CONSTRAINT "properties_properties_id_key" UNIQUE ("properties_id");



ALTER TABLE ONLY "public"."property_status_key"
    ADD CONSTRAINT "property_status_key_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_status_key"
    ADD CONSTRAINT "property_status_key_status_id_key" UNIQUE ("status_id");



ALTER TABLE ONLY "public"."rc_tokens"
    ADD CONSTRAINT "rc_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_permission_key" UNIQUE ("role", "permission");



ALTER TABLE ONLY "public"."schedule_plans"
    ADD CONSTRAINT "schedule_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."send_schedule_job_queue"
    ADD CONSTRAINT "send_schedule_job_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_key"
    ADD CONSTRAINT "service_key_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_key"
    ADD CONSTRAINT "service_key_service_id_key" UNIQUE ("service_id");



ALTER TABLE ONLY "public"."travel_times"
    ADD CONSTRAINT "source_destination_unique" UNIQUE ("src_address_id", "dest_address_id");



ALTER TABLE ONLY "public"."rc_staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_status_key"
    ADD CONSTRAINT "staff_status_key_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_status_key"
    ADD CONSTRAINT "staff_status_key_status_id_key" UNIQUE ("status_id");



ALTER TABLE ONLY "public"."rc_staff"
    ADD CONSTRAINT "staff_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "titles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."travel_times"
    ADD CONSTRAINT "travel_times_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "appointments_staff_appointment_id_idx" ON "public"."appointments_staff" USING "btree" ("appointment_id");



CREATE INDEX "plan_appointments_appointment_id_idx" ON "public"."plan_appointments" USING "btree" ("appointment_id");



CREATE INDEX "plan_appointments_plan_id_idx" ON "public"."plan_appointments" USING "btree" ("plan_id");



CREATE INDEX "plan_staff_plan_id_idx" ON "public"."plan_staff" USING "btree" ("plan_id");



CREATE INDEX "travel_times_dest_address_id_idx" ON "public"."travel_times" USING "btree" ("dest_address_id");



CREATE INDEX "travel_times_src_address_id_idx" ON "public"."travel_times" USING "btree" ("src_address_id");



CREATE OR REPLACE TRIGGER "rc_tokens_encrypt_secret_trigger_access_token" BEFORE INSERT OR UPDATE OF "access_token" ON "public"."rc_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."rc_tokens_encrypt_secret_access_token"();



ALTER TABLE ONLY "public"."appointments_staff"
    ADD CONSTRAINT "appointments_staff_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."rc_appointments"("appointment_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments_staff"
    ADD CONSTRAINT "appointments_staff_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."rc_staff"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."plan_appointments"
    ADD CONSTRAINT "public_plan_appointments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."rc_appointments"("appointment_id");



ALTER TABLE ONLY "public"."plan_appointments"
    ADD CONSTRAINT "public_plan_appointments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."schedule_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_staff"
    ADD CONSTRAINT "public_plan_staff_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."schedule_plans"("id");



ALTER TABLE ONLY "public"."plan_staff"
    ADD CONSTRAINT "public_plan_staff_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."rc_staff"("user_id");



ALTER TABLE ONLY "public"."rc_properties"
    ADD CONSTRAINT "public_rc_properties_address_fkey" FOREIGN KEY ("address") REFERENCES "public"."rc_addresses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rc_staff"
    ADD CONSTRAINT "public_rc_staff_role_fkey" FOREIGN KEY ("role") REFERENCES "public"."roles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."travel_times"
    ADD CONSTRAINT "public_travel_times_dest_address_id_fkey" FOREIGN KEY ("dest_address_id") REFERENCES "public"."rc_addresses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."travel_times"
    ADD CONSTRAINT "public_travel_times_src_address_id_fkey" FOREIGN KEY ("src_address_id") REFERENCES "public"."rc_addresses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rc_appointments"
    ADD CONSTRAINT "rc_appointments_app_status_id_fkey" FOREIGN KEY ("app_status_id") REFERENCES "public"."appointment_status_key"("status_id");



ALTER TABLE ONLY "public"."rc_appointments"
    ADD CONSTRAINT "rc_appointments_property_fkey" FOREIGN KEY ("property") REFERENCES "public"."rc_properties"("properties_id");



ALTER TABLE ONLY "public"."rc_appointments"
    ADD CONSTRAINT "rc_appointments_service_fkey" FOREIGN KEY ("service") REFERENCES "public"."service_key"("service_id");



ALTER TABLE ONLY "public"."rc_properties"
    ADD CONSTRAINT "rc_properties_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."property_status_key"("status_id");



ALTER TABLE ONLY "public"."rc_staff"
    ADD CONSTRAINT "rc_staff_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."staff_status_key"("status_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



CREATE POLICY "Allow auth admin to read user roles" ON "public"."user_roles" FOR SELECT TO "supabase_auth_admin" USING (true);



CREATE POLICY "Allow authorized insert access" ON "public"."error_log" FOR INSERT WITH CHECK ("public"."authorize"('error_log.insert'::"public"."app_permission"));



CREATE POLICY "Allow authorized insert access" ON "public"."http_response" FOR INSERT WITH CHECK ("public"."authorize"('http_response.insert'::"public"."app_permission"));



CREATE POLICY "Allow authorized insert access" ON "public"."plan_appointments" FOR INSERT WITH CHECK ("public"."authorize"('plan_appointments.insert'::"public"."app_permission"));



CREATE POLICY "Allow authorized insert access" ON "public"."plan_staff" FOR INSERT WITH CHECK ("public"."authorize"('plan_staff.insert'::"public"."app_permission"));



CREATE POLICY "Allow authorized insert access" ON "public"."schedule_plans" FOR INSERT WITH CHECK ("public"."authorize"('schedule_plans.insert'::"public"."app_permission"));



CREATE POLICY "Allow authorized insert access" ON "public"."send_schedule_job_queue" FOR INSERT WITH CHECK ("public"."authorize"('send_schedule_job_queue.insert'::"public"."app_permission"));



CREATE POLICY "Allow authorized read access" ON "public"."appointments_staff" FOR SELECT USING ("public"."authorize"('appointments_staff.select'::"public"."app_permission"));



CREATE POLICY "Allow authorized read access" ON "public"."error_log" FOR SELECT USING ("public"."authorize"('error_log.select'::"public"."app_permission"));



CREATE POLICY "Allow authorized read access" ON "public"."http_response" FOR SELECT USING ("public"."authorize"('http_response.select'::"public"."app_permission"));



CREATE POLICY "Allow authorized read access" ON "public"."plan_appointments" FOR SELECT USING ("public"."authorize"('plan_appointments.select'::"public"."app_permission"));



CREATE POLICY "Allow authorized read access" ON "public"."plan_staff" FOR SELECT USING ("public"."authorize"('plan_staff.select'::"public"."app_permission"));



CREATE POLICY "Allow authorized read access" ON "public"."rc_addresses" FOR SELECT USING ("public"."authorize"('rc_addresses.select'::"public"."app_permission"));



CREATE POLICY "Allow authorized read access" ON "public"."rc_appointments" FOR SELECT USING ("public"."authorize"('rc_appointments.select'::"public"."app_permission"));



CREATE POLICY "Allow authorized read access" ON "public"."rc_properties" FOR SELECT USING ("public"."authorize"('rc_properties.select'::"public"."app_permission"));



CREATE POLICY "Allow authorized read access" ON "public"."rc_staff" FOR SELECT USING ("public"."authorize"('rc_staff.select'::"public"."app_permission"));



CREATE POLICY "Allow authorized read access" ON "public"."rc_tokens" FOR SELECT USING ("public"."authorize"('rc_tokens.select'::"public"."app_permission"));



CREATE POLICY "Allow authorized read access" ON "public"."roles" FOR SELECT USING ("public"."authorize"('roles.select'::"public"."app_permission"));



CREATE POLICY "Allow authorized read access" ON "public"."schedule_plans" FOR SELECT USING ("public"."authorize"('schedule_plans.select'::"public"."app_permission"));



CREATE POLICY "Allow authorized read access" ON "public"."travel_times" FOR SELECT USING ("public"."authorize"('travel_times.select'::"public"."app_permission"));



CREATE POLICY "Allow authorized update access" ON "public"."plan_appointments" FOR UPDATE USING ("public"."authorize"('plan_appointments.update'::"public"."app_permission"));



CREATE POLICY "Allow authorized update access" ON "public"."plan_staff" FOR UPDATE USING ("public"."authorize"('plan_staff.update'::"public"."app_permission"));



CREATE POLICY "Allow authorized update access" ON "public"."rc_properties" FOR UPDATE USING ("public"."authorize"('rc_properties.update'::"public"."app_permission"));



CREATE POLICY "Allow authorized update access" ON "public"."roles" FOR UPDATE USING ("public"."authorize"('roles.update'::"public"."app_permission"));



CREATE POLICY "Allow authorized update access" ON "public"."schedule_plans" FOR UPDATE USING ("public"."authorize"('schedule_plans.update'::"public"."app_permission"));



CREATE POLICY "Allow individual insert access" ON "public"."users" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Allow individual read access" ON "public"."user_roles" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Allow individual read access" ON "public"."users" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Allow individual update access" ON "public"."users" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Allow logged-in read access" ON "public"."appointment_status_key" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Allow logged-in read access" ON "public"."property_status_key" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Allow logged-in read access" ON "public"."service_key" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Allow logged-in read access" ON "public"."staff_status_key" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



ALTER TABLE "public"."appointment_status_key" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointments_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."error_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."http_response" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_status_key" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rc_addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rc_appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rc_properties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rc_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rc_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."send_schedule_job_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_key" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_status_key" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."travel_times" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."error_log";






GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";
GRANT USAGE ON SCHEMA "public" TO "postgres";










































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."authorize"("requested_permission" "public"."app_permission") TO "anon";
GRANT ALL ON FUNCTION "public"."authorize"("requested_permission" "public"."app_permission") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authorize"("requested_permission" "public"."app_permission") TO "service_role";






GRANT ALL ON FUNCTION "public"."copy_schedule_plan"("schedule_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."copy_schedule_plan"("schedule_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."copy_schedule_plan"("schedule_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "supabase_auth_admin";






GRANT ALL ON FUNCTION "public"."get_geom_from_address"("address" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_geom_from_address"("address" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_geom_from_address"("address" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_rc_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_rc_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rc_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_staff_shifts"("date_from" "date", "date_to" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_staff_shifts"("date_from" "date", "date_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_staff_shifts"("date_from" "date", "date_to" "date") TO "service_role";






GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get_appointments"("date_from" timestamp with time zone, "date_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."http_get_appointments"("date_from" timestamp with time zone, "date_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get_appointments"("date_from" timestamp with time zone, "date_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get_distance_matrix"("origin_place_ids" "text"[], "destination_place_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."http_get_distance_matrix"("origin_place_ids" "text"[], "destination_place_ids" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get_distance_matrix"("origin_place_ids" "text"[], "destination_place_ids" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get_employees"() TO "anon";
GRANT ALL ON FUNCTION "public"."http_get_employees"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get_employees"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get_geocode"("address" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."http_get_geocode"("address" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get_geocode"("address" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get_properties"() TO "anon";
GRANT ALL ON FUNCTION "public"."http_get_properties"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get_properties"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get_shifts"("date_from" timestamp with time zone, "date_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."http_get_shifts"("date_from" timestamp with time zone, "date_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get_shifts"("date_from" timestamp with time zone, "date_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."http_get_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http_put_appointment_staff"("appointment_id" bigint, "assignment_json" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."http_put_appointment_staff"("appointment_id" bigint, "assignment_json" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_put_appointment_staff"("appointment_id" bigint, "assignment_json" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."plan_add_appointment"("target_plan" bigint, "appointment_to_add" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."plan_add_appointment"("target_plan" bigint, "appointment_to_add" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."plan_add_appointment"("target_plan" bigint, "appointment_to_add" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."plan_add_staff"("target_plan" bigint, "staff_to_add" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."plan_add_staff"("target_plan" bigint, "staff_to_add" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."plan_add_staff"("target_plan" bigint, "staff_to_add" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."plan_create_new"("target_plan_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."plan_create_new"("target_plan_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."plan_create_new"("target_plan_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."plan_remove_appointment"("target_plan" bigint, "appointment_to_remove" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."plan_remove_appointment"("target_plan" bigint, "appointment_to_remove" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."plan_remove_appointment"("target_plan" bigint, "appointment_to_remove" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."plan_remove_staff"("target_plan" bigint, "staff_to_remove" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."plan_remove_staff"("target_plan" bigint, "staff_to_remove" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."plan_remove_staff"("target_plan" bigint, "staff_to_remove" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_send_schedule_job_queue"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_send_schedule_job_queue"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_send_schedule_job_queue"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rc_tokens_encrypt_secret_access_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."rc_tokens_encrypt_secret_access_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rc_tokens_encrypt_secret_access_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."schedule_send_rc_schedule_plans"("schedule_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."schedule_send_rc_schedule_plans"("schedule_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."schedule_send_rc_schedule_plans"("schedule_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_rc_schedule_plans"("schedule_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."send_rc_schedule_plans"("schedule_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_rc_schedule_plans"("schedule_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_rc_appointment_staff"("appointment_id" bigint, "staff_ids" bigint[]) TO "anon";
GRANT ALL ON FUNCTION "public"."set_rc_appointment_staff"("appointment_id" bigint, "staff_ids" bigint[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_rc_appointment_staff"("appointment_id" bigint, "staff_ids" bigint[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_staff_group"("appt_id" bigint, "staff_json" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."set_staff_group"("appt_id" bigint, "staff_json" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_staff_group"("appt_id" bigint, "staff_json" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_travel_times"("address_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."set_travel_times"("address_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_travel_times"("address_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_appointments"("date_from" timestamp with time zone, "date_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."update_appointments"("date_from" timestamp with time zone, "date_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_appointments"("date_from" timestamp with time zone, "date_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_employee_roles"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_employee_roles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_employee_roles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_properties"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_properties"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_properties"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_staff"() TO "service_role";





























































































GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."appointment_status_key" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."appointment_status_key" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."appointment_status_key" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."appointments_staff" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."appointments_staff" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."appointments_staff" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."rc_appointments" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."rc_appointments" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."rc_appointments" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."rc_properties" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."rc_properties" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."rc_properties" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."rc_staff" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."rc_staff" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."rc_staff" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."service_key" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."service_key" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."service_key" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."appointment_details" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."appointment_details" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."appointment_details" TO "service_role";



GRANT ALL ON SEQUENCE "public"."appointment_status_key_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."appointment_status_key_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."appointment_status_key_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."appointments_staff_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."appointments_staff_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."appointments_staff_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."rc_tokens" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."rc_tokens" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."rc_tokens" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."decrypted_rc_tokens" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."decrypted_rc_tokens" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."decrypted_rc_tokens" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."error_log" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."error_log" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."error_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."error_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."error_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."error_log_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."http_response" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."http_response" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."http_response" TO "service_role";



GRANT ALL ON SEQUENCE "public"."http_response_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."http_response_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."http_response_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."plan_appointments" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."plan_appointments" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."plan_appointments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."plan_appointments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."plan_appointments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."plan_appointments_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."plan_staff" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."plan_staff" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."plan_staff" TO "service_role";



GRANT ALL ON SEQUENCE "public"."plan_staff_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."plan_staff_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."plan_staff_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."schedule_plans" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."schedule_plans" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."schedule_plans" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."planned_appointment_ids" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."planned_appointment_ids" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."planned_appointment_ids" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."property_status_key" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."property_status_key" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."property_status_key" TO "service_role";



GRANT ALL ON SEQUENCE "public"."property_status_key_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."property_status_key_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."property_status_key_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."rc_addresses" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."rc_addresses" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."rc_addresses" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rc_addresses_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rc_addresses_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rc_addresses_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rc_appointments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rc_appointments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rc_appointments_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rc_properties_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rc_properties_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rc_properties_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rc_staff_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rc_staff_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rc_staff_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rc_tokens_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rc_tokens_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rc_tokens_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."role_permissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."role_permissions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."role_permissions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."role_permissions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."role_permissions_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."roles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."roles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."roles" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."schedule_plan_details" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."schedule_plan_details" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."schedule_plan_details" TO "service_role";



GRANT ALL ON SEQUENCE "public"."schedule_plans_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."schedule_plans_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."schedule_plans_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."send_schedule_job_queue" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."send_schedule_job_queue" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."send_schedule_job_queue" TO "service_role";



GRANT ALL ON SEQUENCE "public"."send_schedule_job_queue_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."send_schedule_job_queue_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."send_schedule_job_queue_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."service_key_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."service_key_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."service_key_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."staff_status_key" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."staff_status_key" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."staff_status_key" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."staff_details" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."staff_details" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."staff_details" TO "service_role";



GRANT ALL ON SEQUENCE "public"."staff_status_key_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."staff_status_key_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."staff_status_key_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."titles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."titles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."titles_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."travel_times" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."travel_times" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."travel_times" TO "service_role";



GRANT ALL ON SEQUENCE "public"."travel_times_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."travel_times_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."travel_times_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_roles" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_roles" TO "supabase_auth_admin";



GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "service_role";































drop extension if exists "pg_net";

revoke delete on table "public"."user_roles" from "anon";

revoke insert on table "public"."user_roles" from "anon";

revoke references on table "public"."user_roles" from "anon";

revoke select on table "public"."user_roles" from "anon";

revoke trigger on table "public"."user_roles" from "anon";

revoke truncate on table "public"."user_roles" from "anon";

revoke update on table "public"."user_roles" from "anon";

revoke delete on table "public"."user_roles" from "authenticated";

revoke insert on table "public"."user_roles" from "authenticated";

revoke references on table "public"."user_roles" from "authenticated";

revoke select on table "public"."user_roles" from "authenticated";

revoke trigger on table "public"."user_roles" from "authenticated";

revoke truncate on table "public"."user_roles" from "authenticated";

revoke update on table "public"."user_roles" from "authenticated";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


