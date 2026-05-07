alter type "public"."app_permission" add value if not exists 'homebase_shifts.read';

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
$function$
;

revoke execute on function public.http_get_shifts(
  date_from timestamp with time zone,
  date_to timestamp with time zone
) from anon, public;