-- ============================================================
-- Sua Jornada (0036): o que o protótipo aprovado mostra e o servidor
-- ainda não mandava.
-- ============================================================
-- ORDEM DO OPERADOR (PR #208 / agent/w1-jornada-dados): a tela, os resumos
-- e as comemorações têm de ser IDÊNTICOS ao protótipo aprovado
-- (docs/jornada/referencias/prototipo-sua-jornada.html), com os números
-- vindos do servidor de verdade. Onde a spec e o protótipo divergiam, vale
-- o protótipo; a spec foi atualizada junto (docs/jornada/spec-sua-jornada.md).
--
-- O que muda:
--   1. Ritmo da semana: uma marca por dia (forte | descanso) SÓ da semana
--      corrente, em jornada_semana_dias. Nada do que foi feito no dia, só a
--      marca; as da semana anterior saem na primeira chamada da semana
--      nova. Revê a decisão 16 da spec por ordem do operador.
--   2. Missões do mês: as 3 trincas do protótipo (mês % 3), no lugar das 12.
--   3. Prêmios de uma vez (capítulo, meta, marco) num lugar só:
--      private.jornada_premio.
--   4. O estado (jornada_estado / jornada_registrar) passa a mandar: a
--      semana (marcas), o Glow de cada ação (tabela "O que dá Glow"), os
--      prêmios, o progresso de cada selo (contador e corte do próximo
--      nível), o dinheiro (meta atual da Wishlist, total guardado, metas
--      concluídas), a porcentagem de cada pilar (regra do protótipo), as
--      preferências da folha de Ajustes e os 7 passos da Jornada de Começo.
--   5. A comemoração "meta" leva o nome e o valor da meta e a próxima.
--   6. Duas ações sem Glow pra Jornada de Começo: criar_pin, ver_resumo.
--   7. Preferência nova: comemoracoes_calmas.
--
-- Só escrita: não aplicada em nenhum banco.
-- ============================================================

-- 7. Preferência "Comemorações: Calma" (folha de Ajustes do protótipo).
alter table public.jornada_preferencias
  add column if not exists comemoracoes_calmas boolean not null default false;
-- Jornada de Começo: opcional, desligada por padrão (protótipo).
alter table public.jornada_preferencias
  alter column jornada_comeco set default false;

-- 1. A marca de cada dia da semana corrente.
create table if not exists public.jornada_semana_dias (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  marca text not null check (marca in ('forte', 'descanso')),
  primary key (user_id, dia)
);

alter table public.jornada_semana_dias enable row level security;
revoke all on table public.jornada_semana_dias from anon, authenticated, service_role;
grant select on table public.jornada_semana_dias to authenticated;
grant select, insert, update, delete on table public.jornada_semana_dias to service_role;

drop policy if exists "jornada_semana_dias: owner select" on public.jornada_semana_dias;
create policy "jornada_semana_dias: owner select"
  on public.jornada_semana_dias for select to authenticated
  using (auth.uid() = user_id);

-- 3. Prêmios de uma vez (spec §3).
create or replace function private.jornada_premio(p_chave text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_chave
    when 'capitulo' then 40
    when 'meta' then 100
    when 'marco' then 50
    else 0
  end;
$$;

-- 4. Porcentagem de cada pilar (regra do protótipo: cada Glow do pilar
--    soma 1/160; no Conectar, cada dica (5 Glow) soma 4%, ou seja 1/125),
--    até 100%.
create or replace function private.jornada_pilar_pct(p_glow integer, p_pilar text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select least(100, round(
    greatest(p_glow, 0) * 100.0 / case p_pilar when 'conectar' then 125 else 160 end
  ))::integer;
$$;

-- 2. As 3 trincas do protótipo (CH_SETS), pelo mês: janeiro, abril, julho e
--    outubro usam a 1ª; fevereiro, maio, agosto e novembro a 2ª; março,
--    junho, setembro e dezembro a 3ª.
create or replace function private.jornada_missoes(p_mes integer)
returns table (n integer, tipo text, chave text, alvo integer)
language sql
immutable
set search_path = ''
as $$
  select m.n, t.tipo, m.chave, m.alvo
  from (values
    (0, 1, 'planejar', 8), (0, 2, 'semanas_guardou', 3), (0, 3, 'descanso', 2),
    (1, 1, 'comprovante_cofre', 4), (1, 2, 'despesa', 10), (1, 3, 'dias_fortes', 12),
    (2, 1, 'semanas_guardou', 4), (2, 2, 'planejar', 6), (2, 3, 'dica_ajudou', 3)
  ) as m(trinca, n, chave, alvo)
  join (values
    ('planejar', 'planejar_dias'), ('despesa', 'lancar_despesas'),
    ('descanso', 'tirar_descansos'), ('semanas_guardou', 'guardar_semanas'),
    ('comprovante_cofre', 'comprovantes_cofre'), ('dias_fortes', 'dias_fortes'),
    ('dica_ajudou', 'dica_ajudou')
  ) as t(chave, tipo) on t.chave = m.chave
  where m.trinca = (p_mes - 1) % 3
  order by m.n;
$$;

-- 6. As ações (com as duas da Jornada de Começo).
-- Chaves de ação da §3 novas (0036, Jornada de Começo, sem Glow):
--   'criar_pin', 'ver_resumo'
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
    ('abrir_jornada',     0, 1, null,        true),
    -- Jornada de Começo (0036): só contam o passo, sem Glow.
    ('criar_pin',         0, 1, null,        true),
    ('ver_resumo',        0, 1, null,        true)
  ) as r(acao, glow, limite, pilar, por_dia)
  where r.acao = p_acao;
$$;

-- 1, 3 e 5: o motor, com a marca do dia e os prêmios da regra.
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

  -- A marca de cada dia é só da semana corrente: a semana virou, as marcas
  -- da anterior saem (nada de diário, §8).
  delete from public.jornada_semana_dias d
  where d.user_id = p_user and d.dia < v_semana;

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

  -- Dia de descanso: a marca do dia na semana (um dia forte continua forte).
  if p_acao = 'descanso' then
    insert into public.jornada_semana_dias (user_id, dia, marca)
    values (p_user, p_hoje, 'descanso')
    on conflict (user_id, dia) do nothing;
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

      insert into public.jornada_semana_dias (user_id, dia, marca)
      values (p_user, p_hoje, 'forte')
      on conflict (user_id, dia) do update set marca = 'forte';

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
    perform private.jornada_somar_glow(p_user, null, private.jornada_premio('capitulo'));
    f_capitulo := jsonb_build_array(jsonb_build_object(
      'tipo', 'capitulo', 'glow', private.jornada_premio('capitulo'), 'ganhou', true,
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
      select w.id, w.nome, w.valor_alvo from public.rede_wishlist_items w
      where w.user_id = p_user and w.valor_alvo > 0 and w.valor_atual >= w.valor_alvo
      order by w.criado_em, w.id
    loop
      insert into public.jornada_metas_premiadas (user_id, item_id)
      values (p_user, v_item.id)
      on conflict do nothing;
      if found then
        perform private.jornada_somar_glow(p_user, 'prosperar', private.jornada_premio('meta'));
        -- O nome e o valor da meta concluída e a próxima (a mais antiga
        -- ainda em aberto), como a comemoração do protótipo mostra.
        f_meta := f_meta || jsonb_build_object(
          'tipo', 'meta', 'glow', private.jornada_premio('meta'), 'ganhou', true,
          'item_id', v_item.id, 'nome', v_item.nome, 'valor', v_item.valor_alvo,
          'proxima', (
            select w2.nome from public.rede_wishlist_items w2
            where w2.user_id = p_user and w2.valor_alvo > 0
              and w2.valor_atual < w2.valor_alvo
            order by w2.criado_em, w2.id
            limit 1
          )
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
          perform private.jornada_somar_glow(p_user, 'prosperar', private.jornada_premio('marco'));
          f_marco := f_marco || jsonb_build_object(
            'tipo', 'marco', 'marco', v_marco, 'glow', private.jornada_premio('marco'), 'ganhou', true
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

-- 4: o estado com tudo o que o protótipo mostra.
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
  v_semana date := p_hoje - (extract(isodow from p_hoje)::integer - 1);
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

  select p.som_ligado, p.modo_discreto, p.estagio_no_perfil, p.selos_no_perfil,
    p.jornada_comeco, p.comemoracoes_calmas
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
      'mostrarNoPerfil',
        coalesce(v_prefs.estagio_no_perfil, false) or coalesce(v_prefs.selos_no_perfil, false),
      -- Ajustes do protótipo (ordem do operador, 0036).
      'estagioNoPerfil', coalesce(v_prefs.estagio_no_perfil, false),
      'selosNoPerfil', coalesce(v_prefs.selos_no_perfil, false),
      'comemoracoesCalmas', coalesce(v_prefs.comemoracoes_calmas, false),
      'jornadaComeco', coalesce(v_prefs.jornada_comeco, false)
    ),
    -- Ritmo da semana: a marca de cada dia (segunda a domingo) da semana
    -- CORRENTE, e só ela (forte, descanso ou nada).
    'semana', jsonb_build_object('dias', (
      select jsonb_agg(d.marca order by g.n)
      from generate_series(0, 6) as g(n)
      left join public.jornada_semana_dias d
        on d.user_id = p_user and d.dia = v_semana + g.n
    )),
    -- O que dá Glow (a tabela do protótipo), da regra: Glow, limite do dia
    -- e pilar de cada ação; e os prêmios de uma vez.
    'glowPorAcao', (
      select jsonb_object_agg(a.acao, jsonb_build_object(
        'glow', r.glow, 'limite', r.limite, 'pilar', r.pilar))
      from unnest(array['planejar', 'despesa', 'receita', 'guardar_meta',
        'comprovante_cofre', 'descanso', 'dica_ajudou', 'dica_protegeu']) as a(acao)
      cross join lateral private.jornada_regra(a.acao) r
    ),
    'premios', jsonb_build_object(
      'capitulo', private.jornada_premio('capitulo'),
      'meta', private.jornada_premio('meta'),
      'marco', private.jornada_premio('marco'),
      'seloNivel', jsonb_build_array(
        private.jornada_glow_nivel(1), private.jornada_glow_nivel(2),
        private.jornada_glow_nivel(3))
    ),
    -- Cada selo: o contador dele e o corte do próximo nível (null = já no
    -- nível máximo). O "3/10" do protótipo.
    'selosProgresso', (
      select jsonb_object_agg(d.selo, jsonb_build_object(
        'contador', private.jornada_total(p_user, d.fonte),
        'proximo', case coalesce(s.nivel, 0)
          when 0 then d.n1 when 1 then d.n2 when 2 then d.n3 else null end))
      from private.jornada_selos_def() d
      left join public.jornada_selos s on s.user_id = p_user and s.selo = d.selo
    ),
    -- Seu dinheiro: a meta atual (a mais antiga ainda em aberto da
    -- Wishlist dela), o total guardado e quantas metas já foram concluídas.
    'dinheiro', jsonb_build_object(
      'meta', (
        select jsonb_build_object('nome', w.nome, 'alvo', w.valor_alvo, 'atual', w.valor_atual)
        from public.rede_wishlist_items w
        where w.user_id = p_user and w.valor_alvo > 0 and w.valor_atual < w.valor_alvo
        order by w.criado_em, w.id
        limit 1
      ),
      'totalGuardado', coalesce((
        select sum(w.valor_atual) from public.rede_wishlist_items w where w.user_id = p_user
      ), 0),
      'metasConcluidas', (
        select count(*) from public.rede_wishlist_items w
        where w.user_id = p_user and w.valor_alvo > 0 and w.valor_atual >= w.valor_alvo
      )
    ),
    -- Seus 4 pilares: a porcentagem de cada um (regra do protótipo).
    'pilares', jsonb_build_object(
      'organizar', private.jornada_pilar_pct(coalesce(v_saldo.glow_organizar, 0), 'organizar'),
      'prosperar', private.jornada_pilar_pct(coalesce(v_saldo.glow_prosperar, 0), 'prosperar'),
      'proteger', private.jornada_pilar_pct(coalesce(v_saldo.glow_proteger, 0), 'proteger'),
      'conectar', private.jornada_pilar_pct(coalesce(v_saldo.glow_conectar, 0), 'conectar')
    ),
    -- Jornada de Começo: os 7 passos do protótipo, feitos ou não, lidos do
    -- que ela já fez (nenhum registro novo de "quando").
    'comeco', jsonb_build_object('passos', jsonb_build_array(
      private.jornada_total(p_user, 'criar_pin') > 0,
      exists (select 1 from public.rede_wishlist_items w where w.user_id = p_user),
      private.jornada_total(p_user, 'planejar') > 0,
      private.jornada_total(p_user, 'comprovante_cofre') > 0,
      exists (select 1 from public.rede_posts r where r.autor_id = p_user),
      private.jornada_total(p_user, 'descanso') > 0,
      private.jornada_total(p_user, 'ver_resumo') > 0
    )),
    'hoje', p_hoje,
    'destravados', (
      select coalesce(jsonb_agg(d.item order by d.item), '[]'::jsonb)
      from public.jornada_destravados d where d.user_id = p_user
    ),
    'periodos', jsonb_build_object('corrente', v_corrente, 'ultimoFechado', v_fechado)
  );
end;
$$;

-- 6: a RPC aceita as duas ações novas.
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
    'descanso', 'atendimento', 'abrir_jornada', 'criar_pin', 'ver_resumo'
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

-- Permissões das funções novas (o mesmo das da 0035: ninguém chama direto).
revoke all on function private.jornada_premio(text)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_pilar_pct(integer, text)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_missoes(integer)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_regra(text)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_aplicar(uuid, text, date, text)
  from public, anon, authenticated, service_role;
revoke all on function private.jornada_estado_de(uuid, date)
  from public, anon, authenticated, service_role;
revoke all on function public.jornada_registrar(text, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.jornada_registrar(text, text, text, integer)
  to authenticated;
