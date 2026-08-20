-- Tow & Trade: automatycznie zapisuj imię i nazwisko pracownika wystawiającego NOWĄ ofertę.
-- Wykorzystuje istniejące pole market_vehicles.seller_name, więc nie wymaga nowej kolumny.

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
    new.seller_name := coalesce(
      nullif(trim(concat_ws(' ', staff_first, staff_last)), ''),
      nullif(trim(staff_display), ''),
      staff_email,
      'Tow & Trade'
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
