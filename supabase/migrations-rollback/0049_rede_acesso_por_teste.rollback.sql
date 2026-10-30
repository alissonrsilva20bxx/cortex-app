-- ============================================================
-- JobApp Rede — DESFAZ a Migration 0049 (rede_acesso_por_teste)
-- ============================================================
-- ESCRITA, NÃO APLICADA. Só rode se a 0049 já foi aplicada e precisa sair.
-- Fica fora de supabase/migrations de propósito: a CLI do Supabase
-- aplicaria qualquer 00NN_*.sql daquela pasta como migration.
--
-- O que volta: rede_is_member() (0006), rede_criar_conversa_1a1 (0010) e
-- private.rede_denuncia_alvo_valido (0011) ao texto original (só convite
-- conta); as funções da regra por pessoa são apagadas; resgatar, gerar e
-- aprovar convite voltam a ser chamáveis por authenticated (grants da 0015
-- e da 0020; anon não volta); o insert de Desejos volta a exigir a Rede e
-- a chave da dona volta para o perfil da Rede (sem validar as linhas que já
-- existem). Nenhuma linha é apagada.
--
-- Depois de reverter: o banco volta a exigir convite. Reverter o app junto
-- (o app novo mostra a Rede a quem está no teste e a RLS não mostraria nada).
--
-- Conferência (depois de rodar):
--   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'private' and proname like 'rede_usuario_e_membro%';
--   -- 0
--   select has_function_privilege('authenticated',
--     'public.rede_resgatar_convite(text, text)', 'execute');
--   -- true
-- Testado num Postgres em memória: tests/rede/acesso-0049-pglite.mjs.

-- 1. rede_is_member() como na 0006.
create or replace function public.rede_is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rede_convites
    where usado_por = auth.uid()
  );
$$;

-- 2. Conversa 1:1 como na 0010.
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

-- 3. Denúncia de usuária como na 0011.
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

-- 4. As funções da 0049 (nada mais as chama).
drop function if exists private.rede_usuario_e_membro(uuid);
drop function if exists private.rede_usuario_e_membro_em(uuid, timestamptz);

-- 5. Convite pela sessão, como na 0015 e na 0020.
grant execute on function public.rede_resgatar_convite(text, text)
  to authenticated, service_role;
grant execute on function public.rede_gerar_convite(text)
  to authenticated, service_role;
grant execute on function public.rede_aprovar_solicitacao_beta(uuid)
  to authenticated, service_role;

-- 6. Desejos como na 0021: o insert volta a exigir a Rede e a dona volta a
-- ser o perfil da Rede. A chave volta "not valid": os Desejos criados sem
-- perfil enquanto a 0049 valia ficam (nada é apagado); só os novos precisam
-- de perfil. Esses Desejos não têm perfil que leve a exclusão da conta até
-- eles, então fica também uma chave direta para auth.users (nome próprio):
-- excluir a conta apaga os Desejos dela, sem órfão, e a 0049 aplica de novo.
drop policy if exists "rede_wishlist_items: owner insert"
  on public.rede_wishlist_items;
drop policy if exists "rede_wishlist_items: owner insert requires invite"
  on public.rede_wishlist_items;
create policy "rede_wishlist_items: owner insert requires invite"
  on public.rede_wishlist_items
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.rede_is_member()
  );

alter table public.rede_wishlist_items
  drop constraint if exists rede_wishlist_items_user_id_fkey;
alter table public.rede_wishlist_items
  drop constraint if exists rede_wishlist_items_user_id_conta_fkey;
alter table public.rede_wishlist_items
  add constraint rede_wishlist_items_user_id_conta_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.rede_wishlist_items
  add constraint rede_wishlist_items_user_id_fkey
  foreign key (user_id) references public.rede_perfis(user_id)
  on delete cascade not valid;
