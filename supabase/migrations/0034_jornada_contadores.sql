-- ============================================================
-- JobApp Jornada - Migration 0034: armazenamento da "Sua Jornada"
-- ============================================================
-- Ticket J09 (#159). Spec: docs/jornada/spec-sua-jornada.md (final, PR
-- #186). Onde o ticket e a spec discordam, a spec vence (spec, topo). As
-- referências "§N" abaixo são seções da spec.
--
-- A REGRA QUE MANDA EM TUDO AQUI (§1.16, §8): só contadores, estado e
-- conquistas. Nunca um diário. Nenhuma linha por ação com data e hora,
-- nenhuma lista do que ela fez em cada dia, nenhum histórico de dias
-- passados além dos agregados que a §8 permite:
--   - o limite diário (§3) guarda, por ação, SÓ a data do dia corrente e
--     quantas vezes deu Glow nele; na virada o servidor sobrescreve;
--   - os períodos (semana, mês, ano) guardam o agregado do período
--     corrente e UM retrato agregado do último período fechado de cada
--     tipo; o retrato anterior é sobrescrito;
--   - as únicas outras marcas de tempo são mês/ano (coleção, conquista de
--     selo), nunca um dia.
--
-- QUEM ESCREVE (§8, "Onde a decisão acontece"): o servidor decide tudo. Os
-- contadores só são escritos pelas RPCs SECURITY DEFINER da J10 (e pelo
-- service_role). A usuária só LÊ as próprias linhas e escreve direto só as
-- próprias preferências -- se o cliente pudesse escrever o próprio Glow,
-- dava pra mentir (J10, "Por que no servidor").
--
-- QUEM LÊ: só a dona. A única exceção é o opt-in de perfil público (§1.11,
-- desligado por padrão): os selos (política separada e explícita em
-- jornada_selos) e o estágio (função separada e explícita,
-- jornada_estagio_publico, porque o estágio não é guardado: é calculado do
-- Glow total, §4, e o Glow total nunca é legível por outra pessoa). Só
-- membros da Rede, nunca entre duas pessoas com bloqueio.
--
-- Aditiva: nenhuma tabela ou coluna existente é alterada.

-- ------------------------------------------------------------
-- Validação usada pelas tabelas
-- ------------------------------------------------------------
-- Os contadores de período são só números (usada no check de
-- jornada_periodos, por isso vem antes das tabelas).
create or replace function public.jornada_so_contadores(mapa jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select not exists (
    select 1
    from jsonb_each(mapa) as e(chave, valor)
    where jsonb_typeof(e.valor) <> 'number'
       or e.chave !~ '^[a-z][a-z0-9_]{0,47}$'
  );
$$;

-- ------------------------------------------------------------
-- Tabelas
-- ------------------------------------------------------------

-- Glow total e Glow por pilar (§8: "4 números" + total). Uma linha por
-- usuária. Nunca diminui (§1.5: nada zera). O estágio NÃO é guardado:
-- sai de glow_total por public.jornada_estagio_de (abaixo).
create table if not exists public.jornada_saldo (
  user_id uuid primary key references auth.users(id) on delete cascade,
  glow_total integer not null default 0 check (glow_total >= 0),
  glow_organizar integer not null default 0 check (glow_organizar >= 0),
  glow_prosperar integer not null default 0 check (glow_prosperar >= 0),
  glow_proteger integer not null default 0 check (glow_proteger >= 0),
  glow_conectar integer not null default 0 check (glow_conectar >= 0)
);

-- Por ação (§3): contador de vida inteira + o limite do dia corrente.
--   contagem_total     sobe SEMPRE, mesmo acima do limite (§3: "a ação
--                      registra normal (o contador sobe)").
--   dia, ganhos_no_dia o limite diário: o dia corrente (no fuso dela, §2)
--                      e quantas vezes a ação deu Glow nele. Na virada,
--                      o RPC sobrescreve com o novo dia e 1. O dia anterior
--                      não fica guardado (§8).
-- Chaves de ação da §3 (a lista e os valores ficam nas RPCs da J10):
-- 'despesa', 'receita', 'planejar', 'guardar_meta', 'comprovante_cofre',
-- 'descanso', 'dica_ajudou', 'dica_protegeu', 'atendimento'.
create table if not exists public.jornada_acoes (
  user_id uuid not null references auth.users(id) on delete cascade,
  acao text not null check (acao ~ '^[a-z][a-z0-9_]{0,47}$'),
  contagem_total integer not null default 0 check (contagem_total >= 0),
  dia date,
  ganhos_no_dia integer not null default 0 check (ganhos_no_dia >= 0),
  primary key (user_id, acao),
  -- Sem dia corrente, não há ganho no dia; com dia, houve pelo menos um.
  constraint jornada_acoes_limite_coerente check (
    (dia is null and ganhos_no_dia = 0)
    or (dia is not null and ganhos_no_dia >= 1)
  )
);

-- Contadores de vida inteira que não são uma ação (§8: "contadores de vida
-- inteira ... por selo", os que alimentam a §5): semanas firmes, meses na
-- Jornada, dias ativos (atendimento, §8), metas concluídas, passos da
-- Jornada de Começo etc. Só o número, nunca quando.
create table if not exists public.jornada_contadores (
  user_id uuid not null references auth.users(id) on delete cascade,
  chave text not null check (chave ~ '^[a-z][a-z0-9_]{0,47}$'),
  total integer not null default 0 check (total >= 0),
  primary key (user_id, chave)
);

-- Períodos (§8): os agregados do período CORRENTE de cada tipo e UM retrato
-- agregado do último período FECHADO de cada tipo -- no máximo 6 linhas por
-- usuária (3 tipos x corrente/fechado), sempre sobrescritas. Alimentam as
-- missões do mês (§6: "o progresso conta só o que aconteceu dentro do mês,
-- pelos contadores do mês") e os resumos (§1.9). `contadores` é um mapa
-- chave -> número ("despesa": 12, "dias_fortes": 4, "glow": 85...), nunca
-- uma lista de dias. `inicio` é o primeiro dia do período (segunda-feira,
-- dia 1 do mês, 1/jan), no fuso dela, pra o RPC saber quando virou.
create table if not exists public.jornada_periodos (
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('semana', 'mes', 'ano')),
  fechado boolean not null,
  inicio date not null,
  contadores jsonb not null default '{}'::jsonb,
  primary key (user_id, tipo, fechado),
  -- Só número em cada chave: nenhuma data, lista ou texto livre.
  constraint jornada_periodos_so_numeros check (
    jsonb_typeof(contadores) = 'object'
    and public.jornada_so_contadores(contadores)
  )
);

-- Selos (§5): nível atual de cada um (1 a 3) e o mês/ano em que esse nível
-- foi conquistado (§8: "quando ele foi conquistado (mês/ano, para a
-- coleção)"). Nunca o dia.
create table if not exists public.jornada_selos (
  user_id uuid not null references auth.users(id) on delete cascade,
  selo text not null check (selo ~ '^[a-z][a-z0-9_]{0,47}$'),
  nivel smallint not null check (nivel between 1 and 3),
  conquistado_ano smallint not null check (conquistado_ano between 2000 and 2999),
  conquistado_mes smallint not null check (conquistado_mes between 1 and 12),
  primary key (user_id, selo)
);

-- Coleção (§6, §8: "capítulos fechados (mês/ano -> enfeite)"): os meses em
-- que o capítulo fechou. Mês não fechado não tem linha -- "fica em branco
-- e nada é tirado". A linha do mês corrente também é o "já fechou", pra o
-- RPC não dar o +40 duas vezes.
create table if not exists public.jornada_colecao (
  user_id uuid not null references auth.users(id) on delete cascade,
  ano smallint not null check (ano between 2000 and 2999),
  mes smallint not null check (mes between 1 and 12),
  primary key (user_id, ano, mes)
);

-- Marcos de dinheiro alcançados (§7): quais dos 4. Cada um conta UMA vez na
-- vida e nunca é retirado -- se o saldo cair e subir de novo, a linha já
-- existe e não dá Glow outra vez. Nunca quando nem o valor guardado.
create table if not exists public.jornada_marcos (
  user_id uuid not null references auth.users(id) on delete cascade,
  marco integer not null check (marco in (500, 1000, 2500, 5000)),
  primary key (user_id, marco)
);

-- Itens destravados por estágio (§1.13, §4, §8): moldura, ícone, variação
-- de tema. Nunca retirados.
create table if not exists public.jornada_destravados (
  user_id uuid not null references auth.users(id) on delete cascade,
  item text not null check (item ~ '^[a-z][a-z0-9_]{0,63}$'),
  primary key (user_id, item)
);

-- Preferências (§1.10, §1.11, §1.15, §8): som ligado por padrão; Modo
-- discreto desligado; estágio e selos no perfil público DESLIGADOS por
-- padrão (opt-in); Jornada de Começo; e o fuso dela (§2), nome IANA
-- (ex.: 'Europe/Lisbon'), validado pelas RPCs. Sem fuso, a J10 usa o
-- deslocamento que o cliente mandar (J10, regras).
create table if not exists public.jornada_preferencias (
  user_id uuid primary key references auth.users(id) on delete cascade,
  som_ligado boolean not null default true,
  modo_discreto boolean not null default false,
  estagio_no_perfil boolean not null default false,
  selos_no_perfil boolean not null default false,
  jornada_comeco boolean not null default true,
  fuso text check (fuso is null or fuso ~ '^[A-Za-z0-9_+\-]+(/[A-Za-z0-9_+\-]+)*$')
);

-- ------------------------------------------------------------
-- Funções de apoio
-- ------------------------------------------------------------
create schema if not exists private;

-- Estágio a partir do Glow total (§4): 0 Começando, 1 Em movimento,
-- 2 Organizada, 3 Prosperando, 4 Icônica, 5 Icônica II, 6 Icônica III...
-- (Icônica N a partir de 3000 + (N - 1) x 1500). Pura, usada pelas RPCs da
-- J10 e pelo perfil público; é a única definição dos cortes no banco.
create or replace function public.jornada_estagio_de(glow integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when glow >= 3000 then 4 + (glow - 3000) / 1500
    when glow >= 1200 then 3
    when glow >= 400 then 2
    when glow >= 100 then 1
    else 0
  end;
$$;

-- Opt-ins de perfil público da DONA de uma linha. Uma subquery direta em
-- jornada_preferencias rodaria com os privilégios de quem lê, e a RLS de
-- preferências (só a dona) esconderia a linha alheia. SECURITY DEFINER,
-- search_path vazio, devolve só o booleano pedido.
create or replace function private.jornada_selos_no_perfil(alvo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.selos_no_perfil from public.jornada_preferencias p where p.user_id = alvo),
    false
  );
$$;

create or replace function private.jornada_estagio_no_perfil(alvo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.estagio_no_perfil from public.jornada_preferencias p where p.user_id = alvo),
    false
  );
$$;

-- A EXCEÇÃO do estágio, explícita e separada: o estágio de outra pessoa só
-- se ela ligou o opt-in, quem pede é membro da Rede e não há bloqueio entre
-- as duas (mesma regra do perfil da Rede, 0017). Devolve SÓ o número do
-- estágio, nunca o Glow; null em qualquer outro caso (inclusive sem opt-in,
-- pra não revelar se a pessoa usa a Jornada).
create or replace function public.jornada_estagio_publico(alvo uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.jornada_estagio_de(s.glow_total)
  from public.jornada_saldo s
  where s.user_id = alvo
    and auth.uid() is not null
    and private.jornada_estagio_no_perfil(alvo)
    and public.rede_is_member()
    and private.rede_users_unblocked(alvo);
$$;

revoke all on function public.jornada_so_contadores(jsonb) from public;
revoke all on function public.jornada_estagio_de(integer) from public;
revoke all on function private.jornada_selos_no_perfil(uuid) from public;
revoke all on function private.jornada_estagio_no_perfil(uuid) from public;
revoke all on function public.jornada_estagio_publico(uuid) from public;
grant execute on function public.jornada_so_contadores(jsonb)
  to authenticated, service_role;
grant execute on function public.jornada_estagio_de(integer)
  to authenticated, service_role;
grant execute on function private.jornada_selos_no_perfil(uuid)
  to authenticated, service_role;
grant execute on function private.jornada_estagio_no_perfil(uuid)
  to service_role;
grant execute on function public.jornada_estagio_publico(uuid)
  to authenticated, service_role;

-- ------------------------------------------------------------
-- RLS ligada em TODAS as tabelas novas
-- ------------------------------------------------------------
alter table public.jornada_saldo enable row level security;
alter table public.jornada_acoes enable row level security;
alter table public.jornada_contadores enable row level security;
alter table public.jornada_periodos enable row level security;
alter table public.jornada_selos enable row level security;
alter table public.jornada_colecao enable row level security;
alter table public.jornada_marcos enable row level security;
alter table public.jornada_destravados enable row level security;
alter table public.jornada_preferencias enable row level security;

-- Privilégios mínimos (mesmo padrão de 0006/0021): nada pra anon; leitura
-- pra authenticated (a RLS decide QUAIS linhas); escrita de contador só
-- pelo servidor (service_role e as RPCs SECURITY DEFINER da J10).
revoke all
  on table
    public.jornada_saldo,
    public.jornada_acoes,
    public.jornada_contadores,
    public.jornada_periodos,
    public.jornada_selos,
    public.jornada_colecao,
    public.jornada_marcos,
    public.jornada_destravados,
    public.jornada_preferencias
  from anon, authenticated, service_role;

grant select
  on table
    public.jornada_saldo,
    public.jornada_acoes,
    public.jornada_contadores,
    public.jornada_periodos,
    public.jornada_selos,
    public.jornada_colecao,
    public.jornada_marcos,
    public.jornada_destravados
  to authenticated;

-- Preferências: a dona lê, cria e altera a própria linha.
grant select, insert, update
  on table public.jornada_preferencias
  to authenticated;

grant select, insert, update, delete
  on table
    public.jornada_saldo,
    public.jornada_acoes,
    public.jornada_contadores,
    public.jornada_periodos,
    public.jornada_selos,
    public.jornada_colecao,
    public.jornada_marcos,
    public.jornada_destravados,
    public.jornada_preferencias
  to service_role;

-- ------------------------------------------------------------
-- Políticas
-- ------------------------------------------------------------
-- Escritas pensando em alguém tentando ler a linha de outra pessoa: toda
-- leitura exige auth.uid() = user_id, salvo a exceção explícita dos selos.

drop policy if exists "jornada_saldo: owner select" on public.jornada_saldo;
create policy "jornada_saldo: owner select"
  on public.jornada_saldo for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_acoes: owner select" on public.jornada_acoes;
create policy "jornada_acoes: owner select"
  on public.jornada_acoes for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_contadores: owner select" on public.jornada_contadores;
create policy "jornada_contadores: owner select"
  on public.jornada_contadores for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_periodos: owner select" on public.jornada_periodos;
create policy "jornada_periodos: owner select"
  on public.jornada_periodos for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_selos: owner select" on public.jornada_selos;
create policy "jornada_selos: owner select"
  on public.jornada_selos for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_colecao: owner select" on public.jornada_colecao;
create policy "jornada_colecao: owner select"
  on public.jornada_colecao for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_marcos: owner select" on public.jornada_marcos;
create policy "jornada_marcos: owner select"
  on public.jornada_marcos for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_destravados: owner select" on public.jornada_destravados;
create policy "jornada_destravados: owner select"
  on public.jornada_destravados for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_preferencias: owner select" on public.jornada_preferencias;
create policy "jornada_preferencias: owner select"
  on public.jornada_preferencias for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_preferencias: owner insert" on public.jornada_preferencias;
create policy "jornada_preferencias: owner insert"
  on public.jornada_preferencias for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "jornada_preferencias: owner update" on public.jornada_preferencias;
create policy "jornada_preferencias: owner update"
  on public.jornada_preferencias for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A EXCEÇÃO dos selos, explícita e separada: os selos de quem ligou o
-- opt-in de selos no perfil público, visíveis só pra membros da Rede e
-- nunca entre duas pessoas com bloqueio (0017). O estágio tem a sua
-- exceção na função jornada_estagio_publico, acima. Nenhuma outra tabela
-- tem leitura pública.
drop policy if exists "jornada_selos: perfil publico opt-in" on public.jornada_selos;
create policy "jornada_selos: perfil publico opt-in"
  on public.jornada_selos for select to authenticated
  using (
    private.jornada_selos_no_perfil(user_id)
    and public.rede_is_member()
    and private.rede_users_unblocked(user_id)
  );
