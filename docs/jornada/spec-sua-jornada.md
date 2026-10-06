# Spec — "Sua Jornada" (Fase 2, motor de gamificação)

Este é o documento que a J08 (#158) pedia. Ele fecha o desenho da Fase 2 **antes** do
código: as decisões já tomadas, os números, o que vai para o banco e o que **não** vai.
J09 a J16 constroem exatamente isto. Se um ticket e esta spec discordarem, a spec vence;
se a spec precisar mudar, muda aqui primeiro, com o ok do humano.

Fonte: protótipo aprovado em 02/10/2026
(`docs/jornada/referencias/prototipo-sua-jornada.html`) e as decisões do operador sobre os
pontos que o protótipo não fechava (receita, "dia forte", as 12 missões, missões de
comunidade e marcos de dinheiro).

---

## 1. Decisões fechadas (não reabrem)

1. **Atendimento nunca dá pontos.** Só marca o dia como ativo, 1x/dia. Os pontos grandes
   vão pra se organizar, guardar dinheiro, se proteger e descansar — nunca pra volume de
   trabalho.
2. **Os pontos se chamam `Glow`.**
3. **4 pilares:** Organizar, Prosperar, Proteger, Conectar.
4. **Limite de Glow por dia em cada ação.** Passou do limite, a ação registra normal, só
   não ganha Glow. Isso é o que impede "farmar".
5. **Estágios:** Começando (0) → Em movimento (100) → Organizada (400) → Prosperando
   (1.200) → Icônica (3.000) → **Icônica II, III…** a cada 1.500. **Nada zera, nunca.**
6. **Selos com nível I / II / III** (+20 / +30 / +50).
7. **Capítulo do mês:** 3 missões; fechou, ganha o enfeite do mês pra coleção (+40). Não
   fechou, o mês fica em branco na coleção e **nada é tirado**.
8. **Metas de dinheiro:** concluir uma meta dá +100; marcos de € 500 / 1.000 / 2.500 /
   5.000 guardados dão +50. São ligados ao dinheiro **de verdade** dela.
9. **Resumos** de semana, mês e ano.
10. **Som ligado por padrão**, respeitando o silencioso do aparelho, com **Modo discreto**
    a 1 toque. Comemoração grande **não** aparece logo depois de registrar atendimento —
    fica adiada pra próxima abertura do app.
11. **Estágio e selos no perfil público são opt-in, desligados por padrão.** Card de
    compartilhar sem identidade e sem marca.
12. **"Isso me ajudou" e "Isso me protegeu"** são contagens separadas e visíveis **só pra
    autora**.
13. Subir de estágio **destrava** moldura de avatar, ícone e variação de tema. Nada do que
    já foi destravado é retirado.
14. A Jornada é um **card no Início que abre uma tela própria**. **Sem 6ª aba.**
15. **Jornada de Começo** (7 dias) pra contas novas, opcional pras testers.
16. **O app guarda só contadores e selos. Nunca um diário do que ela fez em cada dia.** Isso
    é privacidade, não economia de espaço: um histórico diário detalhado seria uma linha do
    tempo do trabalho dela.
17. Idioma e moeda: PT-BR com `€`. Trocar idioma/moeda é decisão **futura** e está fora da
    Fase 2 — mas tudo nasce **traduzível**: todo texto e todo símbolo de moeda moram num
    lugar só (`lib/jornada/textos.ts`), nunca espalhados pelos componentes.

---

## 2. Regras de tempo

- **Dia, semana, mês e ano são do fuso da usuária**, não do servidor.
- **A semana começa na segunda-feira.**
- O limite diário de cada ação zera à meia-noite do fuso dela.
- O capítulo do mês vira no dia 1, à meia-noite do fuso dela.

---

## 3. Glow por ação e limite diário

Passou do limite do dia, a ação registra normal (o contador sobe), só não ganha Glow.

| Ação | Glow | Limite/dia | Pilar |
| ---- | ---- | ---------- | ----- |
| Lançar despesa | +5 | 3x | Organizar |
| Lançar receita (entrada) | +5 | 3x | Organizar |
| Planejar o dia seguinte | +5 | 1x | Organizar |
| Guardar dinheiro numa meta | +15 | 1x | Prosperar |
| Guardar comprovante no Cofre | +10 | 3x | Proteger |
| Tirar um dia de descanso | +10 | 1x | Proteger |
| "Isso me ajudou" (recebido numa dica dela) | +5 | 5x | Conectar |
| "Isso me protegeu" (recebido numa dica dela) | +5 | 5x | Conectar |
| Registrar atendimento | **0** | — | — (só marca o dia como ativo, 1x/dia) |

**Prêmios de uma vez** (não entram no limite diário):

| Acontecimento | Glow | Pilar |
| ------------- | ---- | ----- |
| Concluir uma meta de dinheiro | +100 | Prosperar |
| Marco de dinheiro guardado (§7) | +50 cada | Prosperar |
| Fechar o capítulo do mês (§6) | +40 | do mês (vai pro total) |
| Subir um selo de nível (§5) | +20 (I) / +30 (II) / +50 (III) | o pilar do selo |

**Conta de referência** (para calibrar, não é regra): um dia bom e comum (2 despesas, 1
receita, 1 comprovante, planejar o dia seguinte) dá 30 Glow. O teto teórico de um dia,
sem prêmios de uma vez, é 140. Com um dia bom a cada dois, Icônica (3.000) chega em uns
6 a 8 meses, como o protótipo previa.

### Dia forte e semana firme

- **Dia forte:** dia em que **3 ou mais ações deram Glow** (contando cada vez que deu Glow,
  dentro do limite). **Atendimento não conta**, e ação que passou do limite também não.
- **Semana firme:** semana (segunda a domingo) com **3 ou mais dias fortes**.

---

## 4. Estágios

| Estágio | Glow total |
| ------- | ---------- |
| Começando | 0 |
| Em movimento | 100 |
| Organizada | 400 |
| Prosperando | 1.200 |
| Icônica | 3.000 |
| Icônica II | 4.500 |
| Icônica III | 6.000 |
| Icônica N | 3.000 + (N − 1) × 1.500 |

O estágio é calculado do Glow total; não é guardado à parte. **Nada zera, nunca.**
Subir de estágio destrava itens (moldura, ícone, variação de tema) que nunca são retirados.

---

## 5. Selos (11)

Cada nível conquistado dá o Glow do nível uma vez: I +20, II +30, III +50. Selos de nível
único dão só o I (+20). O critério é sempre um **contador total** (vida inteira).

| Selo | Conta | I | II | III | Pilar |
| ---- | ----- | - | -- | --- | ----- |
| Primeiros passos | abriu a Jornada | 1 | — | — | Organizar |
| Planejadora | dias planejados com antecedência | 1 | 10 | 50 | Organizar |
| Mão amiga | vezes que a dica dela ajudou alguém | 1 | 25 | 100 | Conectar |
| Semana firme | semanas firmes (§3) | 1 | 4 | 12 | Organizar |
| Rumo à meta | vezes guardando dinheiro numa meta | 1 | 10 | 50 | Prosperar |
| Tudo guardado | comprovantes guardados no Cofre | 1 | 20 | 100 | Proteger |
| Descansar conta | dias de descanso de propósito | 1 | 8 | 24 | Proteger |
| Guardiã | vezes que a dica dela protegeu alguém | 5 | 25 | 100 | Conectar |
| Em casa | completou os primeiros 7 dias | 1 | — | — | Organizar |
| Mês a mês | meses na Jornada | 1 | 3 | 6 | Organizar |
| Um ano | um ano na Jornada | 1 | — | — | Organizar |

Glow máximo somando todos os selos: 8 × 100 + 3 × 20 = **860**.

---

## 6. Capítulo do mês — as 3 missões de cada mês

Cada mês tem uma trinca **própria** (nenhuma se repete). Fechou as 3 → enfeite do mês na
coleção + 40 Glow. Não fechou → o mês fica em branco na coleção e nada é tirado.

Regras das missões:
- **Nenhuma missão é de volume de trabalho.** Atendimento e receita não entram em missão.
  Só organizar, guardar, proteger, descansar e conectar.
- **No máximo 1 das 3 missões de cada mês depende de outras pessoas** (as de comunidade,
  marcadas com ◆). As outras duas dependem só dela.
- O progresso conta só o que aconteceu **dentro do mês**, pelos contadores do mês (§8).

| Mês | Enfeite | Missão 1 | Missão 2 | Missão 3 |
| --- | ------- | -------- | -------- | -------- |
| Janeiro | Faísca de janeiro | Planejar 8 dias | Lançar 10 despesas | Tirar 2 descansos |
| Fevereiro | Coração de fevereiro | Guardar dinheiro em 3 semanas | Guardar 4 comprovantes no Cofre | ◆ Sua dica ajudar 2 vezes |
| Março | Broto de março | Planejar 6 dias | Ter 10 dias fortes | Guardar 3 comprovantes no Cofre |
| Abril | Luz de abril | Guardar dinheiro em 4 semanas | Lançar 12 despesas | Tirar 2 descansos |
| Maio | Paleta de maio | Guardar 5 comprovantes no Cofre | Planejar 8 dias | ◆ Sua dica proteger alguém 1 vez |
| Junho | Sol de junho | Tirar 3 descansos | Guardar dinheiro em 3 semanas | Ter 2 semanas firmes |
| Julho | Onda de julho | Lançar 10 despesas | Planejar 6 dias | Ter 12 dias fortes |
| Agosto | Moeda de agosto | Guardar dinheiro em 4 semanas | Guardar 5 comprovantes no Cofre | Tirar 2 descansos |
| Setembro | Sino de setembro | Planejar 8 dias | Ter 3 semanas firmes | ◆ Sua dica ajudar 3 vezes |
| Outubro | Lua de outubro | Tirar 3 descansos | Lançar 12 despesas | Guardar 4 comprovantes no Cofre |
| Novembro | Folha de novembro | Guardar dinheiro em 4 semanas | Planejar 6 dias | Ter 10 dias fortes |
| Dezembro | Estrela de dezembro | Tirar 3 descansos | Guardar dinheiro em 2 semanas | ◆ Sua dica ajudar ou proteger 2 vezes |

"Guardar dinheiro em N semanas" = N semanas diferentes do mês (segunda a domingo) com pelo
menos um valor guardado numa meta. Semana que atravessa a virada do mês conta para o mês
em que ela termina.

---

## 7. Metas e marcos de dinheiro

- **Concluir uma meta de dinheiro:** +100 Glow, uma vez por meta.
- **Marcos de dinheiro guardado** (soma do que está guardado em todas as metas, em euro):

| Marco | Glow |
| ----- | ---- |
| € 500 | +50 |
| € 1.000 | +50 |
| € 2.500 | +50 |
| € 5.000 | +50 |

- **Cada marco conta UMA vez na vida.** Se o saldo cair abaixo do marco e subir de novo, não
  dá Glow outra vez. O marco alcançado fica registrado e nunca é retirado.
- Os valores vêm do dinheiro **de verdade** dela (as metas que já existem no app).

---

## 8. O que é guardado no banco — e o que NÃO é

### Guardado (só contadores, estado e conquistas)

- **Glow total** e **Glow por pilar** (4 números).
- **Contadores de vida inteira** por ação e por selo (os que alimentam a §5).
- **Contadores do dia corrente** por ação, só para o limite diário. São **sobrescritos** na
  virada do dia; o dia anterior não fica guardado.
- **Contadores do período corrente** (semana, mês e ano) usados nas missões e nos resumos,
  e **um retrato agregado do último período fechado** de cada tipo (última semana, último
  mês, último ano), para o resumo. São números agregados ("12 despesas na semana"), nunca
  "o que ela fez em cada dia".
- **Nível de cada selo** e quando ele foi conquistado (mês/ano, para a coleção).
- **Capítulos fechados** (mês/ano → enfeite) — a coleção.
- **Marcos de dinheiro alcançados** (quais dos 4).
- **Itens destravados** por estágio.
- **Preferências:** som, Modo discreto, estágio e selos no perfil público (opt-in,
  desligados por padrão), Jornada de Começo.
- **Fuso horário** dela, para as viradas de dia/semana/mês.

### NÃO guardado, nunca

- **Nenhum diário:** nenhuma linha por ação com data e hora, nenhuma lista de "o que ela fez
  em cada dia", nenhum histórico de dias passados além dos agregados acima.
- Nenhum dado de atendimento além do contador de dias ativos (cliente, valor e horário
  continuam só onde já estão hoje, fora da Jornada).
- Nenhuma identidade nos contadores de "Isso me ajudou" / "Isso me protegeu": só o número,
  visível só para a autora.
- O estágio não é guardado à parte (é calculado do Glow total).

### Onde a decisão acontece

O servidor decide tudo (Glow, limite, selos, missões, marcos), numa transação por ação,
a partir do usuário autenticado. O cliente só registra a ação e mostra o resultado.

---

## 9. Textos, moeda e tradução

- Todos os textos da Jornada (nomes de estágio, selos, missões, enfeites, mensagens) e o
  símbolo de moeda ficam em `lib/jornada/textos.ts`. Componentes nunca escrevem texto ou
  `€` direto.
- PT-BR e euro na Fase 2. Outros idiomas e moedas são decisão futura.

---

## 10. Mapa J09–J16

| Ticket | Entrega |
| ------ | ------- |
| **J09** (#159) | Migrations: tabelas de contadores (vida, dia, períodos e retratos), selos, capítulos, marcos, itens destravados e preferências — só o que a §8 permite. |
| **J10** (#160) | RPCs do motor no servidor: recebe a ação, aplica limite diário, concede Glow e a cascata (selos, missões, capítulo, marcos, estágio) numa transação. |
| **J11** (#161) | Camada cliente: estado, cache e registro de ação (`lib/jornada/*`, `useJornada`), mais `textos.ts`. |
| **J12** (#162) | Tela "Sua Jornada" e o card no Início (sem 6ª aba). |
| **J13** (#163) | Comemorações, sons e Modo discreto. |
| **J14** (#164) | Resumos da semana, do mês e do ano. |
| **J15** (#165) | Ligar o motor às ações reais do app (despesa, receita, meta, Cofre, descanso, atendimento, dicas). |
| **J16** (#166) | Regressão e smoke autenticado da Jornada. |
