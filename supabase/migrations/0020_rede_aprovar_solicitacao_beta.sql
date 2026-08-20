-- ============================================================
-- JobApp Rede - Migration 0020: aprovação direta de solicitação de beta
-- ============================================================
-- Issue #89. Quem solicita a beta (rede_solicitacoes_beta) já está
-- autenticada -- diferente do convite tradicional (0015), não faz sentido
-- gerar um código pra essa pessoa digitar/colar de volta no próprio app
-- onde ela já está logada. Esta RPC aprova a solicitação e libera o acesso
-- direto: insere em rede_convites já com usado_por/usado_em preenchidos
-- pro user_id da solicitação (nunca passa pelo fluxo público de resgate),
-- e marca a solicitação como 'convidado'. lib/rede/acesso.ts já deriva
-- acesso liberado só de existir uma linha em rede_convites com
-- usado_por = auth.uid() -- nenhuma mudança necessária lá nem em
-- RedeGatedTab.tsx, o desbloqueio acontece sozinho na próxima verificação.
--
-- codigo_hash aqui é só um valor único interno (gen_random_uuid()), nunca
-- corresponde a nenhum texto puro que alguém digita -- este convite nasce
-- já resgatado, não é resgatável pelo fluxo público.

create or replace function public.rede_aprovar_solicitacao_beta(solicitacao_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  alvo record;
  convite_id uuid;
  agora timestamptz := pg_catalog.clock_timestamp();
begin
  if auth.uid() is null or not public.rede_is_admin() then
    raise exception 'acesso negado'
      using errcode = '42501';
  end if;

  select id, user_id, status
    into alvo
    from public.rede_solicitacoes_beta
    where id = solicitacao_id
    for update;

  if alvo.id is null then
    raise exception 'solicitacao nao encontrada'
      using errcode = 'P0002';
  end if;

  if alvo.status <> 'pendente' then
    raise exception 'solicitacao ja processada'
      using errcode = '22023';
  end if;

  insert into public.rede_convites (
    codigo_hash, solicitacao_id, usado_por, usado_em, expira_em
  )
  values (
    'aprovacao-direta:' || gen_random_uuid()::text,
    alvo.id,
    alvo.user_id,
    agora,
    agora
  )
  returning id into convite_id;

  update public.rede_solicitacoes_beta
    set status = 'convidado'
    where id = alvo.id;

  return pg_catalog.jsonb_build_object(
    'convite_id', convite_id,
    'user_id', alvo.user_id
  );
end;
$$;

revoke all on function public.rede_aprovar_solicitacao_beta(uuid) from public;
grant execute on function public.rede_aprovar_solicitacao_beta(uuid)
  to authenticated, service_role;
