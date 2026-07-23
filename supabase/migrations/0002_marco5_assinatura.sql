-- ============================================================
-- JobApp — Migration 0002: Marco 5 — estado de assinatura (trial)
-- ============================================================
-- Roda no Supabase SQL Editor (mesmo fluxo manual da migration 0001).
-- Spec §7.5: "gestão de estado de assinatura (trial/ativo/vencido) via
-- Supabase, com RLS". RLS já cobre a tabela inteira (policy "configuracoes:
-- owner full access" da 0001) — não precisa de policy nova.

create type assinatura_status as enum ('trial', 'ativa', 'vencida');

alter table configuracoes
  add column trial_started_at timestamptz not null default now(),
  add column assinatura_status assinatura_status not null default 'trial';

-- Backfill: quem já tinha conta ganha o teste contado do cadastro real
-- (auth.users.created_at), não do instante em que esta migration roda.
update configuracoes c
set trial_started_at = u.created_at
from auth.users u
where c.user_id = u.id;

-- handle_new_user() (da 0001) já cobre novos cadastros sem alteração: o
-- INSERT não especifica essas colunas, então os DEFAULTs (now() / 'trial')
-- se aplicam sozinhos.
