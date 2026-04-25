-- Exports a complete schedule-building fixture for a single plan_date as one JSON row.
-- Usage via MCP execute_sql (or psql with \set): replace the :plan_date_literal binding.
--
-- Bundles:
--   inputs         - what the build_schedule_plan RPC would be called with
--   appointments   - per-appointment problem data (location, window, cleaning mins, double-unit)
--   travel_times   - address-pair travel minutes (bidirectional, restricted subset)
--   staff          - staff roster with capabilities
--   ground_truth   - final approved plans/teams/staff/appointments for the day
--
-- Notes:
--   - `ord` (sequence) is null for recent plans; ground_truth.appointments therefore only
--     carries {appointment_id, sent_to_rc}. Edit-distance metric in compare.py has to rely
--     primarily on team-assignment, not ordering.
--   - Appointment eligibility = "any row that ever appeared in any plan (valid or invalid)
--     on this date." This is the closest reconstruction of what the builder saw at build time,
--     since rc_appointments.app_status_id has since advanced from 1/2 to 3/5.
--   - Office is not in rc_addresses; its coordinates live in the hard-coded default WKB. We
--     emit it as a separate lat/lon block and let the solver compute Haversine to/from it.

with params as (
  select
    :plan_date_literal::date as plan_date,
    -- Office default (AcornArranger/app/api/plans/build/[plan_date]/route.ts:6-7)
    '0101000020E6100000D2DB44D213E95DC01D12088552AC4240'::extensions.geometry as office_geom
),
day_appts_ids as (
  select distinct pa.appointment_id
  from schedule_plans sp
  join plan_appointments pa on pa.plan_id = sp.id
  join params on sp.plan_date = params.plan_date
),
appts_json as (
  select jsonb_agg(
    jsonb_build_object(
      'appointment_id',         a.appointment_id,
      'property_id',             a.property,
      'property_name',           p.property_name,
      'service',                 a.service,
      'app_status_id',           a.app_status_id,
      'app_status',              ask.status,
      'arrival_time',            a.arrival_time,
      'departure_time',          a.departure_time,
      'next_arrival_time',       a.next_arrival_time,
      'turn_around',             a.turn_around,
      'cancelled_date',          a.cancelled_date,
      'estimated_cleaning_mins', p.estimated_cleaning_mins,
      'double_unit',             p.double_unit,
      'address_id',              p.address,
      'lat',                     extensions.ST_Y(addr.location),
      'lon',                     extensions.ST_X(addr.location)
    )
    order by a.appointment_id
  ) as appointments
  from day_appts_ids d
  join rc_appointments a            on a.appointment_id = d.appointment_id
  join rc_properties   p            on p.properties_id = a.property
  join rc_addresses    addr          on addr.id = p.address
  left join appointment_status_key ask on ask.status_id = a.app_status_id
),
day_addrs as (
  select distinct p.address as address_id
  from day_appts_ids d
  join rc_appointments a on a.appointment_id = d.appointment_id
  join rc_properties   p on p.properties_id = a.property
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
  from travel_times tt
  where tt.src_address_id  in (select address_id from day_addrs)
    and tt.dest_address_id in (select address_id from day_addrs)
),
staff_ids as (
  select distinct ps.staff_id
  from schedule_plans sp
  join plan_staff ps on ps.plan_id = sp.id
  join params on sp.plan_date = params.plan_date
  where ps.staff_id is not null
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
    order by r.can_lead_team desc, r.priority, s.name
  ) as staff
  from staff_ids si
  join rc_staff s on s.user_id = si.staff_id
  join roles    r on r.id      = s.role
),
-- Ground truth: all final valid plans for the date
valid_plans as (
  select sp.id as plan_id, sp.team
  from schedule_plans sp
  join params on sp.plan_date = params.plan_date
  where sp.valid = true
),
gt_plan_staff_json as (
  select vp.plan_id,
         vp.team,
         jsonb_agg(
           jsonb_build_object(
             'staff_id', ps.staff_id,
             'name',     s.name,
             'can_lead', r.can_lead_team,
             'role',     r.title
           )
           order by r.can_lead_team desc, r.priority, s.name
         ) filter (where ps.valid) as staff_members
  from valid_plans vp
  left join plan_staff ps on ps.plan_id = vp.plan_id
  left join rc_staff   s  on s.user_id = ps.staff_id
  left join roles      r  on r.id = s.role
  group by vp.plan_id, vp.team
),
gt_plan_appts_json as (
  select vp.plan_id,
         jsonb_agg(
           jsonb_build_object(
             'appointment_id', pa.appointment_id,
             'ord',            pa.ord,
             'sent_to_rc',     pa.sent_to_rc,
             'was_sent',       (pa.sent_to_rc is not null)
           )
           order by pa.ord nulls last, pa.appointment_id
         ) filter (where pa.valid) as appointments
  from valid_plans vp
  left join plan_appointments pa on pa.plan_id = vp.plan_id
  group by vp.plan_id
),
ground_truth_json as (
  select jsonb_agg(
    jsonb_build_object(
      'plan_id',      vp.plan_id,
      'team',         vp.team,
      'staff',        coalesce(ps.staff_members, '[]'::jsonb),
      'appointments', coalesce(pa.appointments,  '[]'::jsonb)
    )
    order by vp.team
  ) as ground_truth
  from valid_plans vp
  left join gt_plan_staff_json ps on ps.plan_id = vp.plan_id
  left join gt_plan_appts_json pa on pa.plan_id = vp.plan_id
),
inputs_json as (
  -- Approximates PLAN_BUILD_DEFAULTS at build time. services/cleaning_window/max_hours
  -- match AcornArranger/src/features/plans/schemas.ts. available_staff is the set of
  -- staff who ended up on ANY plan for the date (valid or invalid).
  select jsonb_build_object(
    'available_staff',    (select jsonb_agg(staff_id order by staff_id) from staff_ids),
    'services',           jsonb_build_array(21942, 23044),
    'omissions',          '[]'::jsonb,
    'routing_type',       1,
    'cleaning_window',    6.0,
    'max_hours',          6.5,
    'target_staff_count', null,
    'office_location',    jsonb_build_object(
      'lat',     extensions.ST_Y(office_geom),
      'lon',     extensions.ST_X(office_geom),
      'wkb_hex', '0101000020E6100000D2DB44D213E95DC01D12088552AC4240'
    )
  ) as inputs
  from params
)
select jsonb_pretty(jsonb_build_object(
  'plan_date',    (select plan_date from params),
  'exported_at', now(),
  'inputs',       (select inputs from inputs_json),
  'appointments', (select appointments from appts_json),
  'travel_times', coalesce((select travel_times from travel_times_json), '[]'::jsonb),
  'staff',        coalesce((select staff from staff_json), '[]'::jsonb),
  'ground_truth', coalesce((select ground_truth from ground_truth_json), '[]'::jsonb)
)) as fixture;
