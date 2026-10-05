---
titulo: "J08 — Spec da gamificação \"Sua Jornada\" aprovada"
labels: tipo:decisao, requer-decisao-humana, area:backend, bloqueado
bloqueado_por: J07
trabalhadora: humano
---

## Por que este ticket é uma porteira

A Fase 2 inteira (J09 a J16) constrói o motor da gamificação. Isso significa **migration no
banco**, RPCs novas e estado novo no cliente. Nada disso se desfaz de graça. Então o
desenho tem que estar fechado **antes**, por escrito, e aprovado pelo humano. Enquanto a
spec não existir e não for aprovada, construir o motor é apostar.

## O que já está decidido e não reabre

O protótipo foi aprovado em 02/10/2026 (`docs/jornada/referencias/prototipo-sua-jornada.html`),
com intensidade "na medida", sons "gostei", e "ótimo do jeito que está". Decisões fechadas:

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
17. Idioma e moeda: o protótipo é PT-BR com `€`. Trocar idioma/moeda é decisão **futura** e
    está fora da Fase 2 — mas tudo que for escrito agora nasce **traduzível** (texto e
    moeda num lugar só, nunca espalhados pelo componente).

## O que falta decidir (humano)

- [ ] Rodar `/to-spec` pra transformar as decisões acima num documento em
      `docs/jornada/spec-sua-jornada.md`, commitado em `feature/jornada`.
- [ ] Confirmar os números finais (valores de Glow, limites por dia, os cortes de estágio,
      as 3 missões de cada mês). Os valores do protótipo são a proposta, não a lei.
- [ ] Decidir **se a Fase 2 começa agora ou espera**. Está explicitamente permitido
      concluir que o desenho precisa mudar antes de virar código. Jogar fora um protótipo
      custa um dia; jogar fora um motor com migration custa semanas.

## Aceite

- [ ] `docs/jornada/spec-sua-jornada.md` existe, commitado, e responde: cada ação com seu
      Glow e seu limite diário; a lista de selos e os critérios de cada nível; os cortes de
      estágio; as 3 missões de cada um dos 12 meses; os marcos de dinheiro; o que é guardado
      no banco e o que **não** é.
- [ ] O humano escreveu, no fechamento, "spec aprovada, Fase 2 liberada".

## Enquanto este ticket estiver aberto

J09 a J17 **não podem** ser distribuídos. Nenhuma migration da Jornada é escrita.
