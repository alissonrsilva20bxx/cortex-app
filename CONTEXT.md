# JobApp — Domain Glossary

## Job

Um atendimento pago com um cliente. Entidade central do app.

Um Job possui: nome do cliente (ou apelido), data, hora, valor cobrado (BRL), modalidade, local opcional, status e observações livres.

**Status do Job** segue uma progressão linear: `agendado → confirmado → concluído`. O cancelamento pode ocorrer de qualquer estado anterior a `concluído`.

Somente Jobs com status `concluído` contribuem para o progresso das Metas Financeiras.

O "Próximo Job" é o Job com status `agendado` ou `confirmado` de data/hora mais próxima ao momento atual.

## Modalidade

A forma de entrega de um Job: `presencial` (encontro físico com local) ou `online` (sem deslocamento). Determina se o campo `local` é obrigatório.

## Meta Financeira

Um objetivo de faturamento num período definido: `dia`, `mês` ou `ano`. O progresso é calculado automaticamente somando o `valor` dos Jobs `concluídos` no período correspondente. O usuário define o `valorAlvo` manualmente nos Ajustes.

## Cofre

Armazenamento privado de imagens, isolado da galeria do dispositivo. Organizado em quatro categorias fixas: **Comprovantes**, **Conversas**, **Documentos** e **Pessoal**. As imagens ficam em Supabase Storage num bucket privado, acessível apenas com o token da sessão autenticada do Usuário.

**Limite:** máximo de 15 imagens por conta de Usuário, contadas no total entre todas as categorias. Ao atingir o limite, novos uploads são bloqueados com mensagem de aviso. O contador é visível na tela do Cofre.

## Categoria do Cofre

Uma das quatro pastas fixas dentro do Cofre: `Comprovantes`, `Conversas`, `Documentos`, `Pessoal`. Não é possível criar, renomear ou excluir categorias.

## Rota Sensível

Uma seção do app que exige revalidação do PIN antes do acesso, mesmo que o app já esteja desbloqueado. As Rotas Sensíveis são: **Jobs**, **Financeiro** e **Cofre**. A sessão de PIN numa Rota Sensível é válida por 5 minutos — após esse tempo, o PIN é exigido novamente.

## PIN

Código numérico de 4 dígitos definido pelo Usuário nos Ajustes. Serve para dois propósitos com o mesmo código: (1) desbloqueio global do app na abertura e (2) acesso às Rotas Sensíveis. Um PIN único serve para ambos os fins.

## Usuário

A pessoa autenticada via Google OAuth. O nome exibido nas saudações é `user_metadata.full_name` retornado pelo Google. Não existe cadastro por e-mail/senha — o único método de autenticação é Google.

## Tema

Um pacote visual completo composto por fundo (cor de background), acento (cor primária de destaque) e gradientes. Existem três temas disponíveis: **Pink Neon**, **Purple** e **Crimson**. Cada tema define seu próprio fundo — não há fundo universal compartilhado entre temas.

## Saudação Dinâmica

Mensagem exibida no topo da Home com o nome do Usuário e variação por período do dia (bom dia / boa tarde / boa noite). Não é uma mensagem de IA — é texto determinístico baseado em hora do sistema e nome do Google.
