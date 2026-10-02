# Checklist de aceite

## Portão zero: invariantes

- [ ] Login, sessão, logout e recuperação continuam funcionando.
- [ ] Onboarding mantém ordem, persistência e retomada.
- [ ] PIN mantém bloqueio, criação, validação e recuperação previstos.
- [ ] Cofre não expõe conteúdo antes da autorização.
- [ ] Nenhum dado de Agenda, Financeiro, Cofre ou Rede é perdido ou reescrito.
- [ ] Nenhuma alteração de schema, policy, migration, bucket ou variável de ambiente foi introduzida pelo redesign.
- [ ] Barra inferior contém exatamente cinco itens e Ajustes abre pelo avatar.
- [ ] As ações antes ligadas ao FAB continuam chamando os callbacks reais.

## Matriz visual mínima

Validar cada tela em 375 × 667, 393 × 852 e 430 × 932:

- Início: preenchida, vazia, loading e erro.
- Agenda: lista/calendário, vazia, formulário/sheet e erro.
- Financeiro: visão principal, cada subtab relevante, vazio e formulário.
- Cofre: bloqueado, desbloqueado, vazio, com arquivos e upload.
- Rede: feed, vazio, loading, erro, post com uma foto, duas fotos e viewer.
- Ajustes: lista principal, detalhe/sheet e retorno para a origem.

Meta de evidência: pelo menos 42 capturas, nomeadas por tela, viewport e estado. Os mockups são comparação conceitual de hierarquia e aparência; só depois da aprovação humana as capturas reais viram baselines de pixel.

## Critérios por tela

### Início

- [ ] Saudação e avatar têm prioridade correta.
- [ ] Projeção e progresso usam dados existentes.
- [ ] Próximo atendimento continua acionável.
- [ ] Objetivos preservam criação e edição.
- [ ] Liberdade/viagem aparece como narrativa de resultado, sem dominar a utilidade.

### Agenda

- [ ] Datas, horários, cliente, local e valor continuam legíveis.
- [ ] Criar, editar, concluir e cancelar mantêm comportamento atual.
- [ ] O CTA não fica escondido atrás da barra inferior ou safe area.

### Financeiro

- [ ] Totais, moeda e sinais positivos/negativos estão corretos.
- [ ] Filtros e subtabs preservam estado na troca de aba.
- [ ] Gráficos possuem alternativa textual.
- [ ] Ações de cada subtab mantêm o destino correto.

### Cofre

- [ ] Conteúdo bloqueado nunca pisca antes da autorização.
- [ ] Upload, download, visualização e exclusão mantêm confirmação e feedback.
- [ ] Nomes longos e arquivos vazios não quebram o layout.

### Rede

- [ ] Feed, paginação, fotos, viewer, curtidas, comentários e chat continuam funcionais.
- [ ] Uma e duas fotos mantêm grade e aspect ratio aprovados.
- [ ] Loading da imagem não faz salto de layout.
- [ ] Bloqueio e permissões continuam respeitados.

### Ajustes

- [ ] Avatar abre Ajustes com nome acessível.
- [ ] Voltar retorna à tela e posição anteriores.
- [ ] Conta, segurança, tema e preferências existentes continuam disponíveis.

## Acessibilidade

- [ ] Um `h1` por tela e landmarks válidos.
- [ ] Navegação usa semântica e item ativo usa `aria-current`.
- [ ] Todo ícone acionável tem nome acessível.
- [ ] Alvos de toque têm no mínimo 44 × 44 px.
- [ ] Foco visível em teclado; ordem de foco acompanha a tela.
- [ ] Sheets e dialogs prendem foco, fecham com Escape e restauram foco.
- [ ] Sheets fechados ficam inertes.
- [ ] Interface funciona a 200% de zoom.
- [ ] `prefers-reduced-motion` remove movimento não essencial.
- [ ] Nenhum estado depende apenas de cor.
- [ ] Swipe possui alternativa por botão.

## Desempenho e estabilidade

- [ ] Trocar aba não dispara chamadas de rede desnecessárias.
- [ ] Imagens fora da viewport usam carregamento preguiçoso quando adequado.
- [ ] Nenhum efeito pesado ou biblioteca visual grande foi adicionado sem justificativa.
- [ ] Sem layout shift perceptível; alvo CLS ≤ 0,10.
- [ ] Alvo INP ≤ 200 ms e LCP ≤ 2,5 s em cenário representativo.
- [ ] Aumento do bundle inicial ≤ 30 KB gzip, salvo justificativa registrada.
- [ ] Nenhuma métrica principal piora mais de 10% sem aprovação.

## Verificações automatizadas

Executar na raiz do worktree de implementação:

```powershell
npm run typecheck
npm test
npm run build
node C:\Users\miguel\.agents\skills\impeccable\scripts\detect.mjs --json app components styles
```

Preservar ou adaptar deliberadamente os testes existentes de casca visual, Início, Agenda, Financeiro, Cofre, Rede, Ajustes, focus trap, barra compacta, Rede completa, onboarding, PIN, instalação e autenticação.

Adicionar testes específicos para:

- cinco itens na barra e ausência de Ajustes;
- avatar abre Ajustes e Voltar restaura origem;
- CTAs contextuais chamam os callbacks antigos;
- área mínima de toque;
- estado ativo acessível;
- sheets ocultos não focáveis;
- estado das telas preservado ao trocar aba;
- ausência de dados fictícios hardcoded no app real;
- ausência de regressão em fotos, PIN, Cofre e chat.

## Critério de liberação

Só declarar pronto quando todos os P0 passarem, não houver regressão funcional conhecida e o usuário aprovar visualmente as seis telas. Merge e deploy permanecem decisões separadas e explícitas.

