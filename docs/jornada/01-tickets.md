# 01 — Índice dos tickets

18 tickets, 3 fases, 2 porteiras humanas.

---

## Grafo

```
FASE 0 — destravar (humano)
  J00  Mergear #148 e aposentar #115–#120                      [PORTEIRA HUMANA]
        │
FASE 1 — as 5 telas novas
  J01  Fundação visual: tokens e casca                          W1
        ├── J02  Início                                         W1
        ├── J03  Agenda                                         W2
        ├── J04  Financeiro                                     W1
        ├── J05  Cofre                                          W2
        └── J06  Rede                                           W1
              │  (J02…J06 todos fechados)
  J07  Regressão visual e smoke das 5 telas                     W2
        │
FASE 2 — o motor da gamificação
  J08  Spec da Jornada aprovada                                 [PORTEIRA HUMANA]
        ├── J09  Migrations dos contadores                      W1
        │     └── J10  Motor no servidor (RPCs)                 W1
        │           └── J11  Camada cliente                     W2
        │                 ├── J12  Tela "Sua Jornada" + card    W2
        │                 │     ├── J13  Comemoração, som, Modo discreto  W1
        │                 │     └── J14  Resumos semana/mês/ano W2
        │                 └── J15  Ligar o motor às ações reais W1
        │                             (depende também de J13)
  J16  Regressão e smoke autenticado da Jornada                 W2
        │
FASE 3 — ver funcionando
  J17  Integrar no preview do Vercel e aprovação final          [PORTEIRA HUMANA]
```

## Paralelismo

| Momento | W1 | W2 |
| ------- | -- | -- |
| depois de J00 | **J01** (sozinha) | esperando |
| depois de J01 | J02 → J04 → J06 | J03 → J05 |
| depois de J02…J06 | esperando | **J07** |
| depois de J08 | J09 → J10 | esperando |
| depois de J10 | esperando | J11 |
| depois de J11 | J13 (depois de J12) | J12 → J14 |
| depois de J13+J11 | J15 | J14 |
| depois de J15 | esperando | **J16** |

J01, J07, J08, J09, J10, J11, J16 e J17 são **serializados de propósito**: ou tocam arquivo
compartilhado, ou são porteira, ou conferem o trabalho dos outros.

## Tabela

| Ticket | Título | Fase | Tipo | Bloqueado por |
| ------ | ------ | ---- | ---- | ------------- |
| [J00](tickets/J00.md) | Destravar a base: mergear #148 e aposentar as issues #115–#120 | 0 | decisão | — |
| [J01](tickets/J01.md) | Fundação visual das 5 telas novas: tokens e casca | 1 | implementação | J00 |
| [J02](tickets/J02.md) | Tela Início no visual novo | 1 | implementação | J01 |
| [J03](tickets/J03.md) | Tela Agenda no visual novo | 1 | implementação | J01 |
| [J04](tickets/J04.md) | Tela Financeiro no visual novo | 1 | implementação | J01 |
| [J05](tickets/J05.md) | Tela Cofre no visual novo | 1 | implementação | J01 |
| [J06](tickets/J06.md) | Tela Rede no visual novo | 1 | implementação | J01 |
| [J07](tickets/J07.md) | Regressão visual e smoke das 5 telas novas | 1 | teste | J02–J06 |
| [J08](tickets/J08.md) | Spec da gamificação "Sua Jornada" aprovada | 2 | decisão | J07 |
| [J09](tickets/J09.md) | Migrations: contadores, selos, capítulos e marcos | 2 | implementação | J08 |
| [J10](tickets/J10.md) | Motor no servidor: as RPCs que concedem Glow | 2 | implementação | J09 |
| [J11](tickets/J11.md) | Camada cliente: estado, cache e registro de ação | 2 | implementação | J10 |
| [J12](tickets/J12.md) | Tela "Sua Jornada" e o card no Início | 2 | implementação | J11 |
| [J13](tickets/J13.md) | Comemorações, sons e Modo discreto | 2 | implementação | J12 |
| [J14](tickets/J14.md) | Resumos da semana, do mês e do ano | 2 | implementação | J12 |
| [J15](tickets/J15.md) | Ligar o motor às ações reais do app | 2 | implementação | J13 |
| [J16](tickets/J16.md) | Regressão e smoke autenticado da Jornada | 2 | teste | J14, J15 |
| [J17](tickets/J17.md) | Integrar no preview do Vercel e aprovação final | 3 | decisão | J16 |

## Labels

O script reaproveita o vocabulário de labels que já existe no repositório:

- `tipo:implementacao`, `tipo:teste`, `tipo:decisao`
- `area:casca-global`, `area:inicio`, `area:agenda`, `area:financeiro`, `area:cofre`,
  `area:rede-feed`, `area:backend`, `area:frontend`, `area:testes`
- `pronto-para-agente` — **só** nos tickets que estão de fato na fronteira
- `bloqueado` — nos que esperam outro ticket
- `requer-decisao-humana` — J00, J08, J17
- `proibido:migration-deploy-merge` — em todos os de implementação

E cria um label novo: **`epic:jornada`**, em todas as 18 issues.

> Atenção: os labels **em inglês** `ready-for-agent` e `blocked` estão nas issues velhas
> #115–#120 e **não devem ser usados**. O ticket J00 tira esse label de lá justamente pra
> ninguém confundir as duas listas.
