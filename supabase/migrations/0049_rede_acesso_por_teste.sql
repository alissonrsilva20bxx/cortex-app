-- ============================================================
-- JobApp Rede — Migration 0049: entrada na Rede pelo teste ou pela
--                               assinatura (sem código e sem beta)
-- ============================================================
-- ESCRITA, NÃO APLICADA. Roda no Supabase SQL Editor quando o dono decidir.
--
-- Por quê (capitão, 27/10): conta nova tem a Rede durante o teste grátis,
-- sem código e sem fila de beta. Quando o teste acaba, só a Rede para (tela
-- de renovação do app); o resto do app segue liberado. Quem já entrou por
-- convite continua entrando (decisão N4 da revisão R17rev).
--
-- ORDEM PARA APLICAR (obrigatória):
--   1. 0040_assinatura_so_servidor.sql aplicada e conferida. Sem ela a
--      própria usuária grava assinatura_status = 'ativa' ou empurra
--      trial_started_at para o futuro e tem a Rede de graça para sempre
--      (achado N2). Este arquivo confere os dois gatilhos da 0040 (ligados,
--      com a função e os eventos certos) e PARA com erro se faltar algum
--      (nada é aplicado: o SQL Editor roda tudo numa transação só).
--   2. Este arquivo (0049).
--   3. Conferir (consultas no fim deste cabeçalho).
--   4. Só então publicar o app com o commit "Rede: entra pelo teste ou pela
--      assinatura". O app atual (com convite) segue funcionando depois
--      desta migration: quem tem convite continua entrando.
--   Antes de aplicar na produção: aplicar no homolog e rodar
--   tests/rede/rls/rede-acesso-0049.rls.test.ts (e os outros de tests/rede
--   com SUPABASE_TEST_URL).
--
-- O que muda:
--   - private.rede_usuario_e_membro(alvo) e private.rede_usuario_e_membro_em
--     (alvo, agora): a regra por pessoa. Está na Rede quem tem
--     assinatura_status = 'ativa', OU está no teste (trial_started_at +
--     7 x 24 h; 14 x 24 h para quem começou antes de 09/10/2026), OU tem
--     convite usado (antigo). A mesma regra do app (lib/rede/acessoRede.ts),
--     conferida com a mesma tabela de casos (tests/rede/casos-acesso-rede.json).
--   - public.rede_is_member(): passa a chamar a regra com auth.uid(). Todas
--     as policies que exigiam convite (feed, perfis, amizades, mensagens,
--     denúncias, fotos, selos) usam esta função e mudam junto, sem
--     tocar nelas.
--   - N1: public.rede_criar_conversa_1a1 e private.rede_denuncia_alvo_valido
--     olhavam o convite da OUTRA pessoa direto na tabela. Agora usam a regra
--     por pessoa (a denúncia aceita também quem já esteve na Rede: tem
--     perfil).
--   - Código e beta somem: rede_resgatar_convite, rede_gerar_convite e
--     rede_aprovar_solicitacao_beta deixam de ser chamáveis pela sessão da
--     usuária (anon/authenticated). Sem isso, um código não usado ainda
--     criaria um "convite antigo" e daria a Rede para sempre. O service role
--     continua podendo. Nenhuma tabela nem linha é apagada.
--   - Desejos (rede_wishlist_items) são de Finanças, não da Rede: criar o
--     próprio Desejo deixa de exigir a Rede e o perfil da Rede (a dona passa
--     a ser a conta). Ler, editar e apagar seguem só da dona. Compartilhar
--     no feed segue exigindo a Rede.
--
-- COMO REVERTER: rodar supabase/migrations-rollback/0049_rede_acesso_por_teste.rollback.sql
-- (fora desta pasta de propósito: a CLI do Supabase aplicaria qualquer
-- 00NN_*.sql daqui como migration). Ele volta as 4 funções ao texto da
-- 0006/0010/0011, apaga as 2 funções novas, devolve os grants da 0015 e da
-- 0020 e volta o insert de Desejos ao "só na Rede" (os Desejos ficam).
-- Depois de reverter, o app novo mostra a Rede a quem está no teste, mas o
-- banco volta a exigir convite (a tela fica vazia para quem não tem):
-- reverter o app junto.
--
-- Conferência (depois de aplicar):
--   select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'private' and proname like 'rede_usuario_e_membro%';
--   -- 2 linhas
--   select has_function_privilege('authenticated',
--     'public.rede_resgatar_convite(text, text)', 'execute');
--   -- false
--   select count(*) from public.rede_convites where usado_por is not null;
--   -- quantas pessoas entram pelo convite antigo (N4)
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'rede_wishlist_items_user_id_fkey';
--   -- FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
-- Comportamento num Postgres em memória (com a tabela de casos, a RLS, o
-- N1, a 0040 e o rollback): tests/rede/acesso-0049-pglite.mjs.

-- 1. A 0040 tem de estar aplicada antes, e valendo (N2). Os DOIS gatilhos
-- dela em public.configuracoes, ligados (tgenabled 'O' ou 'A'; 'D' é
-- desligado e 'R' só vale em réplica), cada um com a própria função e
-- os próprios eventos. tgtype: 1 = por linha, 2 = before, 4 = insert,
-- 8 = delete, 16 = update.
do $$
begin
  if (
    select count(*)
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_proc p on p.oid = t.tgfoid
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where t.tgrelid = 'public.configuracoes'::regclass
      and not t.tgisinternal
      and t.tgenabled in ('O', 'A')
      and n.nspname = 'public'
      and (
        (t.tgname = 'configuracoes_assinatura_so_servidor'
          and p.proname = 'configuracoes_assinatura_so_servidor'
          and (t.tgtype & 23) = 23)
        or (t.tgname = 'configuracoes_sem_delete_pela_sessao'
          and p.proname = 'configuracoes_sem_delete_pela_sessao'
          and (t.tgtype & 11) = 11)
      )
  ) <> 2 then
    raise exception '0049: aplique antes a 0040_assinatura_so_servidor.sql, com os dois gatilhos dela ligados (sem eles a Rede fica de graça para sempre). Nada foi aplicado.'
      using errcode = 'P0001';
  end if;
