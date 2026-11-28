-- MoneyMovement: liabilitas (utang)
-- Networth = cash + investasi - liabilitas.
-- Liabilitas disimpan di tabel assets dengan type 'liability' dan saldo POSITIF (sisa utang),
-- sehingga riwayat perubahan saldo, RLS, dan endpoint yang ada tetap dipakai.

alter type public.asset_type add value if not exists 'liability';

-- Snapshot menyimpan total liabilitas. Baris lama otomatis 0 (belum ada utang saat itu).
alter table public.networth_snapshots
  add column if not exists total_liability numeric(18, 2) not null default 0;

-- Snapshot networth dihitung ulang dengan rumus baru.
create or replace function public.record_networth_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := coalesce(new.user_id, old.user_id);
  v_cash  numeric(18, 2);
  v_inv   numeric(18, 2);
  v_liab  numeric(18, 2);
begin
  if tg_op = 'UPDATE'
     and new.balance = old.balance
     and new.type = old.type then
    return new; -- rename saja, networth tidak berubah
  end if;

  -- Aset terhapus karena user dihapus (cascade): jangan buat snapshot untuk user yang sudah tidak ada.
  if tg_op = 'DELETE' and not exists (select 1 from auth.users where id = v_user) then
    return old;
  end if;

  select
    coalesce(sum(balance) filter (where type = 'cash'), 0),
    coalesce(sum(balance) filter (where type = 'investment'), 0),
    coalesce(sum(balance) filter (where type = 'liability'), 0)
  into v_cash, v_inv, v_liab
  from public.assets
  where user_id = v_user;

  insert into public.networth_snapshots (user_id, total_cash, total_investment, total_liability, networth)
  values (v_user, v_cash, v_inv, v_liab, v_cash + v_inv - v_liab);

  return coalesce(new, old);
end;
$$;

-- Fungsi riwayat harian: kolom hasil bertambah (total_liability), jadi harus dibuat ulang.
drop function if exists public.networth_history(timestamptz, text);

create function public.networth_history(
  p_start timestamptz,
  p_tz    text default 'Asia/Jakarta'
)
returns table (
  day              date,
  total_cash       numeric,
  total_investment numeric,
  total_liability  numeric,
  networth         numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on ((s.recorded_at at time zone p_tz)::date)
    (s.recorded_at at time zone p_tz)::date as day,
    s.total_cash,
    s.total_investment,
    s.total_liability,
    s.networth
  from public.networth_snapshots s
  where s.user_id = auth.uid()
    and s.recorded_at >= p_start
  order by (s.recorded_at at time zone p_tz)::date, s.recorded_at desc, s.id desc;
$$;

revoke all on function public.networth_history(timestamptz, text) from public, anon;
grant execute on function public.networth_history(timestamptz, text) to authenticated;
