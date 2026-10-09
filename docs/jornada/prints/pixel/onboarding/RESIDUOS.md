# Onboarding "Linha do tempo": medição contra o desenho

Desenho: `docs/jornada/referencias/onboarding-linha-do-tempo.html` (cópia
idêntica do aprovado). Medidor: `tests/visual/pixel/onboarding.mjs`
(pixelmatch YIQ, limiar 0,1), pink-neon, 390 e 430, claro e escuro.
Números em `resultado.json`.

| Tela | Diferença |
| --- | --- |
| Boas-vindas | 0,0002% |
| O que está incluso | 0% a 0,013% |
| Linha do tempo | 0% a 0,002% |
| Planos: lista | 0,003% a 0,005% |
| Planos: botões | 0,0003% |
| Pílula (dias 7, 3 e 1) | 0,89% a 0,98% |
| Planos: tela inteira | 7,9% a 10,7% |

## Resíduos

- **Planos, tela inteira:** dados. O desenho fixa "12 atendimentos · € 430 ·
  3 recibos" no topo; o app mostra os números da conta (os do laboratório).
  Por isso a medição se divide em lista e botões, alinhados pelo topo da
  lista.
- **Pílula:** o ícone do presente. Isolada num fundo liso, o desenho não
  desenha o ícone (o sprite do desenho não aparece fora do celular dele); o
  app desenha. O texto, os pontinhos e o vidro batem.
- **"Ver planos" no último dia, escuro:** o desenho fixa #d6105c em cima do
  acento. No app é o acento escurecido (`color-mix(--t-acc 84%, #000)`) no
  escuro e `--t-deep` no claro, para seguir os 8 temas com contraste.
- **Fonte:** o desenho não carrega a Plus Jakarta; o medidor injeta o
  arquivo da própria fonte do app nele.
- **Antisserrilhado:** o desenho rendia em tons de cinza e o app em
  subpixel (LCD); o medidor abre o Chrome com `--disable-lcd-text` para
  comparar igual.

## Temas

`temas/`: a primeira tela nos 8 temas, claro e escuro (390). O botão e os
destaques seguem `--t-acc`; o "J" é o ícone do app, marca fixa em todos os
temas, como no desenho.
