create table if not exists public.homepage_slots (
  slot text primary key,
  source_type text not null check (source_type in ('article','fashion','motor','guide')),
  source_id bigint not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.homepage_slots enable row level security;

drop policy if exists "homepage slots public read" on public.homepage_slots;
create policy "homepage slots public read"
on public.homepage_slots
for select
to anon, authenticated
using (true);

grant select on public.homepage_slots to anon, authenticated;

comment on table public.homepage_slots is 'Manual StreetScope homepage placement: hero, card1-card4, brief1-brief5.';
