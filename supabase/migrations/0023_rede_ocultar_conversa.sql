-- ============================================================
-- JobApp Rede - Migration 0023: excluir conversa (só pra mim) - issue #55
-- ============================================================
-- Decisão de produto (2026-08-19): "excluir conversa" esconde a conversa
-- só do lado de quem excluiu -- a outra pessoa continua vendo tudo
-- normalmente (mesmo padrão do WhatsApp/Telegram). Não é uma exclusão de
-- verdade: nenhuma linha de rede_mensagens/rede_conversas é apagada, só
-- uma marca "oculta desde" na própria linha de participação de quem
-- excluiu. A conversa reaparece sozinha na lista se a outra pessoa mandar
-- mensagem depois disso -- sem precisar de nenhuma ação de "desocultar".

alter table public.rede_conversas_participantes
  add column if not exists oculta_desde timestamptz;

create or replace function public.rede_ocultar_conversa(alvo_conversa_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'nao autenticado'
      using errcode = '42501';
  end if;

  update public.rede_conversas_participantes
    set oculta_desde = pg_catalog.clock_timestamp()
    where conversa_id = alvo_conversa_id
      and user_id = auth.uid();

  if not found then
    raise exception 'conversa nao encontrada'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.rede_ocultar_conversa(uuid) from public;
grant execute on function public.rede_ocultar_conversa(uuid)
  to authenticated, service_role;
