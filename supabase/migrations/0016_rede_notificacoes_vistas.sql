-- ============================================================
-- JobApp Rede - Migration 0016: cursor de notificacoes vistas
-- ============================================================
-- Curtida/comentario/pedido de amizade nao tem coluna de leitura propria
-- (mensagem ja tem lida_em, ver 0010). Em vez de uma tabela nova de
-- eventos com "lida" por linha, a notificacao agregada (lib/rede/
-- notificacoes.ts) e derivada client-side das tabelas existentes e
-- comparada contra este cursor unico por usuaria: tudo criado ate aqui
-- conta como visto. "Marcar todas como lidas" so avanca este timestamp.
--
-- Tabela dedicada, nao coluna em rede_perfis: rede_perfis tem select
-- liberado pra qualquer membro (0006, "member select"), e RLS e por
-- linha, nao por coluna -- uma coluna ali ficaria legivel por qualquer
-- membro junto com nome/bio/etc. Quando cada usuaria viu suas proprias
-- notificacoes nao e informacao publica, entao o cursor precisa da
-- propria linha com sua propria policy de select restrita ao dono.

create table if not exists public.rede_notificacoes_cursor (
  user_id uuid primary key references public.rede_perfis(user_id) on delete cascade,
  vistas_em timestamptz not null default now()
);

alter table public.rede_notificacoes_cursor enable row level security;

revoke all
  on table public.rede_notificacoes_cursor
  from anon, authenticated, service_role;
grant select, insert, update
  on table public.rede_notificacoes_cursor
  to authenticated;
grant select, insert, update
  on table public.rede_notificacoes_cursor
  to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_notificacoes_cursor'
      and policyname = 'rede_notificacoes_cursor: owner select'
  ) then
    create policy "rede_notificacoes_cursor: owner select"
      on public.rede_notificacoes_cursor
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_notificacoes_cursor'
      and policyname = 'rede_notificacoes_cursor: owner insert'
  ) then
    create policy "rede_notificacoes_cursor: owner insert"
      on public.rede_notificacoes_cursor
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_notificacoes_cursor'
      and policyname = 'rede_notificacoes_cursor: owner update'
  ) then
    create policy "rede_notificacoes_cursor: owner update"
      on public.rede_notificacoes_cursor
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
