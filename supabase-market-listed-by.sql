-- Tow & Trade: osobne pole dla pracownika wystawiającego ofertę/licytację.
-- seller_name pozostaje faktycznym sprzedającym, więc zwykłe oferty działają normalnie.

alter table public.market_vehicles
add column if not exists listed_by_name text;

create or replace function public.set_market_listing_employee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  staff_first text;
  staff_last text;
  staff_display text;
  staff_email text;
begin
  staff_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select first_name, last_name, display_name
    into staff_first, staff_last, staff_display
  from public.staff_accounts
  where lower(email) = staff_email
    and active = true
  limit 1;

  if found then
    new.listed_by_name := coalesce(
      nullif(trim(concat_ws(' ', staff_first, staff_last)), ''),
      nullif(trim(staff_display), ''),
      staff_email
    );
  end if;

  return new;
end;
$$;

drop trigger if exists market_listing_employee_before_insert on public.market_vehicles;

create trigger market_listing_employee_before_insert
before insert on public.market_vehicles
for each row
execute function public.set_market_listing_employee();
