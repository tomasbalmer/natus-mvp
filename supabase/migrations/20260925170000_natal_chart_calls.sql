create table public.natal_chart_calls (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index natal_chart_calls_user_idx on public.natal_chart_calls (user_id, created_at desc);

alter table public.natal_chart_calls enable row level security;

grant select, insert on public.natal_chart_calls to service_role;
