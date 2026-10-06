-- ============================================================
-- JobApp Jornada - Migration 0034: armazenamento da "Sua Jornada"
-- ============================================================
-- Ticket J09 (#159). Spec: docs/jornada/spec-sua-jornada.md (J08, #158).
--
-- A REGRA QUE MANDA EM TUDO AQUI: só contadores e selos, nunca um diário.
-- Nenhuma tabela registra "em tal dia ela fez tal coisa". O público do app
-- são mulheres pra quem discrição é o produto: um histórico diário seria uma
-- linha do tempo do trabalho dela. Por isso:
--   - o limite diário de Glow (spec, decisão 4) funciona guardando, por
--     ação, SÓ a data do último ganho e quantas vezes naquela data; quando o
--     dia vira, o RPC sobrescreve -- não existe histórico acumulado;
--   - o capítulo do mês guarda SÓ o mês corrente (uma linha por usuária,
--     sobrescrita na virada); os meses fechados viram uma entrada na
--     coleção de enfeites, e mês não fechado não deixa rastro nenhum;
--   - nenhuma coluna de "quando" além dessas duas (data do último ganho
--     por ação e o mês do capítulo corrente).
--
-- QUEM ESCREVE: os contadores (Glow, ações, selos, capítulo, coleção,
-- marcos) só são escritos pelo servidor -- as RPCs SECURITY DEFINER da J10.
-- A usuária só LÊ as próprias linhas: se o cliente pudesse escrever o
-- próprio Glow, dava pra mentir (J10, "Por que no servidor"). A única
-- tabela que ela escreve direto é a de preferências.
--
-- QUEM LÊ: só a dona. A única exceção é o opt-in de perfil público (spec,
-- decisão 11, desligado por padrão): estágio e selos ficam visíveis pra
-- membros da Rede, sem bloqueio entre as duas, numa política separada e
-- explícita em cada uma dessas duas tabelas. Total de Glow, pilares, ações,
-- capítulo, coleção e marcos nunca são legíveis por outra pessoa.
--
-- Aditiva: nenhuma tabela ou coluna existente é alterada.

-- ------------------------------------------------------------
-- Tabelas
-- ------------------------------------------------------------

-- Total de Glow e Glow por pilar (spec, decisões 2 e 3). Uma linha por
-- usuária. Nunca diminui (spec, decisão 5: nada zera).
create table if not exists public.jornada_saldo (
  user_id uuid primary key references auth.users(id) on delete cascade,
  glow_total integer not null default 0 check (glow_total >= 0),
  glow_organizar integer not null default 0 check (glow_organizar >= 0),
  glow_prosperar integer not null default 0 check (glow_prosperar >= 0),
  glow_proteger integer not null default 0 check (glow_proteger >= 0),
  glow_conectar integer not null default 0 check (glow_conectar >= 0)
);

-- Estágio atual (spec, decisão 5): 0 Começando, 1 Em movimento,
-- 2 Organizada, 3 Prosperando, 4 Icônica, 5 Icônica II, 6 Icônica III...
-- Tabela própria, separada do saldo, porque é o que o opt-in de perfil
-- público expõe -- e RLS é por linha, não por coluna: na mesma tabela do
-- saldo, liberar o estágio liberaria também o total de Glow e os pilares.
create table if not exists public.jornada_estagio (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nivel integer not null default 0 check (nivel >= 0)
);

-- Contador por ação. `contagem_total` sobe sempre (mesmo acima do limite,
-- J10 passo 2). `data_ultimo_ganho` + `ganhos_no_dia` são o limite diário:
-- ao ganhar Glow, se `data_ultimo_ganho` é hoje (no fuso dela), soma 1; se
-- não, o RPC sobrescreve com hoje e 1. Nada mais é guardado por ação.
-- `acao` é a chave da ação definida na spec (ex.: 'atendimento',
-- 'despesa', 'meta_concluida'); a lista e os valores ficam nas RPCs.
create table if not exists public.jornada_acoes (
  user_id uuid not null references auth.users(id) on delete cascade,
  acao text not null check (acao ~ '^[a-z][a-z0-9_]{0,47}$'),
  contagem_total integer not null default 0 check (contagem_total >= 0),
  data_ultimo_ganho date,
  ganhos_no_dia integer not null default 0 check (ganhos_no_dia >= 0),
  primary key (user_id, acao),
  -- Sem data, não há ganho no dia; com data, houve pelo menos um.
  constraint jornada_acoes_limite_coerente check (
    (data_ultimo_ganho is null and ganhos_no_dia = 0)
    or (data_ultimo_ganho is not null and ganhos_no_dia >= 1)
  )
);

-- Selos e o nível atual de cada um (spec, decisão 6: I, II, III). Só o
-- nível de agora, nunca quando foi conquistado.
create table if not exists public.jornada_selos (
  user_id uuid not null references auth.users(id) on delete cascade,
  selo text not null check (selo ~ '^[a-z][a-z0-9_]{0,47}$'),
  nivel smallint not null check (nivel between 1 and 3),
  primary key (user_id, selo)
);

-- Capítulo do mês CORRENTE (spec, decisão 7): uma linha por usuária,
-- sobrescrita na virada do mês. Progresso de cada uma das 3 missões e se o
-- capítulo fechou. O mês anterior não fica guardado aqui.
create table if not exists public.jornada_capitulo (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ano smallint not null check (ano between 2000 and 2999),
  mes smallint not null check (mes between 1 and 12),
  missao_1 integer not null default 0 check (missao_1 >= 0),
  missao_2 integer not null default 0 check (missao_2 >= 0),
  missao_3 integer not null default 0 check (missao_3 >= 0),
  fechado boolean not null default false
);

-- Coleção de enfeites (spec, decisão 7): os meses em que o capítulo
-- fechou. Mês não fechado não tem linha -- "fica em branco e nada é
-- tirado".
create table if not exists public.jornada_colecao (
  user_id uuid not null references auth.users(id) on delete cascade,
  ano smallint not null check (ano between 2000 and 2999),
  mes smallint not null check (mes between 1 and 12),
  primary key (user_id, ano, mes)
);

-- Marcos de dinheiro guardado já batidos (spec, decisão 8: 500, 1.000,
-- 2.500, 5.000). Só QUAIS marcos, nunca quando nem o valor guardado.
create table if not exists public.jornada_marcos (
  user_id uuid not null references auth.users(id) on delete cascade,
  marco integer not null check (marco in (500, 1000, 2500, 5000)),
  primary key (user_id, marco)
);

-- Preferências (spec, decisões 10 e 11). Som ligado por padrão; Modo
-- discreto desligado; perfil público DESLIGADO por padrão (opt-in).
create table if not exists public.jornada_preferencias (
  user_id uuid primary key references auth.users(id) on delete cascade,
  som_ligado boolean not null default true,
  modo_discreto boolean not null default false,
  mostrar_no_perfil boolean not null default false
);

-- ------------------------------------------------------------
-- Opt-in de perfil público: helper
-- ------------------------------------------------------------
-- A política pública precisa saber se a DONA da linha ligou o opt-in. Uma
-- subquery direta em jornada_preferencias rodaria com os privilégios de
-- quem lê, e a RLS de preferências (só a dona) esconderia a linha alheia.
-- Este helper lê só o booleano, com search_path vazio, e não expõe mais
-- nada das preferências.
create schema if not exists private;

create or replace function private.jornada_mostra_no_perfil(alvo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.mostrar_no_perfil
      from public.jornada_preferencias p
      where p.user_id = alvo
    ),
    false
  );
