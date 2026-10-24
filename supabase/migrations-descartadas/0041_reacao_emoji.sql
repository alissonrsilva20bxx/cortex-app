-- DESCARTADA: o capitão descartou a reação por emoji em 20/10/2026 (decisão registrada em 23/10/2026). Nunca aplicar.
-- ============================================================
-- JobApp Rede — Migration 0041: reação por emoji (curtida com tipo)
-- ============================================================
-- ESCRITA, NÃO APLICADA. Roda no Supabase SQL Editor quando o dono decidir.
-- Pedido do capitão em 2026-10-20.
--
-- O que faz: `rede_curtidas` ganha a coluna `tipo`, com 4 reações aceitas:
-- 'curtida' (padrão), 'fogo', 'aplausos' e 'coração'.
--
-- Por quê: hoje só existe "curtir". A reação por emoji deixa a pessoa
-- dizer mais do que um sim. Continua uma reação por pessoa por post (a
-- chave primária (post_id, user_id) de 0009 não muda); trocar de emoji é
-- apagar a curtida e inserir de novo, igual o app já faz para descurtir.
--
-- Nenhuma curtida existente muda: o `default 'curtida'` preenche as linhas
-- antigas com 'curtida' e o app atual (que não manda `tipo`) segue gravando
-- 'curtida'.
--
-- Permissão: a leitura já é por tabela inteira (grant select de 0009), então
-- `tipo` já é legível por quem as policies deixam ler. A inserção em 0009 é
-- por coluna (post_id, user_id), por isso `tipo` precisa de grant próprio.
-- Nenhuma policy muda: quem pode curtir continua o mesmo.

alter table public.rede_curtidas
  add column if not exists tipo varchar(10) not null default 'curtida';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rede_curtidas'::regclass
      and conname = 'rede_curtidas_tipo_check'
  ) then
    alter table public.rede_curtidas
      add constraint rede_curtidas_tipo_check
      check (tipo in ('curtida', 'fogo', 'aplausos', 'coração'));
  end if;
end
$$;

comment on column public.rede_curtidas.tipo is
  'Reação por emoji: curtida (padrão), fogo, aplausos ou coração. Pedido do capitão em 2026-10-20.';

grant insert (tipo) on table public.rede_curtidas to authenticated;

-- ------------------------------------------------------------
-- TESTE (rodar à parte, depois da migration). Tudo dentro de uma
-- transação com ROLLBACK: nada fica gravado. Usa a primeira usuária que
-- já entrou na Rede (convite usado) e um post criado só para o teste.
-- Esperado: a última consulta devolve 1 linha com tipo = 'fogo'.
-- ------------------------------------------------------------
-- begin;
--   select set_config('request.jwt.claims', json_build_object(
--     'sub', (select usado_por from public.rede_convites where usado_por is not null limit 1),
--     'role', 'authenticated')::text, true);
--   set local role authenticated;
--
--   with post as (
--     insert into public.rede_posts (autor_id, categoria, texto)
--     values (auth.uid(), 'geral', 'teste 0041')
--     returning id
--   )
--   insert into public.rede_curtidas (post_id, user_id, tipo)
--   select id, auth.uid(), 'fogo' from post;
--
--   select post_id, user_id, tipo from public.rede_curtidas
--   where user_id = auth.uid() and tipo = 'fogo';
--
--   -- Tem que falhar (fora da lista): insert ... tipo = 'raiva'
-- rollback;
