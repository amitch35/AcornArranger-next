set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_dashboard_lifetime_metrics()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with sent_plans as (
  select sp.id as plan_id, sp.plan_date
  from public.schedule_plans sp
  where sp.valid = true
    and exists (
      select 1 from public.plan_appointments pa
      where pa.plan_id = sp.id
        and pa.valid = true
        and pa.sent_to_rc is not null
    )
),
sent_pa as (
  select sp.plan_id, sp.plan_date, pa.appointment_id
  from sent_plans sp
  join public.plan_appointments pa
    on pa.plan_id = sp.plan_id
   and pa.valid = true
   and pa.sent_to_rc is not null
),
distinct_props as (
  select count(distinct a.property) as n
  from sent_pa s
  join public.rc_appointments a on a.appointment_id = s.appointment_id
),
distinct_staff as (
  select count(distinct ps.staff_id) as n
  from sent_plans sp
  join public.plan_staff ps
    on ps.plan_id = sp.plan_id
   and ps.valid = true
),
volume as (
  select
    count(distinct plan_date)               as days_with_sent_plan,
    count(*)                                as distinct_day_appointment_pairs,
    min(plan_date)                          as earliest,
    max(plan_date)                          as latest
  from (select distinct plan_date, appointment_id from sent_pa) t
),
per_day as (
  select plan_date, count(distinct appointment_id) as n_appts
  from sent_pa
  group by plan_date
),
per_day_stats as (
  select
    coalesce(min(n_appts), 0)                                          as min_per_day,
    coalesce(percentile_cont(0.25) within group (order by n_appts), 0) as p25,
    coalesce(percentile_cont(0.50) within group (order by n_appts), 0) as median,
    coalesce(percentile_cont(0.75) within group (order by n_appts), 0) as p75,
    coalesce(percentile_cont(0.95) within group (order by n_appts), 0) as p95,
    coalesce(max(n_appts), 0)                                          as max_per_day,
    coalesce(round(avg(n_appts)::numeric, 2), 0)                       as mean_per_day
  from per_day
),
per_day_hist as (
  select n_appts, count(*)::int as days
  from per_day
  group by n_appts
  order by n_appts
),
team_size as (
  select sp.plan_id, count(*) as team_size
  from sent_plans sp
  join public.plan_staff ps on ps.plan_id = sp.plan_id and ps.valid = true
  group by sp.plan_id
),
team_size_dist as (
  select team_size, count(*)::int as plans
  from team_size
  group by team_size
  order by team_size
),
teams_per_day as (
  select plan_date, count(distinct plan_id) as teams
  from sent_plans
  group by plan_date
),
teams_per_day_dist as (
  select teams as teams_per_day, count(*)::int as days
  from teams_per_day
  group by teams
  order by teams
)
select jsonb_build_object(
  'totals', jsonb_build_object(
    'distinct_properties_cleaned', (select n from distinct_props),
    'distinct_staff_used',         (select n from distinct_staff),
    'days_with_sent_plan',         (select days_with_sent_plan from volume),
    'distinct_day_appointment_pairs', (select distinct_day_appointment_pairs from volume),
    'earliest_plan_date',          (select earliest from volume),
    'latest_plan_date',            (select latest   from volume)
  ),
  'appointments_per_day', jsonb_build_object(
    'stats', (select to_jsonb(s) from per_day_stats s),
    'histogram', (select coalesce(jsonb_agg(jsonb_build_object('n_appts', n_appts, 'days', days)), '[]'::jsonb) from per_day_hist)
  ),
  'team_size_distribution',
    (select coalesce(jsonb_agg(jsonb_build_object('team_size', team_size, 'plans', plans)), '[]'::jsonb)
     from team_size_dist),
  'teams_per_day_distribution',
    (select coalesce(jsonb_agg(jsonb_build_object('teams_per_day', teams_per_day, 'days', days)), '[]'::jsonb)
     from teams_per_day_dist)
);
$function$
;


