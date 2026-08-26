-- ============================================================
-- JobApp - Migration 0027: corrige handle_new_user() sem schema
-- ============================================================
-- A função em produção foi editada fora do fluxo de migrations (via SQL
-- Editor) em algum momento após a 0004: ganhou "on conflict do nothing"
-- (idempotência, mantida aqui) mas perdeu a qualificação "public." nas
-- tabelas e o "set search_path = ''". Sem schema explícito e sem
-- search_path travado, a conexão do GoTrue não resolve "metas"/
-- "configuracoes" sem qualificação -- todo signup novo quebrava com
-- "Database error saving new user" (relation "metas" does not exist,
-- visto direto nos Postgres Logs).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.metas (user_id, periodo, valor_alvo) values
    (new.id, 'dia',  300),
    (new.id, 'mes',  3000),
    (new.id, 'ano',  36000)
  on conflict (user_id, periodo) do nothing;

  insert into public.configuracoes (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
