# Comparação de pixel: mockup × app

Ferramenta para fechar as 5 telas no pixel contra o mockup normativo.

**Referência normativa:** `docs/jornada/referencias/5-telas-8-temas-claro-escuro.html`
(5 telas, 8 temas, claro e escuro). Onde o mockup e o app divergem, **o mockup vence**.

## Antes de rodar

1. Um `next dev` já no ar (a ferramenta **nunca** sobe servidor). Padrão: `http://localhost:3103`.
2. Nada de `npm install`: o Playwright vem do cache do npx e o Chromium do `ms-playwright`.
   Se os caminhos mudarem, use `PIXEL_PLAYWRIGHT` e `PIXEL_CHROME`.

## Rodar

```bash
node tests/visual/pixel/comparar.mjs --tela=cofre
node tests/visual/pixel/comparar.mjs --telas=todas --largura=390 --modo=claro --tema=pink-neon
node tests/visual/pixel/comparar.mjs --tela=rede --modo=escuro --tema=ocean --base-url=http://localhost:3105
```

| opção           | padrão                      |                                                                                  |
| --------------- | --------------------------- | -------------------------------------------------------------------------------- |
| `--tela=`       | `inicio`                    | `inicio\|agenda\|financeiro\|cofre\|rede` (aceita lista com vírgula)             |
| `--telas=todas` | —                           | as 5 de uma vez                                                                  |
| `--largura=`    | `390`                       | `390` ou `430`                                                                   |
| `--modo=`       | `claro`                     | `claro` ou `escuro`                                                              |
| `--tema=`       | `pink-neon`                 | um dos 8                                                                         |
| `--base-url=`   | `http://localhost:3103`     | onde está o `next dev`                                                           |
| `--saida=`      | `docs/jornada/prints/pixel` |                                                                                  |
| `--limiar=`     | `0.1`                       | limiar do pixelmatch (0 a 1)                                                     |
| `--inteira`     | —                           | compara o conteúdo rolável inteiro, não só a 1ª dobra                            |
| `--so-pixel`    | —                           | pula o dump de estilos (bem mais rápido)                                         |
| `--sem-jornada` | —                           | no Início, esconde o card "Sua Jornada" (o mockup das 5 telas não tem esse card) |
| `--json`        | —                           | só o JSON no stdout                                                              |

## O que sai, em `<saida>/<tela>/`

> **A ferramenta só escreve dentro de `<saida>/<tela>/`, e nunca apaga nada.**
> A raiz de `--saida` é compartilhada por todas as telas — arquivo solto ali,
> ou uma limpeza da pasta antes de medir, já apagou por acidente a evidência
> de PRs alheias. Para medir uma tela, aponte `--saida` ou confie no padrão:
> cada tela escreve só na pasta dela, inclusive o `resumo-*.json`.

| arquivo                                     |                                                    |
| ------------------------------------------- | -------------------------------------------------- |
| `<tela>-<largura>-<modo>-<tema>-mockup.png` | o recorte do mockup                                |
| `...-app.png`                               | o mesmo recorte do app                             |
| `...-diff.png`                              | o que difere, em vermelho, sobre a base clareada   |
| `...-estilos.md`                            | estilo computado lado a lado, ordenado por impacto |
| `...-resultado.json`                        | tudo em número                                     |

## Como ler

**`difPct`** é a porcentagem da área cujos pixels diferem. **A meta do ticket é < 0,5%.**

A métrica é **a do pixelmatch**: distância **YIQ** contra `35215 × limiar²`, com limiar
**0,1** (o padrão da biblioteca). É a mesma que os harnesses das telas usam (#204, #206),
então os números desta ferramenta são **comparáveis com os deles**. Quando as duas
imagens têm tamanhos diferentes, a área comparada é a união: o que existe só de um lado
conta como diferente.

**`impacto`** ordena a lista de estilos:

```
impacto = (soma das diferenças normalizadas) × √(área relativa do elemento)
```

Cada propriedade tem um divisor explícito em `GRAVIDADE` (no topo do `.mjs`) para que
coisas de naturezas diferentes fiquem comparáveis — 3px de `fontSize` valem 3; uma
distância RGB de 60 vale 1. Nenhuma propriedade sozinha passa de `TETO_POR_PROPRIEDADE`
(10), senão um `border-radius: 9999px` contra `0px` engoliria o ranking inteiro.

Os elementos são pareados primeiro **pelo texto próprio** (com os números mascarados,
porque o dado do laboratório não é o mesmo do mockup: `R$ 430` e `R$ 150` pareiam), e o
que sobra é pareado **pela geometria** (centro perto, tamanho parecido).

## O relógio

O mockup desenha **quarta, 23/09/2026, 10h**. A ferramenta congela o relógio nesse
instante (`page.clock.setFixedTime`) **antes do `goto`**, nos dois lados — sem isso as
datas, o "em N dias" e o próximo atendimento mudariam a cada dia que ela roda, e o
número não seria reprodutível. É o mesmo instante que os harnesses das telas usam.

## Teste

As funções puras (pareamento, normalização, métrica de pixel) têm teste próprio:

```bash
node --test tests/visual/pixel/comparar.test.mjs
```

Roda no runner embutido do Node — sem dependência, sem `npm install` e sem servidor.
Não entra no vitest de propósito: o `include` do projeto é `tests/**/*.test.ts`, e os
harnesses visuais (`.mjs`) ficam fora dele por convenção.

## Dois cuidados que a ferramenta já toma

- **A fonte.** O mockup carrega a Plus Jakarta Sans do Google Fonts. Se ela não carregar,
  _toda_ letra divergiria e a medição não valeria nada — então isso é **erro duro**, não
  aviso. O nome gerado pelo `next/font` (`__plus_jakarta_sans_a11773`) é normalizado para
  `plus jakarta sans`, senão a mesma fonte apareceria como divergência em todo elemento.
- **Animação.** Transições e animações são desligadas dos dois lados antes do recorte.

## Limite conhecido: 430px

O mockup é desenhado em **390×844**. Em `--largura=430` a ferramenta força a largura do
`.ph` e deixa o mockup refluir, o que é uma **aproximação** — o `resultado.json` marca
`reflowDoMockup: true`. Para número normativo, use 390; em 430 confie mais no dump de
estilos (família, tamanho, peso, cor não dependem da largura) do que no `difPct`.

## Escopo

Esta pasta é **só a ferramenta**. A aplicação dela em cada tela mora na PR da tela.
