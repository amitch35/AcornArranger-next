set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_appointments(date_from timestamp with time zone, date_to timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
      perform pubupdate_properties();
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
        arrival_time = TO_TIMESTAMP((appt_data->>'arrival_date') || ' ' || coalesce(appt_data->>'arrival_time', '00:00:00'), 'YYYY-MM-DD HH24:MI:SS'),
        departure_time = TO_TIMESTAMP((appt_data->>'departure_date') || ' ' || coalesce(appt_data->>'departure_time', '00:00:00'), 'YYYY-MM-DD HH24:MI:SS'),
        next_arrival_time = TO_TIMESTAMP((appt_data->>'next_arrival_date') || ' ' || coalesce(appt_data->>'next_arrival_time', '00:00:00'), 'YYYY-MM-DD HH24:MI:SS'),
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
$function$
;


