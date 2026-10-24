-- ============================================================
-- JobApp Rede — Migration 0042: Desejo + Objetivo = um (Wishlist) e prazo
-- ============================================================
-- ESCRITA, NÃO APLICADA. Roda no Supabase SQL Editor quando o dono decidir.
-- Pedido do capitão em 2026-10-20.
--
-- O que faz: confirma `rede_wishlist_items` como a tabela única do Desejo
-- (o "Objetivo" de dinheiro é o mesmo item) e acrescenta `prazo date`
-- (vazio = sem prazo).
--
-- Por quê: Desejo e Objetivo de dinheiro eram a mesma coisa com dois nomes.
-- Uma tabela só evita guardar dinheiro em dois lugares; o prazo deixa a
-- pessoa dizer "até quando" quer conquistar.
--
-- O que foi conferido no histórico das migrations (0001–0040):
--   - `rede_wishlist_items` existe (0021) e já é a meta de dinheiro da
--     Jornada (0035 premia `guardar_meta` em cima dela). Ela É o Desejo.
--   - `criado_em` já existe (0021); o `add column if not exists` abaixo só
--     garante, não muda nada.
--   - NÃO existe tabela `rede_objetivos`. Nenhuma migration a cria.
--   - Existe `public.objetivos` (0004), mas ela é outra coisa: a lista de
--     afazeres do card "Objetivos" da tela Início (titulo, categoria,
--     concluido — sem valor em euro). O app lê e grava nela hoje
--     (app/page.tsx). Juntar com a Wishlist apagaria afazeres do Início e
--     criaria Desejos de 0 €. Por isso esta migration NÃO toca nela.
--
-- Nada é apagado. Se um dia aparecer uma `rede_objetivos` no banco (criada
-- fora das migrations), o bloco abaixo só avisa (NOTICE) em vez de migrar às
-- cegas uma tabela cujo formato não conhecemos.
--
-- Estados da Wishlist continuam os de 0021: 'quero', 'planejando',
-- 'conquistado' (o "concluído" do pedido é 'conquistado').

alter table public.rede_wishlist_items
  add column if not exists prazo date;

alter table public.rede_wishlist_items
  add column if not exists criado_em timestamptz not null default now();

comment on table public.rede_wishlist_items is
  'Desejo (e Objetivo de dinheiro): tabela única desde 0042, pedido do capitão em 2026-10-20.';
comment on column public.rede_wishlist_items.prazo is
  'Até quando a pessoa quer conquistar o Desejo. Vazio = sem prazo.';

do $$
begin
  if to_regclass('public.rede_objetivos') is not null then
    raise notice 'Existe public.rede_objetivos fora das migrations. Nada foi migrado nem apagado: conferir o formato dela antes de juntar com rede_wishlist_items.';
  end if;
end
$$;

-- Os grants de 0021 são por tabela inteira (select, insert, update, delete
-- para authenticated), então `prazo` já entra neles. As policies de dono
-- (0021) não mudam.

-- ------------------------------------------------------------
-- TESTE (rodar à parte, depois da migration). Transação com ROLLBACK.
-- Esperado: a consulta devolve 1 linha com prazo = 2026-12-24.
-- ------------------------------------------------------------
-- begin;
--   select set_config('request.jwt.claims', json_build_object(
--     'sub', (select usado_por from public.rede_convites where usado_por is not null limit 1),
--     'role', 'authenticated')::text, true);
--   set local role authenticated;
--
--   insert into public.rede_wishlist_items (user_id, nome, cor, valor_alvo, prazo)
--   values (auth.uid(), 'teste 0042', '#C9A227', 500.00, date '2026-12-24');
--
--   select nome, valor_alvo, valor_atual, estado, prazo
--   from public.rede_wishlist_items
--   where user_id = auth.uid() and nome = 'teste 0042';
-- rollback;
