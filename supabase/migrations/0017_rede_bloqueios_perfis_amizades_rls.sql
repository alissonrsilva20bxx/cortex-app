-- ============================================================
-- JobApp Rede - Migration 0017: bloqueios cobrem perfis/LiveLinks/amizades
-- ============================================================
-- 0006 (rede_perfis/rede_livelinks) e 0008 (insert de rede_amizades) sao
-- anteriores a rede_bloqueios (0008) e nunca foram revisitadas -- as duas
-- ficaram sem checagem de bloqueio, diferente de conteudo (0009) e
-- mensageria (0010), que ja fazem esse retrofit corretamente.
--
-- Reaproveita o mesmo helper ja usado com sucesso em 0009/0010
-- (private.rede_users_unblocked), sem criar nenhuma funcao nova nem
-- expor um RPC que revele quem bloqueou quem.

drop policy if exists "rede_perfis: member select" on public.rede_perfis;
create policy "rede_perfis: member select"
  on public.rede_perfis
  for select
  to authenticated
  using (
    public.rede_is_member()
    and private.rede_users_unblocked(user_id)
  );

drop policy if exists "rede_livelinks: member select" on public.rede_livelinks;
create policy "rede_livelinks: member select"
  on public.rede_livelinks
  for select
  to authenticated
  using (
    public.rede_is_member()
    and private.rede_users_unblocked(user_id)
  );

drop policy if exists "rede_amizades: requester insert" on public.rede_amizades;
create policy "rede_amizades: requester insert"
  on public.rede_amizades
  for insert
  to authenticated
  with check (
    auth.uid() = solicitante_id
    and public.rede_is_member()
    and status = 'pendente'
    and respondido_em is null
    and private.rede_users_unblocked(destinatario_id)
  );
