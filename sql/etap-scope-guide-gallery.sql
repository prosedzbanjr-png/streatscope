-- Scope Guide: galeria zdjęć dla wpisów
-- Uruchom ten plik raz w Supabase SQL Editor przed użyciem nowego formularza.

alter table public.guide_places
  add column if not exists gallery text[] not null default '{}';

comment on column public.guide_places.gallery is
  'Publiczne URL-e zdjęć galerii Scope Guide przechowywane w Supabase Storage.';
