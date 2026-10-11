# Sistema visual

## Princípios

- Hierarquia vem de tipografia, espaço e contraste; não de bordas em excesso.
- Superfícies de conteúdo são sólidas ou levemente translúcidas. Vidro fica restrito à navegação, sheets e overlays.
- Rosa significa ação, seleção ou progresso. Verde, amarelo, vermelho e azul ficam reservados aos estados semânticos.
- O layout deve respirar como uma interface nativa, mantendo personalidade própria do JobApp.

## Tokens de cor

```css
:root {
  --ja-bg: #100107;
  --ja-bg-deep: #080004;
  --ja-bg-elevated: #19040c;
  --ja-bg-highlight: #260914;

  --ja-accent: #ff2d78;
  --ja-accent-strong: #ff1f68;
  --ja-accent-soft: #ff78aa;
  --ja-accent-pressed: #d91d5f;

  --ja-text-primary: #fff7fa;
  --ja-text-secondary: #d8c3cc;
  --ja-text-tertiary: #a98f9a;
  --ja-text-disabled: #725e67;
  --ja-text-on-accent: #ffffff;

  --ja-success: #53d77b;
  --ja-warning: #ff9f0a;
  --ja-danger: #ff5a67;
  --ja-info: #64a8ff;

  --ja-surface-1: rgba(255, 255, 255, 0.045);
  --ja-surface-2: rgba(255, 255, 255, 0.070);
  --ja-surface-3: rgba(255, 255, 255, 0.095);
  --ja-surface-accent: rgba(255, 45, 120, 0.12);
  --ja-border: rgba(255, 255, 255, 0.095);
  --ja-divider: rgba(255, 255, 255, 0.075);
}
```

Não aplicar esses tokens globalmente no protótipo. Eles devem viver no escopo da rota isolada até a aprovação e a decisão sobre compatibilidade com os temas existentes.

## Tipografia

Use a fonte do sistema para toda interface. Plus Jakarta Sans pode permanecer apenas em marca ou métricas especiais.

| Papel | Tamanho/linha | Peso |
|---|---:|---:|
| Large title | 34/41 | 700 |
| Title 1 | 28/34 | 700 |
| Title 2 | 22/28 | 700 |
| Title 3 | 20/25 | 600 |
| Headline | 17/22 | 600 |
| Body | 17/22 | 400 |
| Callout | 16/21 | 400–500 |
| Subheadline | 15/20 | 400–500 |
| Footnote | 13/18 | 400 |
| Caption | 12/16 | 400–500 |
| Métrica XL | 40/44 | 700 |

## Espaço, tamanho e raio

- Escala de espaço: 4, 8, 12, 16, 20, 24, 32, 40 e 48 px.
- Margem lateral: 16 px no iPhone SE; 20 px a partir de 390 px.
- Distância entre seções: 24–32 px.
- Padding de cards: 20 px; 16 px em telas estreitas.
- Linhas simples: mínimo 56 px. Linhas com detalhe: 60–64 px.
- Largura de referência do shell mobile: máximo 430 px.
- Raios: controles 12, grupos 16, cards 20, hero 24, sheets 28 e pills 999 px.
- Todo alvo de toque deve medir pelo menos 44 × 44 px.

## Navegação inferior

- Cinco itens: Início, Agenda, Financeiro, Cofre e Rede.
- Estados expandido e compacto preservam o comportamento atual.
- Expandida: margem lateral 20 px, item ativo 56 px.
- Compacta: margem lateral 44 px, item ativo 44 px.
- Itens inativos: 44 px.
- Fundo: `rgba(16, 1, 7, 0.82)`, blur aproximado de 28 px e borda neutra.
- Ativo: fundo rosa e ícone branco. Nunca depender apenas da cor para comunicar o item atual; usar `aria-current`.

## Movimento e feedback

- Press: 100–140 ms, com opacidade e escala discretas.
- Troca de aba: 180–220 ms.
- Sheet: cerca de 300 ms.
- `prefers-reduced-motion`: remover deslocamentos e reduzir a duração praticamente a zero.
- Não animar blur continuamente. Não bloquear interação durante animações.
- Loading, vazio, erro e sucesso precisam ter texto compreensível; não depender apenas de cor ou spinner.

## Acessibilidade

- Um `h1` por tela e landmarks semânticos.
- Ícones sem texto visual precisam de nome acessível.
- Diálogos prendem foco, fecham com Escape e devolvem foco ao acionador.
- Sheets fechados não podem permanecer focáveis.
- Zoom do navegador não pode ser desabilitado; validar a 200%.
- Conteúdo e ações devem continuar utilizáveis em 375 × 667, 393 × 852 e 430 × 932.
- Gestos de swipe precisam de alternativa visível e acionável.

