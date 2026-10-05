# Jornada — pacote de orquestração

Este diretório é **o pacote fechado** para o orquestrador (terminal Ghost + Pi harness)
rodar com 2 contas Claude como trabalhadoras.

Objetivo final, em uma frase: **colocar as 5 telas novas no app e, depois, o motor da
gamificação "Sua Jornada" em cima delas, até dar pra ver tudo funcionando no preview do
Vercel.**

## Ordem de leitura (obrigatória)

1. **[00-orquestracao.md](00-orquestracao.md)** — papéis, branches, worktrees, regras
   invioláveis, mapa de quem mexe em qual arquivo, armadilhas conhecidas da máquina.
   *O orquestrador lê inteiro. Cada trabalhadora lê inteiro antes do primeiro commit.*
2. **[01-tickets.md](01-tickets.md)** — índice dos tickets, as 3 fases, o grafo de
   dependências e quem pode rodar em paralelo.
3. **[tickets/](tickets/)** — um arquivo por ticket (`J00.md` … `J17.md`). O corpo de cada
   arquivo é o corpo da issue no GitHub, palavra por palavra.
4. **[referencias/](referencias/)** — os mockups aprovados. Nada é inventado: tudo que as
   telas e a Jornada devem parecer está aqui.

## Como as issues vão pro GitHub

O orquestrador roda **uma vez**:

```bash
bash scripts/jornada-criar-tickets.sh
```

O script é **idempotente**: cria os labels que faltam, cria as 18 issues a partir dos
arquivos em `tickets/`, e liga as dependências. Rodar de novo não duplica nada — ele
reconhece as issues pelo título e não reescreve as que já existem (só acrescenta o label
`epic:jornada` se faltar e atualiza o bloco "Bloqueado por"). Use `--dry-run` pra ver o
que faria sem escrever nada.

## O que está travado agora (ler antes de começar)

| # | Travamento | Situação | Quem destrava |
| - | ---------- | -------- | ------------- |
| 1 | **PR #148 (pílula 2 da barra de navegação).** | **Resolvido:** mergeado em `mockuptesterede` no commit `aa46435`. Falta criar a branch `feature/jornada` a partir dessa base. | Humano (ticket **J00**) |
| 2 | **Issues #115–#120 estão abertas com o label `ready-for-agent`** e descrevem trabalho que já foi feito e fechado (mapa #122). Um orquestrador que varre `ready-for-agent` vai refazer trabalho pronto. | Pendente de autorização: tirar o label e fechar as seis. | Humano (ticket **J00**) |
| 3 | **A spec da gamificação não existe ainda.** A Fase 2 inteira depende dela. | Pendente: escrever e aprovar `docs/jornada/spec-sua-jornada.md`. | Humano (ticket **J08**) |

Fase 1 (as 5 telas) só pode começar depois de **J00**.
Fase 2 (o motor) só pode começar depois de **J08**.
