# T22 — Evidência: preparação dos 15 convites do beta fechado

**Ticket:** [#75](https://github.com/alissonrsilva20bxx/cortex-app/issues/75).
**Status deste documento:** 15 convites confirmados em produção (seção 1). Faltam: confirmação de resgate (seção 2), lista de destinatários + comunicação inicial (seção 3, T23).

## 0. Por que os convites foram gerados antes da lista final de pessoas

O RPC `rede_gerar_convite` (`supabase/migrations/0015_rede_convites_rpc.sql`) não recebe nem grava identidade nenhuma do destinatário — só o hash do código e o prazo de expiração (7 dias, fixo). A ligação "código X foi pra pessoa Y" nunca existe no banco; só existe no que o humano registra fora dele, na hora de distribuir (T23). Isso permite gerar os 15 códigos antes de fechar a lista final das 15 pessoas, desde que a distribuição aconteça dentro da janela de 7 dias — decisão registrada aqui, não uma mudança de escopo do ticket.

## 1. Convites gerados (critério de aceite #1)

Gerados via chamada autenticada como admin a `POST /api/rede/convites` (`{"acao": "gerar"}`) em produção, um por vez, 15 vezes — nunca hash/código gerado fora desse fluxo (requisito explícito da issue).

**Não colar código em texto puro aqui neste arquivo** — só id e hash, que é o que a issue pede como evidência ("hash/id, não o código em texto puro"). O código em texto puro só deve existir na mensagem enviada à pessoa (T23) e pode ser apagado da tela/console do navegador depois de anotado.

| #   | `id` (retornado pela API)              | `expira_em`                   | Destinatário (preencher em T23) |
| --- | -------------------------------------- | ----------------------------- | ------------------------------- |
| 1   | `955f1595-9b64-4a43-8503-5027fbe226e1` | 2026-09-12 01:15:59.025349+00 |                                 |
| 2   | `2b299ba8-1735-42da-b939-0eff64af35ca` | 2026-09-12 01:16:00.079657+00 |                                 |
| 3   | `16e84e5f-0d05-49e2-ade9-dc3cd1dcb25e` | 2026-09-12 01:16:00.970789+00 |                                 |
| 4   | `14b8abd7-7fad-437e-9ac7-c203f668d235` | 2026-09-12 01:16:01.836304+00 |                                 |
| 5   | `e9d23e6b-a8cf-4f0b-84b7-a45383a7c691` | 2026-09-12 01:16:02.832332+00 |                                 |
| 6   | `b11f469f-1a4b-4315-b8bb-f30b4c82ea7c` | 2026-09-12 01:16:03.507107+00 |                                 |
| 7   | `63f0d496-91bd-405e-b090-d9872359bfc9` | 2026-09-12 01:16:04.208043+00 |                                 |
| 8   | `1f88e798-4f58-444e-8e37-464a3895dc6e` | 2026-09-12 01:16:06.402853+00 |                                 |
| 9   | `fc90a481-2970-4c03-9ee6-4373e91bc945` | 2026-09-12 01:16:07.247616+00 |                                 |
| 10  | `91137aed-6018-4782-b4e7-c2533cec3f74` | 2026-09-12 01:16:08.174479+00 |                                 |
| 11  | `ed2278c7-8386-4404-bbce-8bcca665c5a5` | 2026-09-12 01:16:09.160396+00 |                                 |
| 12  | `0bda0844-fc90-4e27-82dd-d35b00c0501c` | 2026-09-12 01:16:10.006499+00 |                                 |
| 13  | `40c4e564-f43a-4970-88ad-eb709a19d9e1` | 2026-09-12 01:16:10.829570+00 |                                 |
| 14  | `7639b327-6ea0-4791-ac5b-7553d584a089` | 2026-09-12 01:16:11.696837+00 |                                 |
| 15  | `41adecd3-3190-4eb1-9250-3517156fdda8` | 2026-09-12 01:16:12.525481+00 |                                 |

Confirmado via consulta somente-leitura em produção (`codigo_hash` calculado localmente a partir do código em texto puro que o humano tinha anotado, nunca commitado): todos os 15 hashes bateram com uma linha existente em `rede_convites`, nenhum ainda resgatado (`usado_por is null` em todos).

**Data/hora da geração:** ~2026-09-05 01:15:59 UTC (derivado de `expira_em` − 7 dias, prazo fixo do RPC).
**Ambiente:** produção (`/api/rede/convites`, conta admin do humano).

## 2. Confirmação de resgate (validação obrigatória da issue)

A issue exige confirmar manualmente que ao menos um convite gerado é resgatável (`rede_resgatar_convite`) antes do envio real. Registrar aqui:

- Conta de teste usada para o resgate: conta de teste do humano (não uma das 15 reais).
- Código testado: **16º código, gerado só para este teste** (`id` `14fd1405-7898-435e-a8b8-491ea03e58f0`, expira 2026-09-15T20:10:41+00:00) — não está na tabela dos 15 da seção 1, gerado à parte via a mesma API (`POST /api/rede/convites`).
- Resultado: **confirmado, resgate funcionou** (2026-09-08).
- Código de teste já consumido pelo resgate (atômico, um uso só) — descartado, não reaproveitável.

## 3. Comunicação inicial (critério de aceite #2)

Como cada testadora vai receber o link/código — a definir junto com a lista final de pessoas (T23). _Pendente._

## 4. Sem contas fictícias (condição de bloqueio da issue)

Nenhum dos 15 destinatários finais é conta de teste/fictícia — confirmar na hora de preencher a coluna "Destinatário" acima.
