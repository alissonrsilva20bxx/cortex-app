-- JobApp Migration 0003: Marco 5 - notificacoes push (opt-in)
-- Roda no Supabase SQL Editor (mesmo fluxo manual das migrations 0001/0002).
-- Spec S7.3: notificacoes opt-in e valiosas (lembrete de atendimento,
-- cliente recorrente). Nunca spam, nunca alarme.
--
-- Sem coluna de preferencia separada: a existencia de uma inscricao aqui
-- JA E o opt-in. Desativar = apagar a inscricao (lib/push.ts faz isso).

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "push_subscriptions: owner full access" on push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
