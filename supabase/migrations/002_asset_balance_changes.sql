-- MoneyMovement: riwayat perubahan saldo per aset
-- Setiap perubahan saldo (termasuk saldo awal saat aset dibuat) dicatat oleh trigger,
-- sehingga selisih (delta) dihitung atomik dari OLD/NEW, bukan dari klien.

create table if not exists public.asset_balance_changes (
  id                bigint generated always as identity primary key,
  asset_id          uuid not null references public.assets (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  previous_balance  numeric(18, 2),          -- null = saldo awal (aset baru dibuat)
  new_balance       numeric(18, 2) not null,
  delta             numeric(18, 2) not null,
  changed_at        timestamptz not null default now()
);

create index if not exists asset_balance_changes_asset_time_idx
  on public.asset_balance_changes (asset_id, changed_at desc, id desc);

create or replace function public.record_asset_balance_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.asset_balance_changes (asset_id, user_id, previous_balance, new_balance, delta)
    values (new.id, new.user_id, null, new.balance, new.balance);
  elsif new.balance is distinct from old.balance then
    insert into public.asset_balance_changes (asset_id, user_id, previous_balance, new_balance, delta)
    values (new.id, new.user_id, old.balance, new.balance, new.balance - old.balance);
  end if;
  return new;
end;
$$;

drop trigger if exists assets_record_balance_change on public.assets;
create trigger assets_record_balance_change
  after insert or update of balance on public.assets
  for each row execute function public.record_asset_balance_change();

alter table public.asset_balance_changes enable row level security;

drop policy if exists "balance_changes_select_own" on public.asset_balance_changes;
create policy "balance_changes_select_own" on public.asset_balance_changes
  for select using (auth.uid() = user_id);
-- Tidak ada policy insert/update/delete: riwayat hanya ditulis trigger dan tidak bisa diubah user.

revoke all on public.asset_balance_changes from anon;
grant select on public.asset_balance_changes to authenticated;
grant select, insert, update, delete on public.asset_balance_changes to service_role;

-- Update saldo + kembalikan perubahan yang tercatat, dalam satu transaksi.
-- security invoker: RLS assets & asset_balance_changes tetap berlaku (user hanya bisa update miliknya).
-- Baris aset terkunci selama UPDATE, jadi update bersamaan diproses berurutan dan delta tetap benar.
create or replace function public.update_asset_balance(p_asset_id uuid, p_balance numeric)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_asset  public.assets;
  v_old    numeric(18, 2);
  v_change public.asset_balance_changes;
begin
  select balance into v_old from public.assets where id = p_asset_id for update;
  if not found then
    return null; -- tidak ada / bukan milik user
  end if;

  if round(p_balance, 2) = v_old then
    -- Tidak ada perubahan: jangan sentuh baris (tidak ada riwayat / snapshot baru).
    select * into v_asset from public.assets where id = p_asset_id;
  else
    update public.assets set balance = p_balance where id = p_asset_id returning * into v_asset;

    select * into v_change
    from public.asset_balance_changes
    where asset_id = p_asset_id
    order by id desc
    limit 1;
  end if;

  return jsonb_build_object(
    'asset', to_jsonb(v_asset) - 'user_id',
    'change', case when v_change.id is null then null else to_jsonb(v_change) - 'user_id' end
  );
end;
$$;

revoke all on function public.update_asset_balance(uuid, numeric) from public, anon;
grant execute on function public.update_asset_balance(uuid, numeric) to authenticated;
