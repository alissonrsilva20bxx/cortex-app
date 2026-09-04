# ADR 0001 — Google OAuth como único método de autenticação

**Status:** Superseded por [ADR 0004](./0004-reabertura-email-senha.md) em
2026-08-20 — o app passou a aceitar e-mail/senha além de Google. Mantido
aqui por completude histórica; não reflete o comportamento atual.

## Contexto

O JobApp precisa de autenticação para associar dados ao usuário e habilitar sync na nuvem. As alternativas consideradas foram: Google OAuth, e-mail/senha, ou acesso anônimo com PIN.

## Decisão

Usar Google OAuth exclusivamente via Supabase Auth. Não haverá cadastro por e-mail/senha nem modo anônimo.

## Razões

- O público-alvo usa smartphones pessoais com conta Google ativa — o atrito de login é zero.
- Elimina o gerenciamento de senhas esquecidas, verificação de e-mail e fluxos de recuperação de conta.
- O nome real do usuário (`full_name`) fica disponível imediatamente para a Saudação Dinâmica sem formulário extra.
- Supabase Auth já inclui o provider Google com configuração mínima.

## Consequências

- Usuários sem conta Google não conseguem acessar o app (aceitável dado o público-alvo).
- Revogar acesso ao Google desconecta o usuário do JobApp — documentar isso na tela de login.
- Não é possível usar o app offline antes do primeiro login.
