# Redesign iOS — contrato de paridade funcional

## Objetivo

Aplicar o visual iOS aprovado ao JobApp sem remover, duplicar ou inventar funções. O protótipo em `/dev-preview/ios` define aparência, hierarquia e destinos. O aplicativo atual continua sendo a fonte de verdade das regras de negócio, persistência, permissões e estados de erro.

## Regra central

Uma função pode mudar de posição e aparência, mas não pode desaparecer. Elementos novos só podem ser implementados quando forem derivados de dados já existentes. Não criar tabela, API, preferência ou regra de negócio apenas porque apareceu conteúdo ilustrativo no protótipo.

## Navegação global

- A barra inferior tem exatamente cinco destinos: Início, Agenda, Financeiro, Cofre e Rede.
- Ajustes fica fora da barra e abre pelo avatar na Início.
- O avatar da Rede abre o perfil da Rede, não Ajustes.
- O menu de ferramentas do perfil concentra os recursos privados que não devem poluir o perfil público.
- A barra inferior desaparece durante PIN e quando o teclado do chat exigir o comportamento já existente.
- Posição de rolagem e aba de origem são preservadas ao abrir e fechar telas secundárias.

## Início

Preservar:

- saudação e avatar de acesso a Ajustes;
- projeção baseada em atendimentos e metas, com acesso ao Financeiro;
- próximo atendimento com comportamento expansível;
- objetivos pessoais, conclusão de objetivo e acesso à aba Metas;
- criação de atendimento;
- convite de instalação quando aplicável;
- estados sem atendimento, carregando e erro.

Não duplicar a criação de atendimento em mais de uma ação concorrente na mesma tela.

## Agenda

Preservar:

- criar, abrir e editar atendimento;
- campos Cliente, Data, Hora, Valor, Modalidade, Local, Status e Observações;
- semana anterior e próxima, seleção de dia e indicação do dia atual;
- filtros Todos, Agendado, Confirmado, Concluído e Cancelado;
- resumo/gráfico por semana, mês e ano;
- anotações livres;
- totais e estados vazio, carregando e erro.

## Financeiro

Preservar as quatro subáreas reais:

- Visão: saldo, entradas, saídas e gráfico por período;
- Entradas: listar, criar e excluir entrada;
- Saídas: listar, criar e excluir despesa;
- Metas: editar metas financeiras, criar objetivo pessoal e marcar objetivo como concluído.

Uma “movimentação genérica” no protótipo representa os formulários reais separados de entrada e saída. Não unificar banco ou regras de negócio.

## Cofre

Preservar:

- bloqueio por PIN ao entrar quando houver PIN configurado;
- bloqueio novamente ao sair da área ou perder foco conforme regra existente;
- busca por nome;
- categorias Todos, Comprovantes, Conversas, Documentos e Pessoal;
- upload de imagem, PDF, Office e texto;
- abertura segura do arquivo e renovação de URL quando aplicável;
- estados vazio, carregando e erro.

Não implementar “Contratos” como nova categoria. Não implementar compartilhamento de arquivo: essa função não existe no produto atual.

## Rede — feed

Preservar:

- gate de acesso, convite e estados sem acesso/indisponível;
- busca de pessoas e publicações;
- notificações, marcação como lidas e destinos;
- lista e thread de conversas, envio, falha, nova tentativa e paginação;
- feed Para você e Amigas;
- criar e editar publicação, até duas fotos, visualizador interno e persistência;
- curtir, comentar, denunciar, excluir e compartilhar por conversa ou link;
- paginação do feed;
- estados vazio, carregando e erro.

## Rede — amigas e perfis públicos

Preservar:

- Minhas amigas, Solicitações e Descobrir;
- aceitar, recusar e enviar solicitação;
- abrir perfil, conversar, remover amizade, bloquear e desbloquear;
- perfil público de outra pessoa com LiveLinks e publicações;
- confirmação antes de ações destrutivas.

## Meu perfil

O visual aprovado segue a hierarquia inspirada no Instagram:

1. avatar e números derivados de dados existentes;
2. nome e bio;
3. LiveLinks discretos;
4. ações Editar perfil, Publicar e Compartilhar;
5. grade das próprias publicações.

Preservar no menu de ferramentas do perfil:

- ver como perfil público;
- Desejos: listar, criar, editar, excluir e compartilhar no feed;
- Clientes privados: buscar, criar, editar e excluir;
- privacidade padrão das novas publicações;
- pessoas bloqueadas e desbloqueio;
- gerenciamento dos LiveLinks: adicionar, editar, excluir e reordenar.

Não implementar aba de publicações marcadas. Localização e “próxima parada” podem existir somente como texto escrito pela pessoa na bio; não criar campos novos.

## Ajustes

Preservar somente as áreas existentes:

- Segurança e PIN: ativar, definir, confirmar, alterar e desativar;
- Assinatura e dados: status, informações de nuvem/privacidade e exportação CSV;
- Aparência: temas existentes e modo claro/escuro;
- Tela inicial: visibilidade dos cards e tipos de gráfico;
- Notificações: opt-in e estados de permissão/suporte;
- Instalar JobApp quando ainda não estiver instalado;
- sair da conta.

Não criar preferências de moeda, primeiro dia da semana, Ajuda e suporte ou uma nova página genérica de Privacidade.

## PIN

Preservar os dois usos do mesmo sistema:

- bloqueio global do aplicativo;
- bloqueio específico do Cofre.

Estados obrigatórios: vazio, digitando, verificando, correto, incorreto com feedback e apagar dígito. O fluxo de configuração tem Definir PIN, Confirmar PIN, divergência, salvamento e erro de salvamento.

## Superfícies fora do protótipo principal

Login, recuperação de senha, onboarding, recap mensal, instalação, permissões e gate da Rede não podem ser removidos. Eles permanecem funcionais durante a primeira etapa do redesign e recebem o mesmo sistema visual em etapas próprias.

## Critério de aceite da implementação

- Todas as funções desta lista continuam alcançáveis.
- Nenhuma função marcada como inexistente é criada.
- Nenhuma alteração de schema ou contrato de API é necessária apenas para o redesign.
- Testes atuais de comportamento continuam passando.
- Novos testes verificam a barra com cinco destinos, Ajustes fora da barra, perfil da Rede, gate do Cofre e rotas secundárias essenciais.
- O aplicativo é conferido em 390×844, 430×932, teclado aberto, safe areas e modo PWA standalone.

## Limite do protótipo

O protótipo usa dados em memória e confirmações simuladas. Ele não substitui autenticação, Supabase, RLS, upload, cache, notificações ou qualquer regra de negócio do aplicativo real.
