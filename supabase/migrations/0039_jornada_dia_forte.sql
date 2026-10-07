-- 0039 — "Sua Jornada": o dia forte como o protótipo (ordem do operador).
--
-- SÓ ESCRITA: esta migration não é aplicada por esta PR (nem em produção).
--
-- O protótipo aprovado (docs/jornada/referencias/prototipo-sua-jornada.html,
-- `act()`) marca o dia como forte na PRIMEIRA ação do dia que cuida do
-- negócio -- lançar, planejar, guardar, comprovante e o atendimento ("Dia
-- contado") --, mesmo acima do limite de Glow; descanso marca descanso e
-- não desfaz um dia forte. A 0035/0036 pediam 3 ações com Glow no dia (e
-- não contavam o atendimento): a bolinha da semana, o "N de 3 dias fortes",
-- a missão "Ter 12 dias fortes" e a semana firme saíam diferentes da
-- referência. O operador mandou ficar idêntico (spec §3 e §11).
--
-- Numeração: 0037 e 0038 ficam com a #209 (jobs.pago_em, feitasHoje).
--
-- Privacidade (revisão da #208): as marcas de semanas anteriores saem
-- também quando ela só ABRE a Jornada (public.jornada_estado), não só quando
-- registra uma ação; a leitura passa a ser volatile por isso.
--
-- Só muda private.jornada_aplicar e public.jornada_estado (a mesma da 0036 com o bloco do dia forte
-- trocado). Nada de tabela, coluna nem permissão nova.

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
  v_virou_forte integer;
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
  end if;

  -- Dia forte (§3, como o protótipo, ordem do operador): o dia vira forte
  -- na PRIMEIRA ação do dia que cuida do negócio -- lançar, planejar,
  -- guardar, comprovante, atendimento --, mesmo acima do limite de Glow.
  -- Descanso, abrir a Jornada, PIN e resumo não. Conta uma vez, na hora em
  -- que vira (um dia de descanso que vira forte conta).
  if p_acao in ('despesa', 'receita', 'planejar', 'guardar_meta',
                'comprovante_cofre', 'atendimento') then
    v_virou_forte := null;
    insert into public.jornada_semana_dias as d (user_id, dia, marca)
    values (p_user, p_hoje, 'forte')
    on conflict (user_id, dia) do update set marca = 'forte'
      where d.marca <> 'forte'
    returning 1 into v_virou_forte;

    if v_virou_forte is not null then
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

revoke all on function private.jornada_aplicar(uuid, text, date, text)
  from public, anon, authenticated, service_role;

-- A leitura do estado também apaga as marcas de semanas anteriores (só as
-- da própria usuária, achada por auth.uid()).
create or replace function public.jornada_estado(
  p_fuso text default null,
  p_deslocamento_min integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hoje date;
begin
  if v_uid is null then
    raise exception 'jornada: sem sessão' using errcode = '42501';
  end if;
  v_hoje := private.jornada_hoje(v_uid, p_fuso, p_deslocamento_min, false);
  delete from public.jornada_semana_dias d
  where d.user_id = v_uid
    and d.dia < v_hoje - (extract(isodow from v_hoje)::integer - 1);
  return private.jornada_estado_de(v_uid, v_hoje);
end;
$$;

revoke all on function public.jornada_estado(text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.jornada_estado(text, integer)
  to authenticated;
