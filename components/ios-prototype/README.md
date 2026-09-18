# Protótipo visual iOS quase nativo

Protótipo descartável das telas aprovadas. Ele responde à pergunta “como o novo JobApp deve parecer e onde cada função existente deve continuar acessível?”.

- Rota: `/dev-preview/ios`
- Dados: totalmente simulados e mantidos em memória
- Backend: nenhuma chamada
- Base inicial: `ddef989102d9a525787110b6e00efd67b6da23c1`
- Integração no app real: proibida até a base pós-correções do Claude ser congelada e o usuário aprovar o protótipo

Para executar no ambiente local, use o comando de desenvolvimento normal do projeto. A rota precisa apenas das variáveis públicas mínimas exigidas pelo middleware do repositório; não use credenciais de produção para avaliar este protótipo.

As ações exibidas são demonstrativas. Estão implementadas em memória:

- navegação entre as cinco abas e abertura/retorno de Ajustes pelo avatar;
- sheets de atendimento, objetivo, movimentação, upload/arquivo, publicação e perfil;
- busca, notificações e conversas da Rede;
- troca de dia, mês, subaba financeira, filtro do Cofre e filtro do feed;
- feedback visual de confirmação, sem persistência;
- seletor externo de estados preenchido, vazio, carregando e erro para inspeção visual.

Nenhuma dessas interações grava dados ou reproduz regras de negócio. Elas existem somente para aprovar aparência, hierarquia e fluxo antes da implementação real.

O inventário obrigatório e as proibições de escopo estão em `docs/visual/IOS_REDESIGN_FUNCTIONAL_PARITY.md`. A implementação real deve usar esse documento e o app atual como fontes de verdade; não deve inferir funcionalidades a partir de textos ou dados ilustrativos do protótipo.

Quando chegar a hora de transferir o redesign para o app real, use `docs/visual/CLAUDE_IOS_REDESIGN_IMPLEMENTATION_PROMPT.md`. O prompt referencia este protótipo e o contrato de paridade sem misturar o redesign às correções técnicas que ainda estiverem em andamento.