$$;

revoke all on function private.jornada_mostra_no_perfil(uuid) from public;
grant execute on function private.jornada_mostra_no_perfil(uuid)
  to authenticated, service_role;

-- ------------------------------------------------------------
-- RLS ligada em TODAS as tabelas novas
-- ------------------------------------------------------------
alter table public.jornada_saldo enable row level security;
alter table public.jornada_estagio enable row level security;
alter table public.jornada_acoes enable row level security;
alter table public.jornada_selos enable row level security;
alter table public.jornada_capitulo enable row level security;
alter table public.jornada_colecao enable row level security;
alter table public.jornada_marcos enable row level security;
alter table public.jornada_preferencias enable row level security;

-- Privilégios mínimos (mesmo padrão de 0006/0021): nada pra anon; leitura
-- pra authenticated (a RLS decide QUAIS linhas); escrita de contador só
-- pelo servidor (service_role e as RPCs SECURITY DEFINER da J10).
revoke all
  on table
    public.jornada_saldo,
    public.jornada_estagio,
    public.jornada_acoes,
    public.jornada_selos,
    public.jornada_capitulo,
    public.jornada_colecao,
    public.jornada_marcos,
    public.jornada_preferencias
  from anon, authenticated, service_role;

grant select
  on table
    public.jornada_saldo,
    public.jornada_estagio,
    public.jornada_acoes,
    public.jornada_selos,
    public.jornada_capitulo,
    public.jornada_colecao,
    public.jornada_marcos
  to authenticated;

