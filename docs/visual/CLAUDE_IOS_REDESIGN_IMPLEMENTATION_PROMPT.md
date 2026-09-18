# Prompt de implementação — redesign iOS do JobApp

Use este texto apenas quando o trabalho técnico que já está em andamento no app estiver estabilizado. O protótipo visual não deve ser misturado às correções abertas.

## Prompt para o Claude

Implemente no aplicativo real o redesign iOS aprovado em `design/ios-quase-nativo-prototype`, usando como referências obrigatórias:

1. `docs/visual/IOS_REDESIGN_FUNCTIONAL_PARITY.md` — contrato de escopo e paridade funcional;
2. `components/ios-prototype/IosPrototypeApp.tsx` — hierarquia, navegação e estados visuais aprovados;
3. `components/ios-prototype/IosPrototypeApp.module.css` — linguagem visual aprovada;
4. o aplicativo real atual — fonte de verdade para regras de negócio, dados, permissões, APIs, erros e estados assíncronos.

### Regras obrigatórias

- Não copiar dados fictícios do protótipo para produção.
- Não criar schema, migration, API, preferência ou regra de negócio só porque há conteúdo ilustrativo no protótipo.
- Não remover, duplicar nem inventar funções. Uma função pode mudar de posição e aparência, mas deve manter o comportamento real.
- A barra inferior continua com exatamente cinco destinos: Início, Agenda, Financeiro, Cofre e Rede. Ajustes sai da barra e abre pelo avatar da Início.
- O avatar da Rede abre o perfil da Rede. Recursos privados do perfil ficam no menu de três pontos.
- Live Links deve permanecer discreto, em uma linha entre bio e ações, no padrão aprovado.
- O Cofre continua protegido pelo PIN e a barra inferior não aparece na tela de PIN.
- Login, onboarding, recap, instalação, permissões e gate da Rede continuam existindo mesmo quando não estiverem representados no mockup principal.
- Reutilizar os componentes e serviços reais. O protótipo é referência visual e de fluxo, não uma base alternativa do produto.
- Não fazer merge, deploy, migration nem tocar produção sem autorização explícita.

### Ordem de implementação

1. Criar os tokens visuais compartilhados e a nova estrutura de navegação, sem alterar regras de negócio.
2. Migrar Início, Agenda e Financeiro mantendo todos os estados e formulários existentes.
3. Migrar Cofre e PIN, comprovando bloqueio, retorno e formatos aceitos.
4. Migrar Rede, perfil, Live Links, conversas, notificações e visualizador de fotos.
5. Migrar Ajustes e as superfícies externas: login, onboarding, recap, instalação, permissões e gates.
6. Remover somente código visual antigo comprovadamente sem uso depois da paridade completa.

### Validação por etapa

- Rodar typecheck, lint e testes existentes da área.
- Comparar a tela implementada com `/dev-preview/ios` em viewport mobile.
- Exercitar os caminhos reais, inclusive vazio, carregando, erro, offline e permissão negada quando aplicável.
- Confirmar que cada função listada no contrato tem destino e comportamento.
- Registrar divergências inevitáveis antes de avançar; não improvisar uma solução funcional nova.

### Critério de conclusão

O redesign está concluído somente quando a aparência segue o protótipo aprovado e a matriz de `IOS_REDESIGN_FUNCTIONAL_PARITY.md` estiver integralmente atendida, sem regressão funcional e sem funcionalidades extras.
