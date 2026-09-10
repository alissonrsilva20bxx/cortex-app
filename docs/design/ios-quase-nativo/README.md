# JobApp — redesign iOS quase nativo

Este diretório é a fonte de verdade para o refinamento visual do JobApp. Ele transforma a direção aprovada em um contrato executável, preservando as funções e os dados reais do aplicativo.

## Estado e limite desta branch

- Esta branch contém **somente documentação e referências visuais**.
- Nenhuma tela, regra de negócio, migration, variável de ambiente ou configuração de produção foi alterada.
- O trabalho atual do Claude em bugs e no aplicativo final tem precedência. A implementação visual só começa depois que esse trabalho terminar e um commit-base limpo for registrado.
- Durante a implementação, o **Claude será o único escritor do código**. Os agentes GPT podem analisar, revisar e testar, mas não editar os mesmos arquivos em paralelo.
- Merge, deploy, mudanças em `master`, Supabase, Vercel, retenção, cron ou fila exigem autorização explícita do usuário.

## Norte do produto

O JobApp deve parecer um produto mobile maduro, familiar para quem usa iPhone há anos, sem tentar copiar literalmente um aplicativo da Apple. A experiência deve comunicar:

1. organização do trabalho;
2. crescimento de renda;
3. liberdade de tempo e localização;
4. possibilidade de viajar e viver melhor.

Planeta, avião e países pertencem a essa narrativa, desde que apareçam como consequência do progresso profissional — não como decoração turística genérica.

## Decisões aprovadas

- Direção: iOS contemporâneo, escuro, vinho/preto, com rosa como cor de ação e progresso.
- Navegação inferior: manter o modelo atual inspirado no Instagram, flutuante, icon-only e compacto ao rolar.
- Itens da barra: **Início, Agenda, Financeiro, Cofre e Rede**.
- Ajustes sai da barra inferior e passa a abrir pelo avatar no cabeçalho.
- O avatar deve ser um botão semântico com área mínima de toque de 44 × 44 px.
- O botão flutuante global só pode ser removido depois que cada ação existente for realocada no contexto correto.
- Não inventar valores, funções ou dados. Os mockups são autoridade visual e de hierarquia, não autoridade de conteúdo.
- Preservar autenticação, onboarding, PIN, Cofre, dados, feed, fotos, chat, financeiro e todos os estados funcionais atuais.
- Temas existentes não serão removidos até uma decisão de produto explícita. O protótipo pode usar a direção vinho/rosa de forma local.

## Referências aprovadas

| Tela | Referência |
|---|---|
| Início | [mockups/home.png](mockups/home.png) |
| Agenda | [mockups/agenda.png](mockups/agenda.png) |
| Financeiro | [mockups/financeiro.png](mockups/financeiro.png) |
| Cofre | [mockups/cofre.png](mockups/cofre.png) |
| Rede | [mockups/rede.png](mockups/rede.png) |
| Ajustes | [mockups/ajustes.png](mockups/ajustes.png) |

## Protótipo navegável aprovado

- Branch: `design/ios-quase-nativo-prototype`
- PR: [#114](https://github.com/alissonrsilva20bxx/cortex-app/pull/114)
- Commit visual aprovado: `c1898fe`
- Aprovação do proprietário: **2026-09-10**
- Escopo da aprovação: direção visual das seis telas, navegação entre abas e barra inferior no modelo original com cinco destinos; Ajustes permanece acessível pelo avatar.

Essa aprovação congela a direção visual. Ela não substitui a matriz técnica de estados, acessibilidade e regressão prevista no `QA_CHECKLIST.md`, nem autoriza merge, deploy ou portabilidade para o app real.

## Documentos de execução

- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md): tokens, tipografia, espaçamento, superfícies, movimento e acessibilidade.
- [IMPLEMENTATION_MAP.md](IMPLEMENTATION_MAP.md): ordem segura, dependências, ownership e áreas protegidas.
- [QA_CHECKLIST.md](QA_CHECKLIST.md): critérios de aceite funcionais, visuais, acessíveis e de desempenho.
- [CLAUDE_EXECUTION_PROMPT.md](CLAUDE_EXECUTION_PROMPT.md): prompt canônico para o agente escritor executar a mudança sem perder contexto.

## Regra de retomada

Antes de qualquer código visual:

1. terminar o trabalho de bugs em andamento;
2. registrar branch e SHA exatos aprovados como base;
3. confirmar working tree limpo;
4. abrir worktree e branch exclusivos para o redesign;
5. construir primeiro uma rota de protótipo isolada;
6. obter aprovação humana das seis telas;
7. só então portar o sistema aprovado para as telas reais.
