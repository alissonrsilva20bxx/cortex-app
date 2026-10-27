-- ============================================================
-- JobApp Jornada — Migration 0048: desfazer o descanso de hoje
-- ============================================================
-- ESCRITA, NÃO APLICADA. Roda no Supabase SQL Editor quando o dono decidir.
-- Precisa da 0036 (jornada_semana_dias), da 0038 (feitasHoje) e da 0039
-- (private.jornada_aplicar com o Glow do período). Não depende das outras
-- migrations novas.
--
-- Por quê (capitão, 27/10, testando no iPhone): o botão Descanso da Agenda
-- registrava o descanso de hoje uma vez e virava "Descansou" sem volta.
-- Agora tocar em "Descansou" desfaz. Os dias de descanso ficam no aparelho
-- (lib/jornada/descansos.ts); só o de HOJE conta na Jornada, e desfazer tem
-- de tirar o que o dia deu. Sem esta migration o app funciona: o desfazer
-- fica só no aparelho (o botão, o "Próximo passo" e o ritmo da semana já
-- mostram certo), mas o Glow e os contadores que o servidor deu continuam.
--
-- O que faz: public.jornada_desfazer_descanso(p_fuso, p_deslocamento_min).
-- Se o descanso de hoje deu Glow (jornada_acoes 'descanso' com dia = hoje e
-- ganhos_no_dia > 0), tira exatamente o que private.jornada_aplicar deu:
--   - o Glow da regra (10, pilar proteger) do saldo e do 'glow' dos
--     períodos correntes (semana, mês, ano);
--   - 'descanso' dos períodos correntes e o contador 'dias_descanso';
--   - uma contagem_total; ganhos_no_dia volta a 0 (com dia nulo, como pede
--     a 0034) e as chaves recentes da ação são esquecidas (marcar de novo
--     hoje conta outra vez, uma vez);
--   - a marca 'descanso' de hoje no ritmo da semana (dia forte continua).
-- Nível de selo, capítulo e estágio já ganhos não voltam: são de uma vez só
-- e nunca são dados de novo, então marcar e desmarcar não rende Glow extra.
-- Sem descanso hoje, não muda nada. Devolve o estado (como jornada_estado).
--
-- Nada de tabela, coluna nem lista de dias nova (spec §8, sem diário).
--
-- Como desfazer:
--   drop function if exists public.jornada_desfazer_descanso(text, integer);
-- (o app volta a desfazer só no aparelho, como antes de aplicar).
--
-- Conferência (depois de aplicar):
--   select proname from pg_proc where proname = 'jornada_desfazer_descanso';
-- Comportamento nos dois caminhos (sem e com a 0048), num Postgres em
-- memória: tests/jornada/desfazer-descanso-0048-pglite.mjs.

create or replace function public.jornada_desfazer_descanso(
  p_fuso text default null,
  p_deslocamento_min integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hoje date;
  v_regra record;
  v_dia date;
  v_ganhos integer;
begin
  if v_uid is null then
    raise exception 'jornada: sem sessão' using errcode = '42501';
  end if;
  v_hoje := private.jornada_hoje(v_uid, p_fuso, p_deslocamento_min, true);
  select * into v_regra from private.jornada_regra('descanso');

  -- Trava da usuária: a mesma fila de private.jornada_aplicar.
  insert into public.jornada_saldo (user_id) values (v_uid) on conflict do nothing;
  perform 1 from public.jornada_saldo s where s.user_id = v_uid for update;

  select a.dia, a.ganhos_no_dia into v_dia, v_ganhos
  from public.jornada_acoes a
  where a.user_id = v_uid and a.acao = 'descanso'
  for update;

  if found and v_dia = v_hoje and coalesce(v_ganhos, 0) > 0 then
    -- ganhos_no_dia 0 pede dia nulo (jornada_acoes_limite_coerente, 0034);
    -- o próximo registro de hoje volta a contar do zero.
    update public.jornada_acoes
    set contagem_total = greatest(contagem_total - 1, 0),
        dia = null,
        ganhos_no_dia = 0,
        chaves_recentes = '{}'::text[]
    where user_id = v_uid and acao = 'descanso';

    perform private.jornada_somar_periodo(v_uid, t, 'descanso', -1)
    from unnest(array['semana', 'mes', 'ano']) as t;
    -- Update direto: o insert de private.jornada_somar_contador com -1 cai
    -- no check total >= 0 antes do on conflict.
    update public.jornada_contadores
    set total = greatest(total - 1, 0)
    where user_id = v_uid and chave = 'dias_descanso';

    if v_regra.glow > 0 then
      perform private.jornada_somar_glow(v_uid, v_regra.pilar, -v_regra.glow);
      perform private.jornada_somar_periodo(v_uid, t, 'glow', -v_regra.glow)
      from unnest(array['semana', 'mes', 'ano']) as t;
    end if;

    delete from public.jornada_semana_dias d
    where d.user_id = v_uid and d.dia = v_hoje and d.marca = 'descanso';
  end if;

  return private.jornada_estado_de(v_uid, v_hoje);
end;
$$;

revoke all on function public.jornada_desfazer_descanso(text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.jornada_desfazer_descanso(text, integer)
  to authenticated;
