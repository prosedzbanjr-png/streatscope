alter table public.street_features
  add column if not exists editor_take text,
  add column if not exists score_style numeric(3,1),
  add column if not exists score_originality numeric(3,1),
  add column if not exists score_details numeric(3,1),
  add column if not exists score_build numeric(3,1),
  add column if not exists score_overall numeric(3,1),
  add column if not exists engine text,
  add column if not exists power text,
  add column if not exists drivetrain text,
  add column if not exists wheels text,
  add column if not exists suspension text,
  add column if not exists build_cost text;

alter table public.street_features
  drop constraint if exists street_features_score_style_check,
  drop constraint if exists street_features_score_originality_check,
  drop constraint if exists street_features_score_details_check,
  drop constraint if exists street_features_score_build_check,
  drop constraint if exists street_features_score_overall_check;

alter table public.street_features
  add constraint street_features_score_style_check check (score_style is null or score_style between 0 and 10),
  add constraint street_features_score_originality_check check (score_originality is null or score_originality between 0 and 10),
  add constraint street_features_score_details_check check (score_details is null or score_details between 0 and 10),
  add constraint street_features_score_build_check check (score_build is null or score_build between 0 and 10),
  add constraint street_features_score_overall_check check (score_overall is null or score_overall between 0 and 10);