-- Preferências: a dona lê, cria e altera a própria linha.
grant select, insert, update
  on table public.jornada_preferencias
  to authenticated;

grant select, insert, update, delete
  on table
    public.jornada_saldo,
    public.jornada_estagio,
    public.jornada_acoes,
    public.jornada_selos,
    public.jornada_capitulo,
    public.jornada_colecao,
    public.jornada_marcos,
    public.jornada_preferencias
  to service_role;

-- ------------------------------------------------------------
-- Políticas
-- ------------------------------------------------------------
-- Escritas pensando em alguém tentando ler a linha de outra pessoa: toda
-- leitura exige auth.uid() = user_id, salvo a exceção explícita do opt-in.

drop policy if exists "jornada_saldo: owner select" on public.jornada_saldo;
create policy "jornada_saldo: owner select"
  on public.jornada_saldo
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_estagio: owner select" on public.jornada_estagio;
create policy "jornada_estagio: owner select"
  on public.jornada_estagio
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_acoes: owner select" on public.jornada_acoes;
create policy "jornada_acoes: owner select"
  on public.jornada_acoes
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_selos: owner select" on public.jornada_selos;
create policy "jornada_selos: owner select"
  on public.jornada_selos
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_capitulo: owner select" on public.jornada_capitulo;
create policy "jornada_capitulo: owner select"
  on public.jornada_capitulo
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_colecao: owner select" on public.jornada_colecao;
create policy "jornada_colecao: owner select"
  on public.jornada_colecao
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_marcos: owner select" on public.jornada_marcos;
create policy "jornada_marcos: owner select"
  on public.jornada_marcos
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_preferencias: owner select"
  on public.jornada_preferencias;
create policy "jornada_preferencias: owner select"
  on public.jornada_preferencias
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "jornada_preferencias: owner insert"
  on public.jornada_preferencias;
create policy "jornada_preferencias: owner insert"
  on public.jornada_preferencias
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "jornada_preferencias: owner update"
  on public.jornada_preferencias;
create policy "jornada_preferencias: owner update"
  on public.jornada_preferencias
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A EXCEÇÃO, explícita e separada: estágio e selos de quem ligou o opt-in
-- de perfil público, visíveis só pra membros da Rede e nunca entre duas
-- pessoas com bloqueio (mesma regra do perfil da Rede, 0017). Nada além
-- dessas duas tabelas tem política pública.
drop policy if exists "jornada_estagio: perfil publico opt-in"
  on public.jornada_estagio;
create policy "jornada_estagio: perfil publico opt-in"
  on public.jornada_estagio
  for select
  to authenticated
  using (
    private.jornada_mostra_no_perfil(user_id)
    and public.rede_is_member()
    and private.rede_users_unblocked(user_id)
  );

drop policy if exists "jornada_selos: perfil publico opt-in"
  on public.jornada_selos;
create policy "jornada_selos: perfil publico opt-in"
  on public.jornada_selos
  for select
  to authenticated
  using (
    private.jornada_mostra_no_perfil(user_id)
    and public.rede_is_member()
    and private.rede_users_unblocked(user_id)
  );
