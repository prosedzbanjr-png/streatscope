-- StreetScope: wspolna akceptacja LOOK / BUILD / SCOPE GUIDE

alter table public.street_features add column if not exists review_status text not null default 'published';
alter table public.street_features add column if not exists review_note text;
alter table public.street_features add column if not exists submitted_by text;
alter table public.street_features add column if not exists submitted_at timestamptz;
alter table public.street_features add column if not exists reviewed_by text;
alter table public.street_features add column if not exists reviewed_at timestamptz;

alter table public.guide_places add column if not exists review_status text not null default 'published';
alter table public.guide_places add column if not exists review_note text;
alter table public.guide_places add column if not exists submitted_by text;
alter table public.guide_places add column if not exists submitted_at timestamptz;
alter table public.guide_places add column if not exists reviewed_by text;
alter table public.guide_places add column if not exists reviewed_at timestamptz;

-- Istniejace wpisy pozostaja opublikowane.
update public.street_features set review_status='published' where review_status is null;
update public.guide_places set review_status='published' where review_status is null;

-- GUIDE: kazdy aktywny pracownik moze przygotowac wpis; tylko szefostwo moze zatwierdzac/cudze edytowac.
drop policy if exists "guide chief insert" on public.guide_places;
drop policy if exists "guide chief update" on public.guide_places;
drop policy if exists "guide staff insert" on public.guide_places;
drop policy if exists "guide staff update" on public.guide_places;

create policy "guide staff insert"
on public.guide_places for insert to authenticated
with check (
  exists (
    select 1 from public.staff_accounts s
    where lower(s.email)=lower(auth.jwt()->>'email') and s.active=true
  )
  and (
    submitted_by is null
    or lower(submitted_by)=lower(auth.jwt()->>'email')
  )
);

create policy "guide staff update"
on public.guide_places for update to authenticated
using (
  exists (
    select 1 from public.staff_accounts s
    where lower(s.email)=lower(auth.jwt()->>'email') and s.active=true
    and (
      s.role in ('editor_in_chief','deputy_editor_in_chief')
      or lower(coalesce(guide_places.submitted_by,''))=lower(auth.jwt()->>'email')
    )
  )
)
with check (
  exists (
    select 1 from public.staff_accounts s
    where lower(s.email)=lower(auth.jwt()->>'email') and s.active=true
    and (
      s.role in ('editor_in_chief','deputy_editor_in_chief')
      or lower(coalesce(guide_places.submitted_by,''))=lower(auth.jwt()->>'email')
    )
  )
);

create index if not exists street_features_review_idx on public.street_features(review_status, created_at desc);
create index if not exists guide_places_review_idx on public.guide_places(review_status, created_at desc);
