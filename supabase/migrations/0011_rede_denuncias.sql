-- JobApp Rede - RD-07: fila minima de denuncias com auditoria imutavel.

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname = 'rede_denuncia_alvo_tipo') then
    create type public.rede_denuncia_alvo_tipo as enum ('post','comentario','usuario','mensagem');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname = 'rede_denuncia_motivo') then
    create type public.rede_denuncia_motivo as enum ('spam','assedio','conteudo_impropio','outro');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname = 'rede_denuncia_status') then
    create type public.rede_denuncia_status as enum ('pendente','revisada','resolvida');
  end if;
end $$;

create table if not exists public.rede_denuncias (
  id uuid primary key default gen_random_uuid(),
  denunciante_id uuid not null references auth.users(id) on delete cascade,
  alvo_tipo public.rede_denuncia_alvo_tipo not null,
  alvo_id uuid not null,
  motivo public.rede_denuncia_motivo not null,
  descricao text,
  status public.rede_denuncia_status not null default 'pendente',
  criado_em timestamptz not null default now(),
  revisado_em timestamptz,
  revisado_por uuid references auth.users(id) on delete set null,
  revisado_por_auditoria uuid,
  resolvido_em timestamptz,
  resolvido_por uuid references auth.users(id) on delete set null,
  resolvido_por_auditoria uuid,
  constraint rede_denuncias_descricao_valida
    check (descricao is null or char_length(btrim(descricao)) between 1 and 2000)
);

alter table public.rede_denuncias
  add column if not exists revisado_por_auditoria uuid,
  add column if not exists resolvido_em timestamptz,
  add column if not exists resolvido_por uuid references auth.users(id) on delete set null,
  add column if not exists resolvido_por_auditoria uuid;

alter table public.rede_denuncias
  drop constraint if exists rede_denuncias_revisao_consistente;
alter table public.rede_denuncias
  add constraint rede_denuncias_revisao_consistente check (
    (status = 'pendente'
      and revisado_em is null and revisado_por is null
      and revisado_por_auditoria is null
      and resolvido_em is null and resolvido_por is null
      and resolvido_por_auditoria is null)
    or
    (status = 'revisada'
      and revisado_em is not null
      and revisado_por_auditoria is not null
      and resolvido_em is null and resolvido_por is null
      and resolvido_por_auditoria is null)
    or
    (status = 'resolvida'
      and resolvido_em is not null
      and resolvido_por_auditoria is not null
      and (
        (revisado_em is null and revisado_por is null and revisado_por_auditoria is null)
        or (revisado_em is not null and revisado_por_auditoria is not null)
      ))
  );

create index if not exists rede_denuncias_status_idx on public.rede_denuncias(status);
create index if not exists rede_denuncias_denunciante_idx on public.rede_denuncias(denunciante_id);
create index if not exists rede_denuncias_alvo_idx on public.rede_denuncias(alvo_tipo, alvo_id);

create schema if not exists private;
revoke all on schema private from public, anon;

create or replace function private.rede_denuncia_alvo_valido(
  target_tipo public.rede_denuncia_alvo_tipo,
  target_id uuid,
  reporter_id uuid
) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if target_tipo = 'usuario' then
    return exists (
      select 1 from auth.users u
      where u.id = target_id
        and exists (
          select 1 from public.rede_convites convite
          where convite.usado_por = u.id and convite.usado_em is not null
        )
        and not exists (
          select 1 from public.rede_bloqueios b
          where (b.bloqueador_id=reporter_id and b.bloqueado_id=u.id)
             or (b.bloqueador_id=u.id and b.bloqueado_id=reporter_id)
        )
    );
  elsif target_tipo = 'post' then
    return exists (
      select 1 from public.rede_posts p
      where p.id = target_id
        and not exists (
          select 1 from public.rede_bloqueios b
          where (b.bloqueador_id = reporter_id and b.bloqueado_id = p.autor_id)
             or (b.bloqueador_id = p.autor_id and b.bloqueado_id = reporter_id)
        )
    );
  elsif target_tipo = 'comentario' then
    return exists (
      select 1 from public.rede_comentarios c
      join public.rede_posts p on p.id = c.post_id
      where c.id = target_id
        and not exists (
          select 1 from public.rede_bloqueios b
          where (b.bloqueador_id = reporter_id and b.bloqueado_id in (c.autor_id,p.autor_id))
             or (b.bloqueado_id = reporter_id and b.bloqueador_id in (c.autor_id,p.autor_id))
        )
    );
  elsif target_tipo = 'mensagem' then
    return exists (
      select 1
      from public.rede_mensagens m
      join public.rede_conversas_participantes cp
        on cp.conversa_id = m.conversa_id and cp.user_id = reporter_id
      join public.rede_conversas c on c.id = m.conversa_id
      where m.id = target_id
        and not exists (
          select 1 from public.rede_bloqueios b
          where (b.bloqueador_id = c.user_low_id and b.bloqueado_id = c.user_high_id)
             or (b.bloqueador_id = c.user_high_id and b.bloqueado_id = c.user_low_id)
        )
    );
  end if;
  return false;
end;
$$;

