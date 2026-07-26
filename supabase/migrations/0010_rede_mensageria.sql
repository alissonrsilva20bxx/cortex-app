-- JobApp Rede - RD-06: private 1:1 messaging and Realtime.

create table if not exists public.rede_conversas (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references auth.users(id) on delete cascade,
  user_high_id uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  constraint rede_conversas_usuarios_ordenados
    check (user_low_id < user_high_id),
  constraint rede_conversas_par_unico
    unique (user_low_id, user_high_id)
);

create table if not exists public.rede_conversas_participantes (
  conversa_id uuid not null
    references public.rede_conversas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (conversa_id, user_id)
);

create index if not exists rede_conversas_participantes_user_idx
  on public.rede_conversas_participantes (user_id);

create table if not exists public.rede_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null
    references public.rede_conversas(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  texto text not null,
  criado_em timestamptz not null default now(),
  lida_em timestamptz,
  constraint rede_mensagens_texto_valido
    check (char_length(btrim(texto)) between 1 and 4000)
);

create index if not exists rede_mensagens_conversa_criado_idx
  on public.rede_mensagens (conversa_id, criado_em);

create or replace function public.rede_is_conversation_participant(
  target_conversa_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rede_conversas_participantes participante
    where participante.conversa_id = target_conversa_id
      and participante.user_id = auth.uid()
  );
$$;

create or replace function public.rede_conversation_is_unblocked(
  target_conversa_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.rede_conversas conversa
    join public.rede_bloqueios bloqueio
      on (bloqueio.bloqueador_id = conversa.user_low_id
        and bloqueio.bloqueado_id = conversa.user_high_id)
      or (bloqueio.bloqueador_id = conversa.user_high_id
        and bloqueio.bloqueado_id = conversa.user_low_id)
    where conversa.id = target_conversa_id
  );
$$;

create or replace function public.rede_lock_bloqueio_pair()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(new.bloqueador_id, new.bloqueado_id)::text
        || ':'
        || greatest(new.bloqueador_id, new.bloqueado_id)::text,
      0
    )
  );
  return new;
end;
$$;

drop trigger if exists rede_bloqueios_lock_conversation_pair
  on public.rede_bloqueios;
create trigger rede_bloqueios_lock_conversation_pair
  before insert on public.rede_bloqueios
  for each row execute function public.rede_lock_bloqueio_pair();

create or replace function public.rede_validar_leitura_mensagem()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.lida_em is not null or new.lida_em is null then
    raise exception 'transicao de leitura invalida'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists rede_mensagens_validar_leitura
  on public.rede_mensagens;
create trigger rede_mensagens_validar_leitura
  before update on public.rede_mensagens
  for each row execute function public.rede_validar_leitura_mensagem();

create or replace function public.rede_criar_conversa_1a1(
  outro_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  low_id uuid;
  high_id uuid;
  conversa_id uuid;
begin
  if caller_id is null
    or outro_user_id is null
    or caller_id = outro_user_id
    or not public.rede_is_member()
    or not exists (
      select 1
      from public.rede_convites convite
      where convite.usado_por = outro_user_id
        and convite.usado_em is not null
    )
  then
    raise exception 'participantes invalidos para conversa'
      using errcode = '42501';
  end if;

  low_id := least(caller_id, outro_user_id);
  high_id := greatest(caller_id, outro_user_id);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      low_id::text || ':' || high_id::text,
      0
    )
  );

  if exists (
    select 1
    from public.rede_bloqueios bloqueio
    where (bloqueio.bloqueador_id = caller_id
      and bloqueio.bloqueado_id = outro_user_id)
      or (bloqueio.bloqueador_id = outro_user_id
        and bloqueio.bloqueado_id = caller_id)
  ) then
    raise exception 'conversa bloqueada'
      using errcode = '42501';
  end if;

  insert into public.rede_conversas (user_low_id, user_high_id)
  values (low_id, high_id)
  on conflict (user_low_id, user_high_id)
  do update set user_low_id = excluded.user_low_id
  returning id into conversa_id;

  insert into public.rede_conversas_participantes (conversa_id, user_id)
  values (conversa_id, low_id), (conversa_id, high_id)
  on conflict do nothing;

  return conversa_id;
