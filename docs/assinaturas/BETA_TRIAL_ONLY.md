# Assinaturas no beta fechado — T20/#73

Decisão de produto (repassada junto com a fila T13-T24): o beta fechado
roda **só em trial, sem cobrança real**. Nenhum provedor de pagamento
(Stripe ou outro) é integrado neste ticket — critério de aceite #1 da
issue #73 fica explicitamente fora de escopo até uma decisão humana
futura sobre monetização pós-beta.

## O que já existia (Marco 5, commit `8c17c6e`, 2026-07-23)

`lib/assinatura.ts` (`computeAssinatura`) já deriva o status efetivo —
`trial` / `vencida` / `ativa` — a partir de `trialStartedAt` e do valor
salvo, por data corrida (não depende de nenhum cron mudando coluna no
banco). `configuracoes`
(migration `0002_marco5_assinatura.sql`) seeda toda conta nova com
`trial_started_at = now()` e `assinatura_status = 'trial'` por padrão de
coluna — alcançável desde o primeiro signup, sem depender de nenhum
código de aplicação rodar certo no meio do caminho.

`components/ajustes/AjustesTab.tsx` já exibe os três estados com tom
sereno, sem culpa nem urgência falsa (§7.1/§7.4 do spec):

- **trial**: dias restantes, singular/plural correto (`"1 dia restante"`
  vs `"N dias restantes"`).
- **vencida**: "Seu teste terminou", resumo do valor já ganho no app
  (`formatBRL(totalEarnings(jobs))` + contagem de atendimentos) — **nada
  bloqueia o app**, exportar dados continua sempre disponível mesmo com
  assinatura vencida (`lib/exportarDados.ts`, comentário explícito nesse
  sentido).
- **ativa**: confirmação simples, sem CTA de upsell.

Isso já satisfaz o critério de aceite #3 da issue (UI comunica
claramente o vencimento do trial) por construção — não foi necessário
mudar a UI neste ticket, só confirmar que ela realmente cobre os três
estados e que nada no app trata `vencida` como bloqueio disfarçado.

## O que este ticket adicionou

- `tests/lib/assinatura.test.ts` — `computeAssinatura` não tinha nenhum
  teste dedicado até agora (só era exercitada indiretamente via
  `AjustesTab.tsx`). Cobre: dia zero (14 dias cheios), contagem com
  arredondamento de dia parcial, fronteira exata de expiração, período
  bem depois de vencido (nunca fica negativo), `ativa` curto-circuitando
  sem nem olhar pra `trialStartedAt`, e `ativa` prevalecendo mesmo com
  uma data de início muito antiga.
- Este documento, como evidência da decisão "só trial no beta" pedida
  pela issue (critério "Evidências exigidas").

## O que NÃO foi feito, de propósito

Critério de aceite #1 (checkout, webhook, transição `trial` → `ativa`
via provedor real) — não implementado. Nenhum arquivo sob
`app/api/assinatura/**` foi criado, nenhum secret de provedor de
pagamento foi tocado. Fica para um ticket futuro, quando/se o beta
converter para cobrança real.
