-- ============================================================
-- JobApp Rede - Migration 0018: RPC estreita pra listar bloqueios do proprio usuario
-- ============================================================
-- T8 (issue #35) precisa de uma tela "Pessoas bloqueadas" com nome/avatar
-- pra permitir desbloquear (`desbloquearUsuario` ja existe e ja e testado,
-- so faltava a UI). Mas 0017 tornou o bloqueio simetrico em
-- `rede_perfis`/`rede_livelinks: member select` -- correto pra leitura
-- geral, mas isso tambem impede quem bloqueou de ler o nome de quem
-- bloqueou, o que essa tela precisa.
--
-- Esta RPC e uma excecao estreita e aditiva, nao uma relaxacao da policy
-- geral (0017 continua intocada, simetrica, testada):
--   - security definer, retorna so {user_id, nome_exibicao, cor_avatar}
--     (sem bio, sem LiveLinks, sem nenhum outro campo);
--   - sempre filtrada por `bloqueador_id = auth.uid()` -- cada chamador so
--     ve os proprios bloqueios de saida, nunca os de terceiros;
--   - nunca revela quem bloqueou o chamador (bloqueios de entrada
--     continuam invisiveis, mesmo espirito do comentario em
--     `private.rede_users_unblocked`: "sem oferecer um RPC que revele
--     quem bloqueou quem" -- essa RPC não quebra essa garantia porque so
--     devolve a direcao "eu bloqueei", nunca "fui bloqueado por").
--
-- Pendente de aplicacao remota e de nova autorizacao humana antes do
-- lancamento -- validado e aplicado so no Supabase local descartavel
-- neste ticket.

create or replace function public.rede_listar_bloqueados()
returns table (
  user_id uuid,
  nome_exibicao text,
  cor_avatar text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.nome_exibicao, p.cor_avatar
  from public.rede_perfis p
  join public.rede_bloqueios b on b.bloqueado_id = p.user_id
  where b.bloqueador_id = auth.uid();
$$;

revoke all on function public.rede_listar_bloqueados() from public;
grant execute on function public.rede_listar_bloqueados() to authenticated;