end;
$$;

alter table public.rede_conversas enable row level security;
alter table public.rede_conversas_participantes enable row level security;
alter table public.rede_mensagens enable row level security;

revoke all
  on table public.rede_conversas,
    public.rede_conversas_participantes,
    public.rede_mensagens
  from anon, authenticated, service_role;
revoke all on function public.rede_is_conversation_participant(uuid)
  from public;
revoke all on function public.rede_conversation_is_unblocked(uuid)
  from public;
revoke all on function public.rede_lock_bloqueio_pair()
  from public;
revoke all on function public.rede_validar_leitura_mensagem()
  from public;
revoke all on function public.rede_criar_conversa_1a1(uuid)
  from public;

grant select
  on table public.rede_conversas,
    public.rede_conversas_participantes,
    public.rede_mensagens
  to authenticated;
grant insert (conversa_id, autor_id, texto)
  on table public.rede_mensagens
  to authenticated;
grant update (lida_em)
  on table public.rede_mensagens
  to authenticated;
grant select, insert, update, delete
  on table public.rede_conversas,
    public.rede_conversas_participantes,
    public.rede_mensagens
  to service_role;
grant execute on function public.rede_is_conversation_participant(uuid)
  to authenticated;
grant execute on function public.rede_conversation_is_unblocked(uuid)
  to authenticated;
grant execute on function public.rede_criar_conversa_1a1(uuid)
  to authenticated;

drop policy if exists "rede_conversas: participant select"
  on public.rede_conversas;
create policy "rede_conversas: participant select"
  on public.rede_conversas
  for select
  to authenticated
  using (
    public.rede_is_member()
    and public.rede_is_conversation_participant(id)
    and public.rede_conversation_is_unblocked(id)
  );

drop policy if exists "rede_conversas_participantes: participant select"
  on public.rede_conversas_participantes;
create policy "rede_conversas_participantes: participant select"
  on public.rede_conversas_participantes
  for select
  to authenticated
  using (
    public.rede_is_member()
    and public.rede_is_conversation_participant(conversa_id)
    and public.rede_conversation_is_unblocked(conversa_id)
  );

drop policy if exists "rede_mensagens: participant select"
  on public.rede_mensagens;
create policy "rede_mensagens: participant select"
  on public.rede_mensagens
  for select
  to authenticated
  using (
    public.rede_is_member()
    and public.rede_is_conversation_participant(conversa_id)
    and public.rede_conversation_is_unblocked(conversa_id)
  );

drop policy if exists "rede_mensagens: participant insert"
  on public.rede_mensagens;
create policy "rede_mensagens: participant insert"
  on public.rede_mensagens
  for insert
  to authenticated
  with check (
    autor_id = auth.uid()
    and public.rede_is_member()
    and public.rede_is_conversation_participant(conversa_id)
    and public.rede_conversation_is_unblocked(conversa_id)
  );

drop policy if exists "rede_mensagens: recipient update read"
  on public.rede_mensagens;
create policy "rede_mensagens: recipient update read"
  on public.rede_mensagens
  for update
  to authenticated
  using (
    autor_id <> auth.uid()
    and public.rede_is_member()
    and public.rede_is_conversation_participant(conversa_id)
    and public.rede_conversation_is_unblocked(conversa_id)
  )
  with check (
    autor_id <> auth.uid()
    and public.rede_is_member()
    and public.rede_is_conversation_participant(conversa_id)
    and public.rede_conversation_is_unblocked(conversa_id)
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rede_mensagens'
  ) then
    alter publication supabase_realtime
      add table public.rede_mensagens;
  end if;
end
$$;
