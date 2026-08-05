-- Public platform stats for marketing surfaces (landing hero, etc.)
create or replace function public.get_platform_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'creators', (select count(*)::int from public.profiles),
    'generations', (select count(*)::int from public.generations),
    'models', (select count(*)::int from public.model_catalog where active = true),
    'uptime_pct', coalesce((
      select round(
        (
          100.0 * count(*) filter (where application_status = 'completed')
        ) / nullif(
          count(*) filter (
            where application_status in ('completed', 'failed', 'failed_refunded')
          ),
          0
        ),
        1
      )
      from public.generations
    ), 100.0)
  );
$$;

revoke all on function public.get_platform_stats() from public;
grant execute on function public.get_platform_stats() to anon, authenticated;
