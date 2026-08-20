set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_staff_shifts(date_from date, date_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare 
  response_id bigint;
  http_status int;
  json_data jsonb;
  shift_data jsonb;
  result_list jsonb := '[]'::jsonb;
  staff_user_id bigint;
  staff_name text;
begin

  if not public.authorize('homebase_shifts.read') then
    raise sqlstate 'PT403' using
      message = 'Unauthorized',
      detail  = 'get_staff_shifts: not allowed',
      hint    = 'You do not have permission to access this resource';
  end if;

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
    where hb_user_id = (shift_data->>'user_id')::bigint
      and status_id = 1
    limit 1;

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
$function$
;

CREATE OR REPLACE FUNCTION public.update_employee_roles()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
    -- Find Matching Staff in ResortCleaning Staff table (email first, soundex name fallback)
    staff_user_id := null;

    if (user_data->>'email') is not null then
      select user_id into staff_user_id
      from public.rc_staff
      where email = user_data->>'email'
      order by status_id asc
      limit 1;
    end if;

    if staff_user_id is null then
      select user_id into staff_user_id
      from public.rc_staff
      where extensions.soundex(first_name) = extensions.soundex(user_data->>'first_name')
        and extensions.soundex(last_name) = extensions.soundex(user_data->>'last_name')
      order by status_id asc
      limit 1;
    end if;

    if staff_user_id is not null then
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
$function$
;


