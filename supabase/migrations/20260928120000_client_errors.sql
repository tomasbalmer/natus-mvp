create table public.client_errors (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('render', 'error', 'rejection')),
  message    text not null,
  stack      text,
  path       text,
  user_agent text,
  release    text,
  created_at timestamptz not null default now()
);

create index client_errors_user_idx on public.client_errors (user_id, created_at desc);
create index client_errors_created_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

grant select, insert on public.client_errors to service_role;