create or replace function private.rede_validar_alvo_denuncia()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not private.rede_denuncia_alvo_valido(new.alvo_tipo,new.alvo_id,new.denunciante_id) then
    raise exception 'alvo de denuncia invalido ou invisivel' using errcode='23514';
  end if;
  return new;
end;
$$;

create or replace function private.rede_validar_transicao_denuncia()
returns trigger language plpgsql set search_path = ''
as $$
begin
  -- Permite apenas o SET NULL interno das FKs, preservando os snapshots.
  if auth.uid() is null
    and new.status = old.status
    and new.denunciante_id = old.denunciante_id
    and new.alvo_tipo = old.alvo_tipo and new.alvo_id = old.alvo_id
    and new.motivo = old.motivo
    and new.descricao is not distinct from old.descricao
    and new.criado_em = old.criado_em
    and new.revisado_em is not distinct from old.revisado_em
    and new.revisado_por_auditoria is not distinct from old.revisado_por_auditoria
    and new.resolvido_em is not distinct from old.resolvido_em
    and new.resolvido_por_auditoria is not distinct from old.resolvido_por_auditoria
    and (new.revisado_por is not distinct from old.revisado_por or new.revisado_por is null)
    and (new.resolvido_por is not distinct from old.resolvido_por or new.resolvido_por is null)
  then return new;
  end if;

  if new.denunciante_id <> old.denunciante_id
    or new.alvo_tipo <> old.alvo_tipo or new.alvo_id <> old.alvo_id
    or new.motivo <> old.motivo
    or new.descricao is distinct from old.descricao
    or new.criado_em <> old.criado_em
  then raise exception 'campos imutaveis da denuncia' using errcode='23514';
  end if;

  if old.status='pendente' and new.status='revisada' then
    if new.revisado_em is null or new.revisado_por is distinct from auth.uid()
      or new.revisado_por_auditoria is distinct from auth.uid()
      or new.resolvido_em is not null
    then raise exception 'transicao invalida' using errcode='23514'; end if;
  elsif old.status='pendente' and new.status='resolvida' then
    if new.revisado_em is not null
      or new.resolvido_em is null or new.resolvido_por is distinct from auth.uid()
      or new.resolvido_por_auditoria is distinct from auth.uid()
    then raise exception 'transicao invalida' using errcode='23514'; end if;
  elsif old.status='revisada' and new.status='resolvida' then
    if new.revisado_em<>old.revisado_em
      or new.revisado_por is distinct from old.revisado_por
      or new.revisado_por_auditoria<>old.revisado_por_auditoria
      or new.resolvido_em is null or new.resolvido_por is distinct from auth.uid()
      or new.resolvido_por_auditoria is distinct from auth.uid()
    then raise exception 'transicao invalida' using errcode='23514'; end if;
  else
    raise exception 'transicao invalida' using errcode='23514';
  end if;
  return new;
end;
$$;

drop trigger if exists rede_denuncias_validar_alvo on public.rede_denuncias;
create trigger rede_denuncias_validar_alvo before insert on public.rede_denuncias
for each row execute function private.rede_validar_alvo_denuncia();
drop trigger if exists rede_denuncias_validar_revisao on public.rede_denuncias;
create trigger rede_denuncias_validar_revisao before update on public.rede_denuncias
for each row execute function private.rede_validar_transicao_denuncia();

alter table public.rede_denuncias enable row level security;
revoke all on table public.rede_denuncias from anon,authenticated,service_role;
revoke all on function private.rede_denuncia_alvo_valido(public.rede_denuncia_alvo_tipo,uuid,uuid) from public;
revoke all on function private.rede_validar_alvo_denuncia() from public;
revoke all on function private.rede_validar_transicao_denuncia() from public;
revoke all on type public.rede_denuncia_alvo_tipo,public.rede_denuncia_motivo,public.rede_denuncia_status from public;
grant usage on type public.rede_denuncia_alvo_tipo,public.rede_denuncia_motivo,public.rede_denuncia_status to authenticated,service_role;
grant select on public.rede_denuncias to authenticated;
grant insert(denunciante_id,alvo_tipo,alvo_id,motivo,descricao) on public.rede_denuncias to authenticated;
grant update(status,revisado_em,revisado_por,revisado_por_auditoria,resolvido_em,resolvido_por,resolvido_por_auditoria)
  on public.rede_denuncias to authenticated;
grant select,insert,update,delete on public.rede_denuncias to service_role;

drop policy if exists "rede_denuncias: reporter or admin select" on public.rede_denuncias;
create policy "rede_denuncias: reporter or admin select" on public.rede_denuncias
for select to authenticated using (denunciante_id=auth.uid() or public.rede_is_admin());
drop policy if exists "rede_denuncias: reporter insert" on public.rede_denuncias;
create policy "rede_denuncias: reporter insert" on public.rede_denuncias
for insert to authenticated with check (
  denunciante_id=auth.uid() and public.rede_is_member() and status='pendente'
  and revisado_em is null and revisado_por is null and revisado_por_auditoria is null
  and resolvido_em is null and resolvido_por is null and resolvido_por_auditoria is null
);
drop policy if exists "rede_denuncias: admin update status" on public.rede_denuncias;
create policy "rede_denuncias: admin update status" on public.rede_denuncias
for update to authenticated using(public.rede_is_admin()) with check(public.rede_is_admin());
