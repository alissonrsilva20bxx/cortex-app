-- ============================================================
-- JobApp Rede - Migration 0009b: ocultar autor em posts anonimos
-- ============================================================
-- Escopo (RD-05b): so posts, nao comentarios -- anonimato de comentario e
-- proposta separada, nao aprovada ainda (BETA_DOMAIN_MODEL.md secao 4).
-- Executado a pedido explicito do produto (fora do fluxo normal de espera
-- por aprovacao registrado em BACKEND_TICKETS.md).
--
-- RLS de linha nao esconde coluna -- um post anonimo continuaria expondo
-- autor_id pra qualquer membro que fizesse SELECT direto na tabela base,
-- mesmo com a policy de bloqueio ja existente (0009) intacta. A correcao
-- tem duas partes, nenhuma sozinha resolve:
--
-- 1. Revoga o SELECT de "authenticated" na tabela base e regrant so nas
--    colunas que nunca precisam de segredo (exclui autor_id). Isso fecha o
--    caminho de bypass -- ninguem le autor_id direto na tabela, anonimo ou
--    nao.
-- 2. Cria a view rede_posts_publico, dona = quem roda a migration (nao
--    "authenticated"), que reaplica a mesma regra de visibilidade da RLS
--    original (membro + nao-bloqueado) no proprio WHERE -- uma view por
--    padrao roda a subconsulta com o privilegio de quem a criou, entao
--    contorna a RLS da tabela base de proposito (e por isso precisa
--    reimplementar o filtro de linha manualmente, nao herda de graca) --,
--    e so entao decide, campo a campo, se autor_id volta como o valor real
--    ou como null: real se o post nao e anonimo, ou se quem pergunta e o
--    proprio autor, ou se quem pergunta e admin; null em qualquer outro
--    caso.
--
-- lib/rede/feed.ts (RD-11) passa a ler da view, nao da tabela base --
-- unica mudanca de codigo de aplicacao necessaria; a policy de INSERT
-- continua na tabela base normalmente (RD-05b nao muda quem pode criar
-- post, so quem ve o autor depois de criado).

alter table public.rede_posts
  add column if not exists anonimo boolean not null default false;

-- Recorta o SELECT de "authenticated" para excluir autor_id -- as demais
-- colunas continuam legiveis direto na tabela base (nao muda nada que os
-- testes de RD-05 ja cobrem, nenhum deles projeta autor_id).
revoke select on table public.rede_posts from authenticated;
grant select (id, categoria, texto, anonimo, criado_em, atualizado_em)
  on table public.rede_posts
  to authenticated;

-- Estende insert/update pra cobrir a coluna nova (mesma lista de colunas
-- de 0009, so com anonimo adicionado).
revoke insert on table public.rede_posts from authenticated;
grant insert (autor_id, categoria, texto, anonimo)
  on table public.rede_posts
  to authenticated;

revoke update on table public.rede_posts from authenticated;
grant update (categoria, texto, anonimo)
  on table public.rede_posts
  to authenticated;

create or replace view public.rede_posts_publico as
select
  p.id,
  p.categoria,
  p.texto,
  p.anonimo,
  p.criado_em,
  p.atualizado_em,
  case
    when p.anonimo
      and p.autor_id is distinct from auth.uid()
      and not public.rede_is_admin()
    then null
    else p.autor_id
  end as autor_id
from public.rede_posts p
where
  public.rede_is_member()
  and private.rede_users_unblocked(p.autor_id);

revoke all on public.rede_posts_publico from public, anon;
grant select on public.rede_posts_publico to authenticated, service_role;
