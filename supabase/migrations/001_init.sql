-- MoneyMovement: initial schema
-- Jalankan di Supabase Dashboard > SQL Editor (atau `supabase db push`).

-- =========================================================
-- PROFILES (1:1 dengan auth.users)
-- =========================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null,
  email       text not null,
  phone       text not null,
  created_at  timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$')
);

create unique index if not exists profiles_username_key on public.profiles (username);
create unique index if not exists profiles_email_key on public.profiles (lower(email));

-- =========================================================
-- ASSETS (cash & investasi)
-- =========================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'asset_type') then
    create type public.asset_type as enum ('cash', 'investment');
  end if;
end$$;

create table if not exists public.assets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        public.asset_type not null,
  name        text not null check (char_length(name) between 1 and 60),
  category    text not null check (char_length(category) between 1 and 40),
  balance     numeric(18, 2) not null default 0 check (balance >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists assets_user_type_idx on public.assets (user_id, type);

-- =========================================================
-- NETWORTH SNAPSHOTS (riwayat untuk grafik)
-- =========================================================
create table if not exists public.networth_snapshots (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  total_cash       numeric(18, 2) not null,
  total_investment numeric(18, 2) not null,
  networth         numeric(18, 2) not null,
  recorded_at      timestamptz not null default now()
);

create index if not exists networth_snapshots_user_time_idx
  on public.networth_snapshots (user_id, recorded_at);

-- =========================================================
-- TRIGGERS
-- =========================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists assets_touch_updated_at on public.assets;
create trigger assets_touch_updated_at
  before update on public.assets
  for each row execute function public.touch_updated_at();

-- Setiap perubahan saldo (insert / update / delete) membuat snapshot networth baru.
create or replace function public.record_networth_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(new.user_id, old.user_id);
  v_cash numeric(18, 2);
  v_inv  numeric(18, 2);
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
    coalesce(sum(balance) filter (where type = 'investment'), 0)
  into v_cash, v_inv
  from public.assets
  where user_id = v_user;

  insert into public.networth_snapshots (user_id, total_cash, total_investment, networth)
  values (v_user, v_cash, v_inv, v_cash + v_inv);

  return coalesce(new, old);
end;
$$;

drop trigger if exists assets_record_snapshot on public.assets;
create trigger assets_record_snapshot
  after insert or update or delete on public.assets
  for each row execute function public.record_networth_snapshot();

-- =========================================================
-- HISTORY: nilai terakhir per hari (dipakai grafik)
-- security invoker + filter auth.uid(): user hanya bisa membaca miliknya.
-- =========================================================
create or replace function public.networth_history(
  p_start timestamptz,
  p_tz    text default 'Asia/Jakarta'
)
returns table (
  day              date,
  total_cash       numeric,
  total_investment numeric,
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
    s.networth
  from public.networth_snapshots s
  where s.user_id = auth.uid()
    and s.recorded_at >= p_start
  order by (s.recorded_at at time zone p_tz)::date, s.recorded_at desc, s.id desc;
$$;

revoke all on function public.networth_history(timestamptz, text) from public, anon;
grant execute on function public.networth_history(timestamptz, text) to authenticated;

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table public.profiles enable row level security;
alter table public.assets enable row level security;
alter table public.networth_snapshots enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "assets_select_own" on public.assets;
create policy "assets_select_own" on public.assets
  for select using (auth.uid() = user_id);

drop policy if exists "assets_insert_own" on public.assets;
create policy "assets_insert_own" on public.assets
  for insert with check (auth.uid() = user_id);

drop policy if exists "assets_update_own" on public.assets;
create policy "assets_update_own" on public.assets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "assets_delete_own" on public.assets;
create policy "assets_delete_own" on public.assets
  for delete using (auth.uid() = user_id);

drop policy if exists "snapshots_select_own" on public.networth_snapshots;
create policy "snapshots_select_own" on public.networth_snapshots
  for select using (auth.uid() = user_id);
-- Snapshot hanya ditulis oleh trigger (security definer), tidak ada policy insert untuk user.

-- =========================================================
-- GRANTS (least privilege). Project Supabase baru tidak otomatis
-- memberi akses tabel ke role API, jadi diberikan eksplisit di sini.
-- RLS di atas tetap membatasi baris per user.
-- =========================================================
revoke all on public.profiles, public.assets, public.networth_snapshots from anon;

grant usage on schema public to authenticated, service_role;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.assets to authenticated;
grant select on public.networth_snapshots to authenticated;

-- service_role dipakai backend untuk register & lookup username saat login.
grant select, insert, update, delete on public.profiles, public.assets, public.networth_snapshots to service_role;
grant usage, select on all sequences in schema public to service_role;
