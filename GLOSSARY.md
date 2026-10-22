# JobApp — Domain Glossary

## Job

Um atendimento pago com um cliente. Entidade central do app.

Um Job possui: nome do cliente (ou apelido), data, hora, valor cobrado (na moeda do app, hoje euro: `CURRENCY` em `lib/jornada/textos.ts`), modalidade, local opcional, status e observações livres.

**Status do Job** (decisão do capitão, 21/10/2026): `agendado → confirmado (opcional) → concluído` ou `cancelado`.

- **Confirmado** = a cliente confirmou, ANTES do horário. Não quer dizer que o atendimento deu certo.
- No horário ou depois, o atendimento em aberto (`agendado` ou `confirmado`) vira `concluído` (aconteceu) ou `cancelado` ("Não aconteceu", inclui a cliente que faltou).
- **Não aconteceu** = depois do horário. **Cliente desmarcou** = antes do horário, botão no detalhe do atendimento, com confirmação. Os dois gravam `cancelado`, saem do Próximo e do Previsto, deixam de bloquear o Descanso e não contam na Jornada nem no Financeiro. O formulário não oferece Cancelado antes do horário. Desmarcar não tira o ponto de planejar da Jornada: criar o atendimento futuro já contou, e cancelar depois não desfaz.
- Atendimento futuro não se conclui: "Concluir" e "Não aconteceu" só valem a partir do horário.
- **Aconteceu?** é a pergunta que a Agenda e o card "Aconteceu?" no topo da Início fazem para o atendimento em aberto cujo horário já passou, com "Sim, concluir" e "Não aconteceu". Na Início, o card "Próximo" some enquanto o "Aconteceu?" aparece.

Somente Jobs com status `concluído` contam como atendimento no progresso das Metas Financeiras e no dia contado da Jornada. As entradas avulsas também somam na meta, mas não contam como atendimento. O "Previsto do dia" da Agenda soma tudo que não é `cancelado`.

O "Próximo Job" é o Job com status `agendado` ou `confirmado` de data/hora mais próxima a partir de agora; atendimento que já passou não é "próximo", entra no "Aconteceu?".

## Modalidade

A forma de entrega de um Job: `presencial` (encontro físico com local) ou `online` (sem deslocamento). Determina se o campo `local` é obrigatório.

## Meta Financeira

Um objetivo de faturamento num período definido: `dia`, `mês` ou `ano`. O progresso é calculado automaticamente somando o `valor` dos Jobs `concluídos` mais as entradas avulsas do período correspondente. O usuário define o `valorAlvo` pelo botão "+" em Finanças > Metas.

## Cofre

Armazenamento privado de imagens, isolado da galeria do dispositivo. Organizado em quatro categorias fixas: **Comprovantes**, **Conversas**, **Documentos** e **Pessoal**. As imagens ficam em Supabase Storage num bucket privado, acessível apenas com o token da sessão autenticada do Usuário.

**Limite:** máximo de 15 imagens por conta de Usuário, contadas no total entre todas as categorias. Ao atingir o limite, novos uploads são bloqueados com mensagem de aviso. O contador é visível na tela do Cofre.

## Categoria do Cofre

Uma das quatro pastas fixas dentro do Cofre: `Comprovantes`, `Conversas`, `Documentos`, `Pessoal`. Não é possível criar, renomear ou excluir categorias.

## Rota Sensível

Uma seção do app que exige revalidação do PIN antes do acesso, mesmo que o app já esteja desbloqueado. As Rotas Sensíveis são: **Jobs**, **Financeiro**, **Cofre** e o **Chat da Rede** (sub-seção da Rede, não a aba inteira — feed, perfil e demais partes da Rede não exigem PIN). A sessão de PIN numa Rota Sensível é válida por 5 minutos — após esse tempo, o PIN é exigido novamente.

Nota: a revalidação por rota (o timer de 5 minutos) ainda não está implementada em nenhuma Rota Sensível hoje — só o desbloqueio global do app na abertura existe (`components/pin/PinScreen.tsx`). Esta definição é o comportamento pretendido, não o estado atual do código.

## PIN

Código numérico de 4 dígitos definido pelo Usuário nos Ajustes. Serve para dois propósitos com o mesmo código: (1) desbloqueio global do app na abertura e (2) acesso às Rotas Sensíveis. Um PIN único serve para ambos os fins.

## Usuário

A pessoa autenticada via Google OAuth. O nome exibido nas saudações é `user_metadata.full_name` retornado pelo Google. Não existe cadastro por e-mail/senha — o único método de autenticação é Google.

## Tema

Um pacote visual completo composto por fundo (cor de background), acento (cor primária de destaque) e gradientes. Existem três temas disponíveis: **Pink Neon**, **Purple** e **Crimson**. Cada tema define seu próprio fundo — não há fundo universal compartilhado entre temas.

## Saudação Dinâmica

Mensagem exibida no topo da Home com o nome do Usuário e variação por período do dia (bom dia / boa tarde / boa noite). Não é uma mensagem de IA — é texto determinístico baseado em hora do sistema e nome do Google.
