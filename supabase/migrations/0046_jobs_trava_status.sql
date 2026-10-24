-- ============================================================
-- JobApp — Migration 0046: trava do status do atendimento (jobs)
-- ============================================================
-- ESCRITA, NÃO APLICADA. Roda no Supabase SQL Editor quando o dono decidir.
-- Não depende de nenhuma outra migration nova (nem da 0040).
--
-- Por quê (item C6 da auditoria): a regra do status existe só no app
-- (lib/atendimentos/status.ts). A policy "jobs: owner full access" (0001)
-- deixa a própria usuária, chamando a API direto com a sessão dela, gravar
-- qualquer status. Exemplo: "concluído" num atendimento da semana que vem,
-- que conta o dia na Jornada antes da hora.
--
-- O que faz: um gatilho BEFORE INSERT OR UPDATE em `jobs` aceita só as
-- mudanças que o app faz e recusa o resto com erro 23514 e mensagem clara.
-- As mudanças do app (lista TRANSICOES-DO-APP abaixo; o teste
-- tests/lib/travaStatusMigration.test.ts compara a lista com a lib):
--   - Agendado: sempre (formulário Novo e Editar).
--   - Confirmado: só antes do horário (botão Confirmar e formulário).
--   - Concluído: só a partir do horário (Concluir, Aconteceu? e formulário).
--   - Cancelado ("Não aconteceu"): a partir do horário, de qualquer status
--     (Aconteceu? e formulário). Antes do horário, só de Agendado ou
--     Confirmado ("Cliente desmarcou").
--   "Antes/a partir do horário" é sempre o horário NOVO (data + hora que
--   ficam gravadas). Mudar data ou hora passa pela mesma regra.
--
-- O que NÃO trava (de propósito, para nunca bloquear a usuária):
--   - Fuso: o app compara a data e a hora com o relógio do APARELHO, no fuso
--     dele. O banco não sabe esse fuso (a usuária pode viajar). Por isso a
--     trava usa folga que cobre todos os fusos do mundo (UTC-12 a UTC+14)
--     e mais 1 hora para relógio de aparelho adiantado ou atrasado:
--       "a partir do horário" = data + hora <= agora em UTC + 15 horas;
--       "antes do horário"    = data + hora >  agora em UTC - 13 horas.
--     Pega o abuso grosso (concluir amanhã à tarde ou a semana que vem);
--     a regra fina, no minuto, continua no app.
--   - Linhas antigas: o gatilho só olha gravação nova. Update que não muda
--     status, data nem hora (editar nome, valor, local, observações) passa
--     sempre, mesmo numa linha antiga que fugiria da regra (ex.: um
--     "concluído" futuro que sobrou do bug antigo). Nenhuma linha existente
--     é alterada nem conferida ao aplicar.
--   - Service role (crons, webhooks) e o SQL Editor (sem sessão) passam
--     livres, como na 0040: só a sessão da usuária (authenticated/anon)
--     passa pela trava.
--   - DELETE não é afetado.
--
-- Sem esta migration o app continua funcionando igual (o app já segue a
-- regra); só fica a brecha da API direta.
--
-- Como desfazer:
--   drop trigger if exists jobs_status_no_fluxo on public.jobs;
--   drop function if exists public.jobs_status_no_fluxo();
--
-- Conferência (depois de aplicar), deve voltar 1 linha:
--   select tgname from pg_trigger
--   where tgrelid = 'public.jobs'::regclass and tgname = 'jobs_status_no_fluxo';
--
-- Informativo (antes ou depois, não muda nada): linhas antigas que hoje o
-- app não deixaria gravar. Elas continuam como estão; a trava só vale para
-- gravação nova.
--   select id, status, data, hora from public.jobs
--   where (status = 'concluído' and data + hora > (now() at time zone 'UTC') + interval '15 hours')
--      or (status = 'confirmado' and data + hora <= (now() at time zone 'UTC') - interval '13 hours');

create or replace function public.jobs_status_no_fluxo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_papel text;
  v_antigo text;
  v_instante timestamp;
  v_agora_utc timestamp := now() at time zone 'UTC';
  v_antes boolean;
  v_depois boolean;
begin
  -- Sem JWT (SQL Editor, migrations) a configuração vem nula ou vazia: o
  -- nullif evita o erro de converter '' em jsonb.
  v_papel := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
  if v_papel not in ('authenticated', 'anon') then
    return new;
  end if;

  -- Não mexeu no status, na data nem na hora: passa (inclui linha antiga).
  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.data is not distinct from old.data
     and new.hora is not distinct from old.hora then
    return new;
  end if;

  v_antigo := case when tg_op = 'INSERT' then 'novo' else old.status::text end;
  v_instante := new.data + new.hora;
  v_antes := v_instante > v_agora_utc - interval '13 hours';
  v_depois := v_instante <= v_agora_utc + interval '15 hours';

  if exists (
    select 1
    from (values
      -- TRANSICOES-DO-APP (antigo, novo, quando). 'novo' = atendimento
      -- novo (INSERT). quando: sempre | antes | depois do horário.
      ('novo',       'agendado',   'sempre'),
      ('novo',       'confirmado', 'antes'),
      ('novo',       'concluído',  'depois'),
      ('novo',       'cancelado',  'depois'),
      ('agendado',   'agendado',   'sempre'),
      ('agendado',   'confirmado', 'antes'),
      ('agendado',   'concluído',  'depois'),
      ('agendado',   'cancelado',  'sempre'),
      ('confirmado', 'agendado',   'sempre'),
      ('confirmado', 'confirmado', 'antes'),
      ('confirmado', 'concluído',  'depois'),
      ('confirmado', 'cancelado',  'sempre'),
      ('concluído',  'agendado',   'sempre'),
      ('concluído',  'confirmado', 'antes'),
      ('concluído',  'concluído',  'depois'),
      ('concluído',  'cancelado',  'depois'),
      ('cancelado',  'agendado',   'sempre'),
      ('cancelado',  'confirmado', 'antes'),
      ('cancelado',  'concluído',  'depois'),
      ('cancelado',  'cancelado',  'depois')
      -- FIM-TRANSICOES-DO-APP
    ) as t(antigo, novo, quando)
    where t.antigo = v_antigo
      and t.novo = new.status::text
      and (t.quando = 'sempre'
           or (t.quando = 'antes' and v_antes)
           or (t.quando = 'depois' and v_depois))
  ) then
    return new;
  end if;

  raise exception 'Este status não vale para o horário do atendimento.'
    using errcode = '23514',
          detail = format('jobs: de %s para %s, horário %s.', v_antigo, new.status, v_instante),
          hint = 'Confirmado só antes do horário; Concluído só a partir dele; Cancelado antes do horário só de Agendado ou Confirmado.';
end;
$$;

drop trigger if exists jobs_status_no_fluxo on public.jobs;
create trigger jobs_status_no_fluxo
  before insert or update on public.jobs
  for each row execute function public.jobs_status_no_fluxo();
