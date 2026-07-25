# RD-000 — Diff do schema remoto

**Captura analisada:** `.scratch/jobapp-remote-schema-audit.json`  
**Momento da captura:** 2026-07-25 10:00:44 UTC  
**Escopo:** schema `public`, somente leitura  
**Fontes locais comparadas:** `supabase/migrations/*.sql`, scripts SQL soltos em
`supabase/` e `lib/database.types.ts`

## 1. Resultado executivo

O remoto capturado contém somente quatro tabelas em `public`:
`configuracoes`, `jobs`, `metas` e `notas`.

- As quatro tabelas, suas 26 colunas, os defaults observados, os seis índices,
  as quatro policies e os dois triggers de tabela são compatíveis com as
  migrations `0001_jobapp_schema.sql` e `0002_marco5_assinatura.sql`.
- `push_subscriptions`, criada pela migration numerada
  `0003_push_subscriptions.sql`, **não existe no remoto capturado**.
- `despesas`, `receitas_avulsas` e `objetivos`, definidas somente em scripts
  SQL soltos, **não existem no remoto capturado**.
- O enum remoto `tema` tem exatamente três valores: `pink-neon`, `purple` e
  `crimson`. Os cinco valores adicionais declarados no TypeScript não existem
  no remoto capturado.
- `lib/database.types.ts` não representa o schema remoto atual: inclui quatro
  tabelas ausentes e cinco valores inexistentes de `tema`.
- Não há tabela de `public` registrada em publication na captura; portanto
  nenhuma das quatro tabelas observadas está publicada para Realtime.

Consequência: `RD-00` não deve partir da premissa anterior de que os scripts
soltos ou o snapshot TypeScript descrevem objetos já existentes no remoto. O
baseline precisa tratar esses objetos como ausentes e ser ensaiado antes em
banco descartável.

## 2. Inventário remoto confirmado

| Tabela | Colunas confirmadas | Índices confirmados | Policy confirmada | Trigger confirmado |
|---|---|---|---|---|
| `jobs` | `id`, `user_id`, `cliente_nome`, `data`, `hora`, `valor`, `modalidade`, `local`, `status`, `observacoes`, `criado_em`, `atualizado_em` | PK; `jobs_user_data_idx (user_id, data)` | `jobs: owner full access`, `ALL`, `auth.uid() = user_id` | `jobs_updated_at`, antes de `UPDATE`, chama `set_updated_at()` |
| `metas` | `id`, `user_id`, `periodo`, `valor_alvo` | PK; unique `(user_id, periodo)` | `metas: owner full access`, `ALL`, `auth.uid() = user_id` | nenhum trigger de tabela na captura |
| `notas` | `id`, `user_id`, `conteudo`, `criado_em`, `atualizado_em` | PK | `notas: owner full access`, `ALL`, `auth.uid() = user_id` | `notas_updated_at`, antes de `UPDATE`, chama `set_updated_at()` |
| `configuracoes` | `user_id`, `tema`, `pin_hash`, `trial_started_at`, `assinatura_status` | PK em `user_id` | `configuracoes: owner full access`, `ALL`, `auth.uid() = user_id` | nenhum trigger de tabela na captura |

Defaults confirmados:

- UUIDs de `jobs`, `metas` e `notas`: `gen_random_uuid()`;
- `jobs.status`: `agendado`;
- `jobs.criado_em`, `jobs.atualizado_em`, `notas.criado_em` e
  `notas.atualizado_em`: `now()`;
- `configuracoes.tema`: `pink-neon`;
- `configuracoes.trial_started_at`: `now()`;
- `configuracoes.assinatura_status`: `trial`.

Enums confirmados:

| Enum | Valores remotos, em ordem |
|---|---|
| `job_status` | `agendado`, `confirmado`, `concluído`, `cancelado` |
| `modalidade` | `presencial`, `online` |
| `periodo_meta` | `dia`, `mes`, `ano` |
| `tema` | `pink-neon`, `purple`, `crimson` |
| `assinatura_status` | `trial`, `ativa`, `vencida` |

## 3. Diff por fonte local

### 3.1 Migrations numeradas

| Fonte | Estado frente ao remoto | Diff confirmado |
|---|---|---|
| `0001_jobapp_schema.sql` | Parcialmente representada | As quatro tabelas públicas, índices, policies e triggers de tabela aparecem com o shape esperado. A captura não inventaria evidência sobre função, trigger em `auth` ou Storage; ver limites abaixo. |
| `0002_marco5_assinatura.sql` | Representada | `configuracoes.trial_started_at`, `configuracoes.assinatura_status` e o enum `assinatura_status` existem com tipos e defaults esperados. A captura não prova que o backfill histórico ocorreu. |
| `0003_push_subscriptions.sql` | Não representada | `public.push_subscriptions` está ausente; por consequência, também estão ausentes no inventário público capturado seu índice unique de `endpoint` e sua policy. |

### 3.2 Scripts SQL soltos

| Fonte | Objeto esperado | Estado remoto confirmado |
|---|---|---|
| `supabase/criar_despesas.sql` | `public.despesas` | ausente |
| `supabase/criar_objetivos.sql` | `public.receitas_avulsas` | ausente |
| `supabase/criar_objetivos.sql` | `public.objetivos` | ausente |