end;
$$;

create schema if not exists private;

-- 2. A regra por pessoa, num instante dado (o teste usa um instante fixo).
-- security definer: lê configuracoes e rede_convites de OUTRA pessoa (N1),
-- que a RLS esconderia. Fica no schema private (fora da API): ninguém
-- pergunta pela API se outra pessoa assina ou está no teste.
create or replace function private.rede_usuario_e_membro_em(
  alvo uuid,
  agora timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select alvo is not null and (
    exists (
      select 1
      from public.configuracoes c
      where c.user_id = alvo
        and (
          c.assinatura_status = 'ativa'
          -- O teste em horas exatas (como o app): 14 dias para quem
          -- começou antes do corte de 09/10/2026, 7 depois.
          or agora < c.trial_started_at + pg_catalog.make_interval(
            hours => 24 * (
              case
                when c.trial_started_at < timestamptz '2026-10-09 00:00:00+00'
                  then 14
                else 7
              end
            )
          )
        )
    )
    or exists (
      select 1
      from public.rede_convites convite
      where convite.usado_por = alvo
    )
  );
$$;

create or replace function private.rede_usuario_e_membro(alvo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.rede_usuario_e_membro_em(alvo, pg_catalog.now());
$$;

-- O Supabase concede EXECUTE em toda função nova a anon/authenticated
-- explicitamente (default privileges): o revoke nomeia as roles (0032).
revoke all on function private.rede_usuario_e_membro_em(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function private.rede_usuario_e_membro(uuid)
  from public, anon, authenticated;
grant execute on function private.rede_usuario_e_membro_em(uuid, timestamptz)
  to service_role;
grant execute on function private.rede_usuario_e_membro(uuid)
  to service_role;

-- 3. rede_is_member(): a mesma assinatura e os mesmos grants da 0006; muda
-- só o corpo. Todas as policies que a usam mudam junto.
create or replace function public.rede_is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.rede_usuario_e_membro(auth.uid());
$$;

-- 4. N1: conversa 1:1 (0010) -- a outra pessoa pela regra, não pelo convite.
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
    -- N1: a OUTRA pessoa também precisa estar na Rede agora (teste,
    -- assinatura ou convite antigo), não só ter um convite.
    or not private.rede_usuario_e_membro(outro_user_id)
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

-- 5. N1: denúncia de usuária (0011) -- pela regra, não pelo convite.
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
        -- N1: quem está na Rede agora, ou quem já esteve (tem perfil):
        -- o teste dela pode ter acabado, mas o que publicou continua
        -- visível e denunciável.
        and (
          private.rede_usuario_e_membro(u.id)
          or exists (select 1 from public.rede_perfis perfil where perfil.user_id = u.id)
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

-- 6. Código e beta somem: só o service role cria convite daqui em diante.
revoke execute on function public.rede_resgatar_convite(text, text)
  from public, anon, authenticated;
revoke execute on function public.rede_gerar_convite(text)
  from public, anon, authenticated;
revoke execute on function public.rede_aprovar_solicitacao_beta(uuid)
  from public, anon, authenticated;

-- 7. Desejos são de Finanças, não da Rede (revisão R19rev #1). Com o teste
-- acabado e sem assinatura, a dona continua criando, lendo, editando e
-- apagando os próprios Desejos (Finanças > Metas, Guardar, Início).
--   - A dona do Desejo passa a ser a conta (auth.users), não o perfil da
--     Rede: criar Desejo não cria perfil nem põe ninguém na Rede. Apagar a
--     conta apaga os Desejos, como antes.
--   - O insert deixa de exigir rede_is_member(); select, update e delete já
--     eram só da dona (0021) e não mudam. Ninguém lê o Desejo de outra.
--   - Publicar ou compartilhar no feed é rede_posts, que segue exigindo a
--     Rede (rede_is_member, acima).
--   - Depois de um rollback existe também a chave direta
--     rede_wishlist_items_user_id_conta_fkey; ela sai e fica só a de nome
--     certo, para a conta.
do $$
declare
  fk record;
begin
  for fk in
    select con.conname
    from pg_catalog.pg_constraint con
    where con.conrelid = 'public.rede_wishlist_items'::regclass
      and con.contype = 'f'
      and con.confrelid = 'public.rede_perfis'::regclass
  loop
    execute pg_catalog.format(
      'alter table public.rede_wishlist_items drop constraint %I',
      fk.conname
    );
  end loop;

  alter table public.rede_wishlist_items
    drop constraint if exists rede_wishlist_items_user_id_conta_fkey;

  if not exists (
    select 1
    from pg_catalog.pg_constraint con
    where con.conrelid = 'public.rede_wishlist_items'::regclass
      and con.conname = 'rede_wishlist_items_user_id_fkey'
  ) then
    alter table public.rede_wishlist_items
      add constraint rede_wishlist_items_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end;
$$;

drop policy if exists "rede_wishlist_items: owner insert requires invite"
  on public.rede_wishlist_items;
drop policy if exists "rede_wishlist_items: owner insert"
  on public.rede_wishlist_items;
create policy "rede_wishlist_items: owner insert"
  on public.rede_wishlist_items
  for insert
  to authenticated
  with check (auth.uid() = user_id);
