-- ============================================================
-- JobApp Rede - Migration 0029: retomada de limpeza de midia falha
-- ============================================================
-- Achado na revisao da migration 0028: rede_midia_drenar_pendentes() já
-- apaga as linhas da fila (DELETE ... RETURNING) antes do cron chamar
-- storage.remove() de verdade -- se essa chamada falhar (erro transiente
-- de rede/API do Storage, não um "arquivo já não existe"), os paths
-- ficavam perdidos pra sempre, nunca reprocessados. Viola a orientação da
-- própria Vercel pra cron jobs: operações precisam ser idempotentes e
-- retomáveis após falha (https://vercel.com/docs/cron-jobs/manage-cron-jobs
-- -- "Design your operations to be idempotent and reconciliation-based").
--
-- Esta função devolve os paths pra fila quando o cron (app/api/cron/
-- rede-midia-limpeza) detecta que storage.remove() falhou depois de já
-- ter drenado -- só service_role chama, mesma política das outras funções
-- desta fila.

create or replace function public.rede_midia_reenfileirar_pendentes(paths text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.rede_midia_pendente_exclusao (path)
  select unnest(paths)
  on conflict (path) do nothing;
end;
$$;

revoke all on function public.rede_midia_reenfileirar_pendentes(text[]) from public;
grant execute on function public.rede_midia_reenfileirar_pendentes(text[]) to service_role;