Como as tabelas estão ausentes, nenhuma coluna, constraint, policy ou default
desses scripts existe nelas no remoto capturado. Isso corrige a inferência
anterior de que sua presença em `database.types.ts` indicava provável aplicação
remota: o snapshot TypeScript está desatualizado em relação ao remoto atual.

### 3.3 `lib/database.types.ts`

| Item no TypeScript | Estado remoto | Classificação |
|---|---|---|
| `jobs`, `metas`, `notas`, `configuracoes` | presentes, com colunas compatíveis | alinhado no nível capturado |
| `push_subscriptions` | ausente | falso positivo do snapshot |
| `despesas` | ausente | falso positivo do snapshot |
| `receitas_avulsas` | ausente | falso positivo do snapshot |
| `objetivos` | ausente | falso positivo do snapshot |
| `Tema`: `pink-neon`, `purple`, `crimson` | presentes | alinhado |
| `Tema`: `grafite`, `ocean`, `gold`, `emerald`, `midnight` | ausentes | falsos positivos do snapshot |

Os aliases TypeScript não preservam integralmente constraints, defaults, RLS ou
precisão SQL e não devem ser usados como fonte de verdade para a reconciliação.

## 4. Fatos, inferências e limites

### Fatos confirmados pela captura

- Existem quatro e somente quatro tabelas `BASE TABLE` no schema `public`
  inventariado.
- Existem 26 colunas nessas tabelas, seis índices, quatro policies e dois
  triggers de tabela no inventário.
- Não existem em `public`: `push_subscriptions`, `despesas`,
  `receitas_avulsas` e `objetivos`.
- `tema` contém somente três valores.
- A lista `publications` está vazia.

### Inferências suportadas, mas não fatos históricos

- O estado público observado é consistente com `0001` + `0002`, exceto pelos
  aspectos fora do alcance da captura. Isso não prova que essas migrations
  foram executadas como arquivos; os objetos podem ter sido criados por outro
  caminho.
- A ausência de `push_subscriptions` é consistente com `0003` não ter sido
  aplicada, ter falhado ou o objeto ter sido removido. A captura não distingue
  essas histórias.
- A captura não informa se algum objeto ausente já existiu anteriormente.

### Limites da captura

O artefato não traz inventário de funções, definição de RLS habilitada por
tabela, schemas `auth`/`storage`, buckets ou policies de Storage. Logo, ele não
confirma nem nega:

- as funções `set_updated_at()` e `handle_new_user()` (os triggers públicos
  apenas referenciam a primeira);
- o trigger `on_auth_user_created` em `auth.users`;
- o bucket privado `cofre` e sua policy em `storage.objects`;
- a definição completa das funções, incluindo `security definer` e
  `search_path`;
- o valor histórico usado no backfill de `trial_started_at`;
- precisão/escala efetiva dos campos `numeric`, pois o artefato registra o tipo
  como `numeric` sem esses atributos;
- um dump reproduzível completo de todos os schemas envolvidos.

As constraints aparecem no artefato em formato de inventário relacional
expandido, sem a expressão SQL completa de cada `CHECK` e sem resolver o destino
das FKs em `auth.users`. Portanto, a equivalência textual dessas definições não
está provada, embora os nomes de PK, FK, unique e checks esperados estejam
presentes nas quatro tabelas.

## 5. Implicações exatas para RD-00

`RD-00` deve:

1. criar `push_subscriptions`, porque a migration numerada `0003` não está
   refletida no remoto;
2. criar `despesas`, `receitas_avulsas` e `objetivos`, porque estão ausentes;
3. adicionar, de forma idempotente, os cinco valores de `tema` usados pelo
   código (`grafite`, `ocean`, `gold`, `emerald`, `midnight`) **somente se esses
   valores continuarem sendo requisito do produto**;
4. preservar sem recriar ou alterar destrutivamente as quatro tabelas existentes
   e os três valores atuais de `tema`;
5. usar definições versionadas e explicitamente revisadas para colunas,
   constraints, defaults, RLS e policies dos quatro objetos ausentes, pois não
   existe shape remoto desses objetos a ser preservado;
6. ser idempotente tanto num banco vazio quanto num banco que reproduza o
   inventário público desta captura;
7. ser ensaiada em ambiente descartável/local antes de qualquer aplicação
   remota;
8. não regenerar `lib/database.types.ts` até o schema reconciliado existir no
   ambiente local/staging apropriado; essa regeneração continua pertencendo a
   `RD-09`.

Há duas verificações que devem preceder a aplicação remota de `RD-00`:

- confirmar por dump completo ou consultas adicionais os itens fora do alcance
  desta captura (`auth`, `storage`, funções e estado de RLS);
- confirmar a decisão de produto sobre os cinco temas adicionais. A captura
  prova que eles não existem hoje; não prova que devam ser adicionados.

## 6. Estado do critério de aceite de RD-000

O diff explícito exigido por `RD-000` está documentado aqui. Porém, o segundo
item do critério de aceite — um banco descartável que reproduza o schema real —
não pode ser considerado concluído apenas com este artefato, porque a captura
não contém definições completas de funções, checks, `auth` e `storage`.

Assim, este documento desbloqueia a **especificação** de `RD-00`, mas a execução
de `RD-00` contra o remoto continua bloqueada até que:

1. exista o ambiente descartável com as definições faltantes verificadas; e
2. a migration proposta passe nele duas vezes e também num banco vazio, como
   exige `BACKEND_TICKETS.md`.

