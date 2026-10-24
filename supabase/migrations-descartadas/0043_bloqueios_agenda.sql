-- DESCARTADA: o capitão descartou o Bloquear horário em 23/10/2026 (a Agenda é feita por ele mesmo, bloquear não muda nada). Nunca aplicar.
-- ============================================================
-- JobApp — Migration 0043: bloquear horário na Agenda
-- ============================================================
-- ESCRITA, NÃO APLICADA. Roda no Supabase SQL Editor quando o dono decidir.
-- Pedido do capitão em 2026-10-20.
--
-- O que faz: cria `bloqueios_agenda`, onde a pessoa marca um horário em que
-- não atende (almoço, médico, folga de meio período), com motivo opcional.
--
-- Por quê: hoje a Agenda só conhece jobs. Sem bloqueio, um horário livre na
-- tela pode não estar livre de verdade.
--
-- Nome sem prefixo `rede_` de propósito: a Agenda é do app principal, não
-- da Rede, e não se confunde com `rede_bloqueios` (bloquear outra pessoa,
-- 0008). Por isso as policies só olham o dono (auth.uid() = user_id), sem
-- exigir convite da Rede.

create table if not exists public.bloqueios_agenda (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null,
  inicio time not null,
  fim time not null,
  motivo varchar(255),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint bloqueios_agenda_fim_depois_inicio check (fim > inicio)
);

comment on table public.bloqueios_agenda is
  'Horários bloqueados na Agenda (sem atendimento). Pedido do capitão em 2026-10-20.';

create index if not exists bloqueios_agenda_user_data_idx
  on public.bloqueios_agenda (user_id, data);

-- atualizado_em segue o mesmo gatilho dos jobs e notas (set_updated_at, 0001).
drop trigger if exists bloqueios_agenda_updated_at on public.bloqueios_agenda;
create trigger bloqueios_agenda_updated_at
  before update on public.bloqueios_agenda
  for each row execute function public.set_updated_at();

alter table public.bloqueios_agenda enable row level security;

revoke all on table public.bloqueios_agenda from anon, authenticated, service_role;
grant select, insert, update, delete on table public.bloqueios_agenda to authenticated;
grant select, insert, update, delete on table public.bloqueios_agenda to service_role;

drop policy if exists "bloqueios_agenda: dono lê" on public.bloqueios_agenda;
create policy "bloqueios_agenda: dono lê"
  on public.bloqueios_agenda
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "bloqueios_agenda: dono cria" on public.bloqueios_agenda;
create policy "bloqueios_agenda: dono cria"
  on public.bloqueios_agenda
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "bloqueios_agenda: dono altera" on public.bloqueios_agenda;
create policy "bloqueios_agenda: dono altera"
  on public.bloqueios_agenda
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "bloqueios_agenda: dono apaga" on public.bloqueios_agenda;
create policy "bloqueios_agenda: dono apaga"
  on public.bloqueios_agenda
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- TESTE (rodar à parte, depois da migration). Transação com ROLLBACK.
-- Esperado: a consulta devolve 1 linha (12:00–13:00, "Almoço").
-- ------------------------------------------------------------
-- begin;
--   select set_config('request.jwt.claims', json_build_object(
--     'sub', (select id from auth.users order by created_at limit 1),
--     'role', 'authenticated')::text, true);
--   set local role authenticated;
--
--   insert into public.bloqueios_agenda (user_id, data, inicio, fim, motivo)
--   values (auth.uid(), date '2026-10-21', time '12:00', time '13:00', 'Almoço');
--
--   select data, inicio, fim, motivo
--   from public.bloqueios_agenda
--   where user_id = auth.uid()
--   order by data, inicio;
-- rollback;
