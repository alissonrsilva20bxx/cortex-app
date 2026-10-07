-- 0038: o estado da Jornada manda o que ela já fez HOJE, por ação (ordem do
-- operador: o card do Início desenha o "Próximo passo" do protótipo
-- aprovado, docs/jornada/referencias/prototipo-sua-jornada.html).
--
-- O protótipo escolhe o próximo passo assim: a primeira ação, na ordem
-- guardar numa meta, comprovante no Cofre, planejar amanhã, descanso,
-- despesa, que ela ainda NÃO fez hoje e que não bateu o limite do dia. O
-- servidor já guarda isso por ação em public.jornada_acoes (0034): `dia` é
-- o dia corrente dela e `ganhos_no_dia` quantas vezes a ação deu Glow
-- nesse dia (no máximo o limite). Nada novo é registrado: este campo só
-- lê o que já existe.
--
--   feitasHoje  { [acao]: vezes que deu Glow hoje }  (só as ações feitas hoje)
--
-- Feita sem copiar private.jornada_estado_de (0036): a função de antes
-- vira private.jornada_estado_base e a nova junta `feitasHoje` ao que ela
-- devolve.
--
-- Escrita, NUNCA aplicada por agente: quem aplica é o operador. Depende da
-- 0036_jornada_prototipo.sql.

alter function private.jornada_estado_de(uuid, date)
  rename to jornada_estado_base;

create or replace function private.jornada_feitas_hoje(p_user uuid, p_hoje date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(a.acao, a.ganhos_no_dia), '{}'::jsonb)
  from public.jornada_acoes a
  where a.user_id = p_user and a.dia = p_hoje and a.ganhos_no_dia > 0;
$$;

create or replace function private.jornada_estado_de(p_user uuid, p_hoje date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select private.jornada_estado_base(p_user, p_hoje)
    || jsonb_build_object('feitasHoje', private.jornada_feitas_hoje(p_user, p_hoje));
$$;

revoke all on function private.jornada_estado_base(uuid, date)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_feitas_hoje(uuid, date)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_estado_de(uuid, date)
  from public, anon, authenticated, service_role;
