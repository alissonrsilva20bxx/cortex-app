-- ============================================================
-- JobApp Jornada - Migration 0035: o motor no servidor
-- ============================================================
-- Ticket J10 (#160). Spec: docs/jornada/spec-sua-jornada.md (final).
-- Armazenamento: 0034 (J09). As referências "§N" são seções da spec.
--
-- O servidor decide tudo (§8): quanto Glow uma ação vale, se passou do
-- limite do dia, selos, missões, capítulo, marcos, meta e estágio. O
-- cliente chama `jornada_registrar` e RECEBE o resultado: o estado novo e a
-- fila de comemorações já ordenada. Ele não calcula nada.
--
-- CONTRATO: o da camada cliente da J11 (PR #187, lib/jornada/estado.ts):
--   jornada_estado(p_fuso, p_deslocamento_min)             -> EstadoJornada
--   jornada_registrar(p_acao, p_chave, p_fuso, p_deslocamento_min)
--                                  -> { estado: EstadoJornada, comemoracoes }
-- Os JSON saem em camelCase, com os nomes de lá.
--
-- Peças:
--   public.jornada_registrar   a RPC central (cliente). auth.uid() na
--                              primeira linha; nunca recebe id de usuária.
--   public.jornada_estado      leitura, já calculada. Não escreve nada.
--   private.jornada_aplicar    o motor. Recebe a usuária já resolvida; só
--                              é chamado por funções deste arquivo.
--   private.jornada_estado_de  monta o EstadoJornada.
--   private.jornada_creditar_dica
--                              "Isso me ajudou/protegeu" credita a AUTORA
--                              da dica, não quem clicou. Fica pronto pra
--                              ser chamado pelo gatilho da reação quando a
--                              Rede tiver o botão (ainda não existe).
--
-- FUSO (§2, J10 "Regras"): o caminho escolhido é o fuso IANA guardado em
-- jornada_preferencias.fuso. O cliente manda p_fuso
-- (Intl.DateTimeFormat().resolvedOptions().timeZone) e p_deslocamento_min
-- (o inverso de Date.getTimezoneOffset()). Na primeira chamada com um fuso
-- válido, ele é guardado (nunca sobrescrito). Sem fuso guardado nem válido,
-- vale o deslocamento. "UTC" genérico com deslocamento diferente de zero é
-- tratado como "não sei o fuso" (é o que o cliente da J11 manda quando o
-- aparelho não informa) e nunca é guardado. Sem fuso nem deslocamento,
-- jornada_registrar recusa: nunca cai em UTC por omissão. Exceção: o
-- crédito de dica, que não tem o aparelho da autora na mão, usa o fuso
-- guardado dela e, sem ele, UTC.
--
-- CHAMADA DUPLICADA (J10 "Regras"): toda chamada traz p_chave, gerada pelo
-- cliente UMA vez por ação e repetida em qualquer reenvio. As últimas 10
-- chaves de cada ação ficam em jornada_acoes.chaves_recentes (só as chaves
-- aleatórias, sem data nem conteúdo); chave repetida não conta nada. Além
-- disso, cada chamada trava a linha de jornada_saldo da usuária (for
-- update): duas chamadas simultâneas dela rodam uma depois da outra.
--
-- ORDEM DA FILA (contrato, J10): pequena -> selo -> estágio -> meta. As
-- comemorações que a spec acrescentou entram assim, na ordem dos tipos da
-- J11 (TIPOS_COMEMORACAO): pequena, selo, estagio, capitulo, marco, meta.
-- O estágio é calculado depois de TODO o Glow da chamada. Cada item tem um
-- id único (chave da chamada + posição) e `adiada` = true nas comemorações
-- grandes que vieram do registro de atendimento (próxima abertura).

-- NUNCA UM DIÁRIO (§1.16, §8): nada aqui grava uma linha por ação com data.
-- Só sobe contador, sobrescreve o dia corrente e o período corrente.

-- ------------------------------------------------------------
-- Ajustes de armazenamento que só o motor usa
-- ------------------------------------------------------------

-- Idempotência: as últimas chaves de chamada de cada ação (ver topo).
alter table public.jornada_acoes
  add column if not exists chaves_recentes text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jornada_acoes_chaves_recentes_limite'
  ) then
    alter table public.jornada_acoes
      add constraint jornada_acoes_chaves_recentes_limite
      check (cardinality(chaves_recentes) <= 10);
  end if;
end
$$;

-- Metas de dinheiro já premiadas com +100 (§7: "uma vez por meta"). As
-- metas de dinheiro do app são os itens da Wishlist (valor_alvo e
-- valor_atual, o "Já guardado"). Só o id do item, nunca quando.
create table if not exists public.jornada_metas_premiadas (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.rede_wishlist_items(id) on delete cascade,
  primary key (user_id, item_id)
);

alter table public.jornada_metas_premiadas enable row level security;
revoke all on table public.jornada_metas_premiadas from anon, authenticated, service_role;
grant select on table public.jornada_metas_premiadas to authenticated;
grant select, insert, update, delete on table public.jornada_metas_premiadas to service_role;

drop policy if exists "jornada_metas_premiadas: owner select" on public.jornada_metas_premiadas;
create policy "jornada_metas_premiadas: owner select"
  on public.jornada_metas_premiadas for select to authenticated
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- As regras (os números da spec moram SÓ aqui)
-- ------------------------------------------------------------

-- §3: Glow, limite por dia e pilar de cada ação.
--   por_dia  o contador de período e o de vida inteira contam DIAS (no
--            máximo 1 por dia): "Planejar 6 dias", "dias de descanso".
-- 'atendimento' e 'abrir_jornada' dão 0 Glow: atendimento só marca o dia
-- como ativo (decisão de produto, §3); abrir alimenta "Primeiros passos".
create or replace function private.jornada_regra(p_acao text)
returns table (glow integer, limite integer, pilar text, por_dia boolean)
language sql
immutable
set search_path = ''
as $$
  select r.glow, r.limite, r.pilar, r.por_dia
  from (values
    ('despesa',           5, 3, 'organizar', false),
    ('receita',           5, 3, 'organizar', false),
    ('planejar',          5, 1, 'organizar', true),
    ('guardar_meta',     15, 1, 'prosperar', false),
    ('comprovante_cofre',10, 3, 'proteger',  false),
    ('descanso',         10, 1, 'proteger',  true),
    ('dica_ajudou',       5, 5, 'conectar',  false),
    ('dica_protegeu',     5, 5, 'conectar',  false),
    ('atendimento',       0, 1, null,        true),
    ('abrir_jornada',     0, 1, null,        true)
  ) as r(acao, glow, limite, pilar, por_dia)
  where r.acao = p_acao;
$$;

-- §5: os 11 selos. `fonte` é o contador de vida inteira que decide o nível:
-- uma ação de jornada_acoes (contagem_total) ou uma chave de
-- jornada_contadores. n2/n3 nulos = selo de nível único.
--   dias_planejar      dias em que planejou (1 por dia)
--   dias_descanso      dias de descanso
--   semanas_firmes     semanas firmes (§3)
--   meses_na_jornada   meses com qualquer chamada à Jornada ("Mês a mês")
--   comeco_completo    1 quando ela completa os primeiros 7 dias de uso
--                      (7 dias com qualquer chamada): "Em casa"
--   anos_na_jornada    meses na Jornada / 12: "Um ano"
-- (as duas últimas são derivadas em private.jornada_total)
create or replace function private.jornada_selos_def()
returns table (selo text, pilar text, fonte text, n1 integer, n2 integer, n3 integer)
language sql
immutable
set search_path = ''
as $$
  select * from (values
    ('primeiros_passos', 'organizar', 'abrir_jornada',      1, null::integer, null::integer),
    ('planejadora',      'organizar', 'dias_planejar',      1, 10, 50),
    ('mao_amiga',        'conectar',  'dica_ajudou',        1, 25, 100),
    ('semana_firme',     'organizar', 'semanas_firmes',     1, 4, 12),
    ('rumo_a_meta',      'prosperar', 'guardar_meta',       1, 10, 50),
    ('tudo_guardado',    'proteger',  'comprovante_cofre',  1, 20, 100),
    ('descansar_conta',  'proteger',  'dias_descanso',      1, 8, 24),
    ('guardia',          'conectar',  'dica_protegeu',      5, 25, 100),
    ('em_casa',          'organizar', 'comeco_completo',    1, null, null),
    ('mes_a_mes',        'organizar', 'meses_na_jornada',   1, 3, 6),
    ('um_ano',           'organizar', 'anos_na_jornada',    1, null, null)
  ) as s(selo, pilar, fonte, n1, n2, n3);
$$;

-- §5: Glow de cada nível de selo.
create or replace function private.jornada_glow_nivel(p_nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_nivel when 1 then 20 when 2 then 30 when 3 then 50 else 0 end;
$$;

-- §6: as 3 missões de cada mês. `chave` é um contador do mês em
-- jornada_periodos ('dica_ajudou_ou_protegeu' soma os dois); `tipo` é o
-- nome da missão no contrato da J11 (TIPOS_MISSAO em lib/jornada/estado.ts).
create or replace function private.jornada_missoes(p_mes integer)
returns table (n integer, tipo text, chave text, alvo integer)
language sql
immutable
set search_path = ''
as $$
  select m.n, t.tipo, m.chave, m.alvo
  from (values
    (1, 1, 'planejar', 8), (1, 2, 'despesa', 10), (1, 3, 'descanso', 2),
    (2, 1, 'semanas_guardou', 3), (2, 2, 'comprovante_cofre', 4), (2, 3, 'dica_ajudou', 2),
    (3, 1, 'planejar', 6), (3, 2, 'dias_fortes', 10), (3, 3, 'comprovante_cofre', 3),
    (4, 1, 'semanas_guardou', 4), (4, 2, 'despesa', 12), (4, 3, 'descanso', 2),
    (5, 1, 'comprovante_cofre', 5), (5, 2, 'planejar', 8), (5, 3, 'dica_protegeu', 1),
    (6, 1, 'descanso', 3), (6, 2, 'semanas_guardou', 3), (6, 3, 'semanas_firmes', 2),
    (7, 1, 'despesa', 10), (7, 2, 'planejar', 6), (7, 3, 'dias_fortes', 12),
    (8, 1, 'semanas_guardou', 4), (8, 2, 'comprovante_cofre', 5), (8, 3, 'descanso', 2),
    (9, 1, 'planejar', 8), (9, 2, 'semanas_firmes', 3), (9, 3, 'dica_ajudou', 3),
    (10, 1, 'descanso', 3), (10, 2, 'despesa', 12), (10, 3, 'comprovante_cofre', 4),
    (11, 1, 'semanas_guardou', 4), (11, 2, 'planejar', 6), (11, 3, 'dias_fortes', 10),
    (12, 1, 'descanso', 3), (12, 2, 'semanas_guardou', 2), (12, 3, 'dica_ajudou_ou_protegeu', 2)
  ) as m(mes, n, chave, alvo)
  join (values
    ('planejar', 'planejar_dias'), ('despesa', 'lancar_despesas'),
    ('descanso', 'tirar_descansos'), ('semanas_guardou', 'guardar_semanas'),
    ('comprovante_cofre', 'comprovantes_cofre'), ('dias_fortes', 'dias_fortes'),
    ('semanas_firmes', 'semanas_firmes'), ('dica_ajudou', 'dica_ajudou'),
    ('dica_protegeu', 'dica_protegeu'),
    ('dica_ajudou_ou_protegeu', 'dica_ajudou_ou_protegeu')
  ) as t(chave, tipo) on t.chave = m.chave
  where m.mes = p_mes
  order by m.n;
$$;

-- §7: os marcos de dinheiro guardado.
create or replace function private.jornada_marcos_def()
returns setof integer
language sql
immutable
set search_path = ''
as $$
  select unnest(array[500, 1000, 2500, 5000]);
$$;

-- §4: o Glow em que começa o PRÓXIMO estágio (pra barra de progresso).
create or replace function public.jornada_proximo_estagio_em(glow integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when glow < 100 then 100
    when glow < 400 then 400
    when glow < 1200 then 1200
    when glow < 3000 then 3000
    else 3000 + ((glow - 3000) / 1500 + 1) * 1500
  end;
$$;

-- §4: o Glow em que começou o estágio atual (início da barra de progresso).
create or replace function public.jornada_inicio_do_estagio(glow integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when glow < 100 then 0
    when glow < 400 then 100
    when glow < 1200 then 400
    when glow < 3000 then 1200
    else 3000 + ((glow - 3000) / 1500) * 1500
  end;
$$;

-- ------------------------------------------------------------
-- Apoio
-- ------------------------------------------------------------

create or replace function private.jornada_fuso_valido(p_fuso text)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_fuso is null or p_fuso !~ '^[A-Za-z0-9_+\-]+(/[A-Za-z0-9_+\-]+)*$' then
    return false;
  end if;
  perform now() at time zone p_fuso;
  return true;
exception when others then
  return false;
end;
$$;

-- "UTC"/"GMT" é o que o cliente da J11 manda quando o aparelho não informa
-- o fuso: não é o fuso dela, é falta de fuso.
create or replace function private.jornada_fuso_generico(p_fuso text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select upper(coalesce(p_fuso, '')) in ('UTC', 'GMT', 'ETC/UTC', 'ETC/GMT', 'Z');
$$;

-- O dia de hoje no fuso dela (ver FUSO no topo). p_estrito: sem fuso
-- guardado, sem p_fuso válido e sem deslocamento, recusa em vez de UTC.
create or replace function private.jornada_hoje(
  p_user uuid,
  p_fuso text,
  p_deslocamento_min integer,
  p_estrito boolean
)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  v_fuso text;
begin
  select p.fuso into v_fuso from public.jornada_preferencias p where p.user_id = p_user;
  if not private.jornada_fuso_valido(v_fuso) then
    v_fuso := case
      when private.jornada_fuso_valido(p_fuso)
        and not (private.jornada_fuso_generico(p_fuso) and coalesce(p_deslocamento_min, 0) <> 0)
      then p_fuso
    end;
  end if;
  if v_fuso is not null then
    return (now() at time zone v_fuso)::date;
  end if;
  if p_deslocamento_min is not null then
    if p_deslocamento_min not between -840 and 840 then
      raise exception 'jornada: deslocamento de fuso inválido' using errcode = '22023';
    end if;
    return ((now() at time zone 'UTC') + make_interval(mins => p_deslocamento_min))::date;
  end if;
  if p_estrito then
    raise exception 'jornada: fuso ausente' using errcode = '22023';
  end if;
  return (now() at time zone 'UTC')::date;
end;
$$;

-- Contador de vida inteira de uma fonte de selo.
create or replace function private.jornada_total(p_user uuid, p_fonte text)
returns integer
language sql
stable
set search_path = ''
as $$
  select case p_fonte
    when 'comeco_completo' then (
      select case when count(*) > 0 then 1 else 0 end
      from public.jornada_acoes a
      where a.user_id = p_user and a.acao = 'dia_na_jornada' and a.contagem_total >= 7
    )
    when 'anos_na_jornada' then coalesce((
      select c.total / 12 from public.jornada_contadores c
      where c.user_id = p_user and c.chave = 'meses_na_jornada'
    ), 0)
    else coalesce(
    (select a.contagem_total from public.jornada_acoes a
      where a.user_id = p_user and a.acao = p_fonte),
    (select c.total from public.jornada_contadores c
      where c.user_id = p_user and c.chave = p_fonte),
    0
  ) end;
$$;

create or replace function private.jornada_somar_contador(p_user uuid, p_chave text, p_n integer)
returns void
language sql
set search_path = ''
as $$
  insert into public.jornada_contadores (user_id, chave, total)
  values (p_user, p_chave, p_n)
  on conflict (user_id, chave)
  do update set total = public.jornada_contadores.total + excluded.total;
$$;

-- Soma n a um contador do período CORRENTE de um tipo.
create or replace function private.jornada_somar_periodo(
  p_user uuid, p_tipo text, p_chave text, p_n integer
)
returns void
language sql
set search_path = ''
as $$
  update public.jornada_periodos
  set contadores = jsonb_set(
    contadores,
    array[p_chave],
    to_jsonb(coalesce((contadores ->> p_chave)::integer, 0) + p_n)
  )
  where user_id = p_user and tipo = p_tipo and not fechado;
$$;

-- Garante a linha do período corrente de um tipo. Se o período virou, a
-- linha corrente vira o retrato do último fechado (sobrescrevendo o
-- anterior) e a corrente recomeça com `p_inicial`. Devolve true se criou ou
-- virou. Relógio que volta (troca de fuso) não vira nada pra trás.
create or replace function private.jornada_garantir_periodo(
  p_user uuid, p_tipo text, p_inicio date, p_inicial jsonb
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_inicio date;
  v_contadores jsonb;
begin
  select p.inicio, p.contadores into v_inicio, v_contadores
  from public.jornada_periodos p
  where p.user_id = p_user and p.tipo = p_tipo and not p.fechado
  for update;

  if not found then
    insert into public.jornada_periodos (user_id, tipo, fechado, inicio, contadores)
    values (p_user, p_tipo, false, p_inicio, p_inicial);
    return true;
  end if;

  if v_inicio >= p_inicio then
    return false;
  end if;

  insert into public.jornada_periodos (user_id, tipo, fechado, inicio, contadores)
  values (p_user, p_tipo, true, v_inicio, v_contadores)
  on conflict (user_id, tipo, fechado)
  do update set inicio = excluded.inicio, contadores = excluded.contadores;

  update public.jornada_periodos
  set inicio = p_inicio, contadores = p_inicial
  where user_id = p_user and tipo = p_tipo and not fechado;
  return true;
end;
$$;

-- Glow no total e (se houver) no pilar.
create or replace function private.jornada_somar_glow(p_user uuid, p_pilar text, p_glow integer)
returns void
language sql
set search_path = ''
as $$
  update public.jornada_saldo
  set glow_total = glow_total + p_glow,
      glow_organizar = glow_organizar + case when p_pilar = 'organizar' then p_glow else 0 end,
      glow_prosperar = glow_prosperar + case when p_pilar = 'prosperar' then p_glow else 0 end,
      glow_proteger = glow_proteger + case when p_pilar = 'proteger' then p_glow else 0 end,
      glow_conectar = glow_conectar + case when p_pilar = 'conectar' then p_glow else 0 end
  where user_id = p_user;
$$;

-- Progresso de uma missão a partir dos contadores do mês.
create or replace function private.jornada_progresso(p_contadores jsonb, p_chave text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_chave = 'dica_ajudou_ou_protegeu' then
      coalesce((p_contadores ->> 'dica_ajudou')::integer, 0)
      + coalesce((p_contadores ->> 'dica_protegeu')::integer, 0)
    else coalesce((p_contadores ->> p_chave)::integer, 0)
  end;
$$;

-- ------------------------------------------------------------
-- O motor
-- ------------------------------------------------------------
-- Uma transação por ação (a da chamada). Ordem do ticket J10:
--   1. usuária já resolvida por quem chama (auth.uid() ou autora da dica)
--   2. contagem total da ação sobe SEMPRE
--   3. limite do dia: passou, não concede Glow (o passo 2 já aconteceu)
--   4. concedeu: Glow no total e no pilar
--   5. cascata: dia forte/semana firme, missões e capítulo, selos, meta e
--      marcos, estágio e itens destravados
--   6. fila ordenada
create or replace function private.jornada_aplicar(
  p_user uuid,
  p_acao text,
  p_hoje date,
  p_chave text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_regra record;
  v_def record;
  v_glow_antes integer;
  v_glow_depois integer;
  v_total integer;
  v_dia date;
  v_ganhos_hoje integer;
  v_chaves text[];
  v_contou boolean;
  v_glow_acao integer;
  v_semana date := p_hoje - (extract(isodow from p_hoje)::integer - 1);
  v_mes date := date_trunc('month', p_hoje)::date;
  v_ano date := date_trunc('year', p_hoje)::date;
  v_semana_conta_no_mes boolean;
  v_carrega jsonb;
  v_mes_antes jsonb;
  v_mes_depois jsonb;
  v_semana_c jsonb;
  v_fortes_hoje integer;
  v_nivel integer;
  v_nivel_antes integer;
  v_glow_selo integer;
  v_todas boolean := true;
  v_item record;
  v_fila jsonb;
  v_guardado numeric;
  v_marco integer;
  v_e0 integer;
  v_e1 integer;
  v_itens jsonb := '[]'::jsonb;
  f_pequena jsonb := '[]'::jsonb;
  f_selo jsonb := '[]'::jsonb;
  f_capitulo jsonb := '[]'::jsonb;
  f_estagio jsonb := '[]'::jsonb;
  f_marco jsonb := '[]'::jsonb;
  f_meta jsonb := '[]'::jsonb;
begin
  select * into v_regra from private.jornada_regra(p_acao);
  if not found then
    raise exception 'jornada: ação desconhecida' using errcode = '22023';
  end if;

  -- Trava da usuária: chamadas simultâneas dela rodam em fila.
  insert into public.jornada_saldo (user_id) values (p_user) on conflict do nothing;
  select s.glow_total into v_glow_antes
  from public.jornada_saldo s where s.user_id = p_user for update;

  -- Chamada repetida (mesma chave): não conta nada.
  select a.contagem_total, a.dia, a.ganhos_no_dia, a.chaves_recentes
  into v_total, v_dia, v_ganhos_hoje, v_chaves
  from public.jornada_acoes a
  where a.user_id = p_user and a.acao = p_acao
  for update;

  if p_chave is not null and p_chave = any (coalesce(v_chaves, '{}')) then
    return jsonb_build_object(
      'duplicada', true,
      'concedeu', false,
      'contou_no_dia', false,
      'glow_ganho', 0,
      'comemoracoes', '[]'::jsonb
    );
  end if;

  -- Períodos: semana (segunda), mês e ano do fuso dela. A semana vira
  -- antes do mês porque o mês novo herda a semana que atravessa a virada
  -- (§6: "conta para o mês em que ela termina").
  perform private.jornada_garantir_periodo(p_user, 'semana', v_semana, '{}'::jsonb);

  select coalesce(jsonb_object_agg(k, 1), '{}'::jsonb) into v_carrega
  from (
    select distinct k
    from public.jornada_periodos p,
      lateral (values
        (case when (p.contadores ->> 'guardou')::integer = 1 then 'semanas_guardou' end),
        (case when (p.contadores ->> 'firme')::integer = 1 then 'semanas_firmes' end)
      ) as x(k)
    where p.user_id = p_user and p.tipo = 'semana'
      and p.inicio < v_mes and p.inicio + 6 >= v_mes
      and k is not null
  ) as herdadas;

  if private.jornada_garantir_periodo(p_user, 'mes', v_mes, v_carrega) then
    perform private.jornada_somar_contador(p_user, 'meses_na_jornada', 1);
  end if;
  perform private.jornada_garantir_periodo(p_user, 'ano', v_ano, '{}'::jsonb);

  select p.contadores into v_mes_antes
  from public.jornada_periodos p
  where p.user_id = p_user and p.tipo = 'mes' and not p.fechado;

  -- Dia na Jornada (qualquer chamada, 1 por dia): "Em casa".
  insert into public.jornada_acoes (user_id, acao, contagem_total, dia, ganhos_no_dia)
  values (p_user, 'dia_na_jornada', 1, p_hoje, 1)
  on conflict (user_id, acao) do update
  set contagem_total = public.jornada_acoes.contagem_total + 1, dia = excluded.dia
  where public.jornada_acoes.dia is distinct from excluded.dia;

  -- 2 e 3: contagem total sempre; limite do dia.
  v_ganhos_hoje := case when v_dia = p_hoje then coalesce(v_ganhos_hoje, 0) else 0 end;
  v_contou := v_ganhos_hoje < v_regra.limite;
  v_glow_acao := case when v_contou then v_regra.glow else 0 end;

  insert into public.jornada_acoes
    (user_id, acao, contagem_total, dia, ganhos_no_dia, chaves_recentes)
  values (
    p_user, p_acao, 1, p_hoje, 1,
    case when p_chave is null then '{}'::text[] else array[p_chave] end
  )
  on conflict (user_id, acao) do update
  set contagem_total = public.jornada_acoes.contagem_total + 1,
      dia = p_hoje,
      ganhos_no_dia = v_ganhos_hoje + case when v_contou then 1 else 0 end,
      chaves_recentes = case
        when p_chave is null then public.jornada_acoes.chaves_recentes
        else (array_prepend(p_chave, public.jornada_acoes.chaves_recentes))[1:10]
      end;

  -- Contadores do período da ação. Ações por dia contam dias.
  if v_contou or not v_regra.por_dia then
    perform private.jornada_somar_periodo(p_user, t, p_acao, 1)
    from unnest(array['semana', 'mes', 'ano']) as t;
  end if;
  if v_regra.por_dia and v_contou then
    perform private.jornada_somar_contador(p_user, 'dias_' || p_acao, 1);
  end if;

  -- A pequena: toda ação com Glow (e o atendimento, "dia contado") gera
  -- uma. Acima do limite vem com glow 0 e ganhou false: "a contagem segue".
  if v_regra.glow > 0 or p_acao = 'atendimento' then
    f_pequena := jsonb_build_array(jsonb_build_object(
      'tipo', 'pequena', 'acao', p_acao, 'glow', v_glow_acao,
      'ganhou', v_contou, 'pilar', v_regra.pilar
    ));
  end if;

  -- 4: Glow da ação.
  if v_glow_acao > 0 then
    perform private.jornada_somar_glow(p_user, v_regra.pilar, v_glow_acao);

    -- Dia forte: a 3ª vez no dia em que uma ação deu Glow (atendimento e
    -- ações acima do limite não contam, §3).
    select coalesce(sum(a.ganhos_no_dia), 0) into v_fortes_hoje
    from public.jornada_acoes a
    cross join lateral private.jornada_regra(a.acao) r
    where a.user_id = p_user and a.dia = p_hoje and r.glow > 0;

    if v_fortes_hoje = 3 then
      perform private.jornada_somar_periodo(p_user, t, 'dias_fortes', 1)
      from unnest(array['semana', 'mes', 'ano']) as t;

      select p.contadores into v_semana_c
      from public.jornada_periodos p
      where p.user_id = p_user and p.tipo = 'semana' and not p.fechado;

      -- Semana firme: o 3º dia forte da semana.
      if (v_semana_c ->> 'dias_fortes')::integer = 3 then
        perform private.jornada_somar_contador(p_user, 'semanas_firmes', 1);
        perform private.jornada_somar_periodo(p_user, 'semana', 'firme', 1);
        perform private.jornada_somar_periodo(p_user, 'ano', 'semanas_firmes', 1);
        if date_trunc('month', v_semana + 6)::date = v_mes then
          perform private.jornada_somar_periodo(p_user, 'mes', 'semanas_firmes', 1);
        end if;
      end if;
    end if;
  end if;

  -- Semana com dinheiro guardado (§6), mesmo acima do limite de Glow. A
  -- semana que termina no mês seguinte fica pro mês seguinte (v_carrega).
  if p_acao = 'guardar_meta' then
    select p.contadores into v_semana_c
    from public.jornada_periodos p
    where p.user_id = p_user and p.tipo = 'semana' and not p.fechado;

    if coalesce((v_semana_c ->> 'guardou')::integer, 0) = 0 then
      perform private.jornada_somar_periodo(p_user, 'semana', 'guardou', 1);
      perform private.jornada_somar_periodo(p_user, 'ano', 'semanas_guardou', 1);
      v_semana_conta_no_mes := date_trunc('month', v_semana + 6)::date = v_mes;
      if v_semana_conta_no_mes then
        perform private.jornada_somar_periodo(p_user, 'mes', 'semanas_guardou', 1);
      end if;
    end if;
  end if;

  -- 5a: missões do capítulo do mês e fechamento.
  select p.contadores into v_mes_depois
  from public.jornada_periodos p
  where p.user_id = p_user and p.tipo = 'mes' and not p.fechado;

  for v_def in select * from private.jornada_missoes(extract(month from v_mes)::integer) loop
    -- Missão cumprida não vira comemoração própria (o contrato da J11 não
    -- tem esse tipo): o progresso aparece no estado; o capítulo comemora.
    if private.jornada_progresso(v_mes_depois, v_def.chave) < v_def.alvo then
      v_todas := false;
    end if;
  end loop;

  if v_todas and not exists (
    select 1 from public.jornada_colecao c
    where c.user_id = p_user
      and c.ano = extract(year from v_mes) and c.mes = extract(month from v_mes)
  ) then
    insert into public.jornada_colecao (user_id, ano, mes)
    values (p_user, extract(year from v_mes), extract(month from v_mes));
    perform private.jornada_somar_glow(p_user, null, 40);
    f_capitulo := jsonb_build_array(jsonb_build_object(
      'tipo', 'capitulo', 'glow', 40, 'ganhou', true,
      'capitulo', jsonb_build_object(
        'ano', extract(year from v_mes)::integer, 'mes', extract(month from v_mes)::integer)
    ));
  end if;

  -- 5b: selos (cada nível novo dá o Glow do nível, uma vez).
  for v_def in select * from private.jornada_selos_def() loop
    v_total := private.jornada_total(p_user, v_def.fonte);
    v_nivel := case
      when v_def.n3 is not null and v_total >= v_def.n3 then 3
      when v_def.n2 is not null and v_total >= v_def.n2 then 2
      when v_total >= v_def.n1 then 1
      else 0
    end;
    select s.nivel into v_nivel_antes
    from public.jornada_selos s where s.user_id = p_user and s.selo = v_def.selo;
    v_nivel_antes := coalesce(v_nivel_antes, 0);

    if v_nivel > v_nivel_antes then
      select coalesce(sum(private.jornada_glow_nivel(n)), 0) into v_glow_selo
      from generate_series(v_nivel_antes + 1, v_nivel) as n;

      insert into public.jornada_selos
        (user_id, selo, nivel, conquistado_ano, conquistado_mes)
      values (
        p_user, v_def.selo, v_nivel,
        extract(year from p_hoje), extract(month from p_hoje)
      )
      on conflict (user_id, selo) do update
      set nivel = excluded.nivel,
          conquistado_ano = excluded.conquistado_ano,
          conquistado_mes = excluded.conquistado_mes;

      perform private.jornada_somar_glow(p_user, v_def.pilar, v_glow_selo);
      f_selo := f_selo || jsonb_build_object(
        'tipo', 'selo', 'selo', v_def.selo, 'nivel', v_nivel,
        'glow', v_glow_selo, 'ganhou', true, 'pilar', v_def.pilar
      );
    end if;
  end loop;

  -- 5c: meta concluída e marcos de dinheiro (§7), fora do limite do dia.
  -- Os valores vêm da Wishlist dela (dinheiro de verdade), nunca do pedido:
  -- cada item que já bateu o alvo e ainda não foi premiado dá +100, uma vez.
  if p_acao = 'guardar_meta' then
    for v_item in
      select w.id from public.rede_wishlist_items w
      where w.user_id = p_user and w.valor_alvo > 0 and w.valor_atual >= w.valor_alvo
      order by w.criado_em, w.id
    loop
      insert into public.jornada_metas_premiadas (user_id, item_id)
      values (p_user, v_item.id)
      on conflict do nothing;
      if found then
        perform private.jornada_somar_glow(p_user, 'prosperar', 100);
        f_meta := f_meta || jsonb_build_object(
          'tipo', 'meta', 'glow', 100, 'ganhou', true, 'item_id', v_item.id
        );
      end if;
    end loop;

    select coalesce(sum(w.valor_atual), 0) into v_guardado
    from public.rede_wishlist_items w where w.user_id = p_user;

    for v_marco in select m from private.jornada_marcos_def() as m loop
      if v_guardado >= v_marco then
        insert into public.jornada_marcos (user_id, marco)
        values (p_user, v_marco)
        on conflict do nothing;
        if found then
          perform private.jornada_somar_glow(p_user, 'prosperar', 50);
          f_marco := f_marco || jsonb_build_object(
            'tipo', 'marco', 'marco', v_marco, 'glow', 50, 'ganhou', true
          );
        end if;
      end if;
    end loop;
  end if;

  -- 5d: estágio, depois de TODO o Glow da chamada. Itens destravados de
  -- cada estágio alcançado, nunca retirados (§4).
  select s.glow_total into v_glow_depois
  from public.jornada_saldo s where s.user_id = p_user;
  v_e0 := public.jornada_estagio_de(v_glow_antes);
  v_e1 := public.jornada_estagio_de(v_glow_depois);

  if v_e1 > v_e0 then
    with novos as (
      insert into public.jornada_destravados (user_id, item)
      select p_user, tipo || '_estagio_' || e
      from generate_series(v_e0 + 1, v_e1) as e,
        unnest(array['moldura', 'icone', 'tema']) as tipo
      on conflict do nothing
      returning item
    )
    select coalesce(jsonb_agg(item order by item), '[]'::jsonb) into v_itens from novos;

    f_estagio := jsonb_build_array(jsonb_build_object(
      'tipo', 'estagio', 'estagio', v_e1, 'de', v_e0, 'glow', 0, 'ganhou', true,
      'itens', v_itens
    ));
  end if;

  -- Glow do período (resumos).
  if v_glow_depois > v_glow_antes then
    perform private.jornada_somar_periodo(p_user, t, 'glow', v_glow_depois - v_glow_antes)
    from unnest(array['semana', 'mes', 'ano']) as t;
  end if;

  -- 6: a fila, na ordem do contrato, com id único por comemoração (a
  -- chave da chamada + a posição) e o adiamento: o que vem do atendimento,
  -- além da pequena, fica pra próxima abertura do app.
  select coalesce(jsonb_agg(
    x.item || jsonb_build_object(
      'id', coalesce(p_chave, gen_random_uuid()::text) || ':' || x.n,
      'adiada', p_acao = 'atendimento' and x.item ->> 'tipo' <> 'pequena'
    ) order by x.n), '[]'::jsonb)
  into v_fila
  from jsonb_array_elements(
    f_pequena || f_selo || f_estagio || f_capitulo || f_marco || f_meta
  ) with ordinality as x(item, n);

  return jsonb_build_object(
    'duplicada', false,
    'concedeu', v_glow_acao > 0,
    'contou_no_dia', v_contou,
    'glow_ganho', v_glow_depois - v_glow_antes,
    'comemoracoes', v_fila
  );
end;
$$;

-- ------------------------------------------------------------
-- O estado como as telas o recebem (contrato da J11, PR #187)
-- ------------------------------------------------------------
-- Formato de `EstadoJornada` (lib/jornada/estado.ts da J11), em camelCase.
-- Campos a mais que a J11 ainda não tipou (o validador dela ignora): hoje,
-- glowInicioEstagio, destravados e periodos (corrente + último fechado, pra
-- os resumos da J14). Só lê; se o período virou e ela ainda não agiu nele,
-- o corrente aparece zerado e o guardado aparece como o último fechado.
create or replace function private.jornada_estado_de(p_user uuid, p_hoje date)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_saldo record;
  v_glow integer;
  v_inicio jsonb;
  v_corrente jsonb := '{}'::jsonb;
  v_fechado jsonb := '{}'::jsonb;
  v_tipo text;
  v_row record;
  v_mes date := date_trunc('month', p_hoje)::date;
  v_mes_c jsonb;
  v_prefs record;
begin
  v_inicio := jsonb_build_object(
    'semana', p_hoje - (extract(isodow from p_hoje)::integer - 1),
    'mes', v_mes,
    'ano', date_trunc('year', p_hoje)::date
  );

  select s.glow_total, s.glow_organizar, s.glow_prosperar, s.glow_proteger, s.glow_conectar
  into v_saldo
  from public.jornada_saldo s where s.user_id = p_user;
  v_glow := coalesce(v_saldo.glow_total, 0);

  foreach v_tipo in array array['semana', 'mes', 'ano'] loop
    v_corrente := v_corrente || jsonb_build_object(v_tipo, jsonb_build_object(
      'inicio', v_inicio ->> v_tipo, 'contadores', '{}'::jsonb));
    for v_row in
      select p.fechado, p.inicio, p.contadores from public.jornada_periodos p
      where p.user_id = p_user and p.tipo = v_tipo
      order by p.fechado
    loop
      if not v_row.fechado and v_row.inicio::text = v_inicio ->> v_tipo then
        v_corrente := jsonb_set(v_corrente, array[v_tipo, 'contadores'], v_row.contadores);
      elsif not v_row.fechado and v_row.inicio::text < v_inicio ->> v_tipo then
        v_fechado := v_fechado || jsonb_build_object(v_tipo, jsonb_build_object(
          'inicio', v_row.inicio, 'contadores', v_row.contadores));
      elsif v_row.fechado and not v_fechado ? v_tipo then
        v_fechado := v_fechado || jsonb_build_object(v_tipo, jsonb_build_object(
          'inicio', v_row.inicio, 'contadores', v_row.contadores));
      end if;
    end loop;
  end loop;
  v_mes_c := v_corrente #> '{mes,contadores}';

  select p.som_ligado, p.modo_discreto, p.estagio_no_perfil, p.selos_no_perfil, p.jornada_comeco
  into v_prefs
  from public.jornada_preferencias p where p.user_id = p_user;

  return jsonb_build_object(
    'glowTotal', v_glow,
    'glowPorPilar', jsonb_build_object(
      'organizar', coalesce(v_saldo.glow_organizar, 0),
      'prosperar', coalesce(v_saldo.glow_prosperar, 0),
      'proteger', coalesce(v_saldo.glow_proteger, 0),
      'conectar', coalesce(v_saldo.glow_conectar, 0)
    ),
    'estagio', public.jornada_estagio_de(v_glow),
    'glowProximoEstagio', public.jornada_proximo_estagio_em(v_glow),
    'glowInicioEstagio', public.jornada_inicio_do_estagio(v_glow),
    'selos', (
      select coalesce(jsonb_object_agg(s.selo, s.nivel), '{}'::jsonb)
      from public.jornada_selos s where s.user_id = p_user
    ),
    'capitulo', jsonb_build_object(
      'ano', extract(year from v_mes)::integer,
      'mes', extract(month from v_mes)::integer,
      'fechado', exists (
        select 1 from public.jornada_colecao c
        where c.user_id = p_user
          and c.ano = extract(year from v_mes) and c.mes = extract(month from v_mes)
      ),
      'missoes', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'tipo', m.tipo,
          'alvo', m.alvo,
          'progresso', private.jornada_progresso(v_mes_c, m.chave)
        ) order by m.n), '[]'::jsonb)
        from private.jornada_missoes(extract(month from v_mes)::integer) m
      )
    ),
    'colecao', (
      select coalesce(jsonb_agg(jsonb_build_object('ano', c.ano, 'mes', c.mes)
        order by c.ano, c.mes), '[]'::jsonb)
      from public.jornada_colecao c where c.user_id = p_user
    ),
    'marcos', (
      select coalesce(jsonb_agg(m.marco order by m.marco), '[]'::jsonb)
      from public.jornada_marcos m where m.user_id = p_user
    ),
    'ajudou', private.jornada_total(p_user, 'dica_ajudou'),
    'protegeu', private.jornada_total(p_user, 'dica_protegeu'),
    'preferencias', jsonb_build_object(
      'somLigado', coalesce(v_prefs.som_ligado, true),
      'modoDiscreto', coalesce(v_prefs.modo_discreto, false),
      -- A J09 tem dois opt-ins (estágio, selos); a J11 expõe um só.
      'mostrarNoPerfil',
        coalesce(v_prefs.estagio_no_perfil, false) or coalesce(v_prefs.selos_no_perfil, false)
    ),
    'hoje', p_hoje,
    'destravados', (
      select coalesce(jsonb_agg(d.item order by d.item), '[]'::jsonb)
      from public.jornada_destravados d where d.user_id = p_user
    ),
    'periodos', jsonb_build_object('corrente', v_corrente, 'ultimoFechado', v_fechado)
  );
end;
$$;

-- ------------------------------------------------------------
-- A RPC central (cliente)
-- ------------------------------------------------------------
-- Contrato da J11 (#187): jornada_registrar(p_acao, p_chave, p_fuso,
-- p_deslocamento_min) -> { estado, comemoracoes }. As ações aceitas são
-- EXATAMENTE `ACOES` de lib/jornada/estado.ts (o teste de contrato trava as
-- duas listas juntas). "Isso me ajudou/protegeu" não está aqui: quem clica é
-- outra pessoa e o Glow é da autora (ver jornada_creditar_dica). Meta
-- concluída também não: é prêmio que o servidor decide sozinho, conferindo
-- a Wishlist a cada guardar_meta (§3, §7).
create or replace function public.jornada_registrar(
  p_acao text,
  p_chave text,
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
  v_r jsonb;
begin
  if v_uid is null then
    raise exception 'jornada: sem sessão' using errcode = '42501';
  end if;
  if p_acao is null or p_acao not in (
    'despesa', 'receita', 'planejar', 'guardar_meta', 'comprovante_cofre',
    'descanso', 'atendimento', 'abrir_jornada'
  ) then
    raise exception 'jornada: ação não permitida' using errcode = '22023';
  end if;
  if p_chave is null or p_chave !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'jornada: chave da chamada inválida' using errcode = '22023';
  end if;

  -- Guarda o fuso do aparelho na primeira vez (nunca sobrescreve). Um "UTC"
  -- genérico não é guardado: é o que o cliente manda quando não sabe.
  if private.jornada_fuso_valido(p_fuso) and not private.jornada_fuso_generico(p_fuso) then
    insert into public.jornada_preferencias (user_id, fuso)
    values (v_uid, p_fuso)
    on conflict (user_id) do update
    set fuso = excluded.fuso
    where public.jornada_preferencias.fuso is null;
  end if;

  v_hoje := private.jornada_hoje(v_uid, p_fuso, p_deslocamento_min, true);
  v_r := private.jornada_aplicar(v_uid, p_acao, v_hoje, p_chave);
  return jsonb_build_object(
    'estado', private.jornada_estado_de(v_uid, v_hoje),
    'comemoracoes', v_r -> 'comemoracoes',
    'duplicada', v_r -> 'duplicada'
  );
end;
$$;

-- ------------------------------------------------------------
-- Crédito de dica ("Isso me ajudou" / "Isso me protegeu")
-- ------------------------------------------------------------
-- O Glow e o contador são da AUTORA da dica (§3, §5), sem nenhuma
-- identidade de quem clicou (§8). A Rede ainda não tem esses botões; esta
-- função fica pronta pra o gatilho AFTER INSERT da futura tabela de
-- reações chamar, uma vez por reação nova (a chave primária da reação é
-- que impede contar duas vezes). Nunca exposta ao cliente.
create or replace function private.jornada_creditar_dica(p_post uuid, p_tipo text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_autora uuid;
begin
  if p_tipo not in ('dica_ajudou', 'dica_protegeu') then
    raise exception 'jornada: tipo de dica inválido' using errcode = '22023';
  end if;
  select p.autor_id into v_autora
  from public.rede_posts p
  where p.id = p_post and p.categoria = 'dica';
  if v_autora is null then
    return null;
  end if;
  return private.jornada_aplicar(
    v_autora, p_tipo, private.jornada_hoje(v_autora, null, null, false), null
  );
end;
$$;

-- ------------------------------------------------------------
-- Leitura (as telas)
-- ------------------------------------------------------------
create or replace function public.jornada_estado(
  p_fuso text default null,
  p_deslocamento_min integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'jornada: sem sessão' using errcode = '42501';
  end if;
  return private.jornada_estado_de(
    v_uid, private.jornada_hoje(v_uid, p_fuso, p_deslocamento_min, false)
  );
end;
$$;

-- ------------------------------------------------------------
-- Permissões
-- ------------------------------------------------------------
-- O motor e as regras são internos: ninguém chama direto (as funções
-- SECURITY DEFINER acima rodam como dona e chamam por dentro). O revoke
-- nomeia anon/authenticated/service_role porque o Supabase concede EXECUTE
-- a elas explicitamente em toda função nova (ver 0032).
revoke all on function private.jornada_regra(text)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_selos_def()
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_glow_nivel(integer)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_missoes(integer)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_marcos_def()
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_fuso_valido(text)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_fuso_generico(text)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_hoje(uuid, text, integer, boolean)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_total(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_somar_contador(uuid, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_somar_periodo(uuid, text, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_garantir_periodo(uuid, text, date, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_somar_glow(uuid, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_progresso(jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_aplicar(uuid, text, date, text)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_creditar_dica(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_estado_de(uuid, date)
  from public, anon, authenticated, service_role;

revoke all on function public.jornada_registrar(text, text, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.jornada_estado(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.jornada_proximo_estagio_em(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.jornada_inicio_do_estagio(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.jornada_registrar(text, text, text, integer)
  to authenticated;
grant execute on function public.jornada_estado(text, integer)
  to authenticated;
grant execute on function public.jornada_proximo_estagio_em(integer)
  to authenticated, service_role;
grant execute on function public.jornada_inicio_do_estagio(integer)
  to authenticated, service_role;
