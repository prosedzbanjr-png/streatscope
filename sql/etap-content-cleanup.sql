alter table public.guide_places
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by text;

create index if not exists guide_places_archive_idx
  on public.guide_places(archived_at, active, review_status);
