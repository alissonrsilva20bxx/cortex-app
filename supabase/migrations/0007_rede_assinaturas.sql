-- ============================================================
-- JobApp Rede - Migration 0007: assinaturas da Rede
-- ============================================================
-- rede_assinaturas e um plano separado da assinatura do JobApp base
-- (configuracoes.assinatura_status) -- ver docs/rede/BETA_DOMAIN_MODEL.md §9.
-- Misturar os dois planos numa coluna so criaria ambiguidade ("vencida" de
-- qual dos dois produtos?), por isso e uma tabela propria, nao uma coluna
-- nova em configuracoes.
--
-- Bloqueador critico corrigido nesta migration (docs/rede/CODEX_REVIEW.md):
-- o dono da linha so pode LER o proprio status. Ativar/prorrogar/cancelar e
-- operacao privilegiada, feita so por service_role (webhook de pagamento ou
-- rotina admin), nunca pelo client autenticado -- sem isso, qualquer usuario
-- autenticado poderia se autoconceder uma assinatura ativa sem pagar. Isso e
-- reforcado em duas camadas independentes: o GRANT de tabela (authenticated
-- so recebe SELECT, nunca INSERT/UPDATE/DELETE) e a ausencia de qualquer
-- policy de escrita para authenticated (RLS nega por padrao quando nenhuma
-- policy cobre o comando). Mesmo que uma das duas falhe, a outra ainda
-- bloqueia.

create type public.rede_assinatura_status as enum ('trial', 'ativa', 'vencida', 'cancelada');

create table if not exists public.rede_assinaturas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status public.rede_assinatura_status not null default 'trial',
  trial_started_at timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

alter table public.rede_assinaturas enable row level security;

-- Supabase's current default no longer auto-exposes new public objects.
-- Keep client privileges minimal; RLS remains the row-level gate, but the
-- GRANT itself is also part of the defense here (see header comment).
revoke all on table public.rede_assinaturas from anon, authenticated, service_role;
grant select on table public.rede_assinaturas to authenticated;
grant select, insert, update, delete on table public.rede_assinaturas to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_assinaturas'
      and policyname = 'rede_assinaturas: owner select'
  ) then
    create policy "rede_assinaturas: owner select"
      on public.rede_assinaturas
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

-- Nenhuma policy de insert/update/delete e criada para "authenticated" de
-- proposito -- sem policy, RLS nega o comando por padrao. service_role
-- ignora RLS (bypassrls, padrao do Supabase) e ja tem o GRANT acima, entao
-- nao precisa de policy propria.
