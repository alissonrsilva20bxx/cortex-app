-- ============================================================
-- JobApp Rede - Migration 0031: garante trigger de retenção desativado
-- ============================================================
-- A migration 0028 foi emendada para criar `rede_posts_retention` já
-- desativado (`alter table ... disable trigger`, na MESMA transação da
-- criação) -- fecha a janela por completo em qualquer ambiente que rode
-- 0028 do zero a partir de agora (produção incluída, nunca rodou 0028).
--
-- Mas ambientes que já executaram a versão ANTERIOR de 0028 (antes dessa
-- emenda) ficaram com o trigger HABILITADO -- é o caso de
-- `jobapp-homologacao`, que rodou 0028 original antes desta correção
-- existir. Editar o arquivo 0028 não muda retroativamente o que já foi
-- aplicado lá; por isso esta migration nova e idempotente, que qualquer
-- ambiente pode rodar sem efeito colateral:
--   - onde 0028 (emendada) já criou o trigger desativado: no-op.
--   - onde a 0028 antiga rodou com o trigger ativo (homologação): efeito
--     real, desativa agora.
--
-- Não chama private.rede_enforce_post_retention() nem apaga nenhuma
-- linha -- só muda o estado habilitado/desabilitado do trigger. Posts que
-- já passaram de 300 enquanto o trigger esteve ativo (se algum ambiente
-- chegou a inserir nesse intervalo) NÃO são limpos retroativamente por
-- esta migration nem pelo simples fato de desativar -- ver runbook de
-- ativação no PR #105 para o passo manual de reconciliação do backlog.

alter table public.rede_posts disable trigger rede_posts_retention;

-- ---------------------------------------------------------------
-- RPC para alternar o trigger sem exigir acesso direto ao Postgres
-- ---------------------------------------------------------------
-- "Ativar a retenção de verdade" (fora de uma migration) é uma decisão
-- deliberada, não algo que deve rodar sozinho -- esta função é o único
-- caminho oficial pra isso, e só service_role pode chamá-la (mesma
-- política das outras RPCs desta fila, 0028 §4). Não chama
-- private.rede_enforce_post_retention() nem apaga nada -- só liga/desliga
-- o trigger; qualquer limpeza de backlog acumulado é um passo manual
-- separado e deliberado (ver runbook de ativação, PR #105).
create or replace function public.rede_posts_retencao_definir_habilitada(habilitada boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if habilitada then
    execute 'alter table public.rede_posts enable trigger rede_posts_retention';
  else
    execute 'alter table public.rede_posts disable trigger rede_posts_retention';
  end if;
end;
$$;

-- `revoke ... from public` sozinho NÃO basta no Supabase: o
-- `alter default privileges` do projeto concede execute em toda função
-- nova de `public` explicitamente a `anon` e `authenticated` (não via
-- PUBLIC), e esses grants sobrevivem ao revoke acima. Sem a linha abaixo,
-- qualquer um com a anon key (que vai no bundle do navegador) chama esta
-- RPC via PostgREST e liga a exclusão automática de posts. Revoga
-- explicitamente dos dois papéis expostos.
revoke all on function public.rede_posts_retencao_definir_habilitada(boolean)
  from public, anon, authenticated;
grant execute on function public.rede_posts_retencao_definir_habilitada(boolean)
  to service_role;
