# ADR 0004 — Reabertura de e-mail/senha como método de autenticação

**Status:** Aceito

## Contexto

[ADR 0001](./0001-google-oauth-exclusivo.md) fixou Google OAuth como único
método de login. Em 2026-08-20, já com o beta fechado em preparação, a
decisão foi revertida: cadastro/login/recuperação de senha por e-mail/senha
voltaram ao escopo, junto com Google (issue #94, T16 fechado sem código →
substituído por #94 como ticket ativo).

## Decisão

O app aceita **dois** métodos de login: Google OAuth (como antes) e
e-mail/senha (cadastro, login, recuperação de senha). Nenhum modo anônimo.

## Implementação

`app/login/page.tsx` oferece os dois caminhos. `lib/auth.ts` implementa
`signUpWithEmail`/login/recuperação. Duas falhas de segurança encontradas em
revisão e corrigidas antes do merge (PR #96, commit `f12d7dd`):
open redirect via backslash em `safeNextPath` (`app/auth/callback/route.ts`)
e reintrodução de enumeração de e-mail no cadastro (`signUpWithEmail`
desfazia a resposta "ghost user" intencional do Supabase). Cobertura em
`tests/wiring/auth-callback-next.test.ts`, `auth-helpers.test.ts`,
`nova-senha-page.test.ts`.

## Consequências

- ADR 0001 fica superseded, não revogada — o raciocínio de reduzir atrito
  com Google continua válido, só deixou de ser exclusivo.
- Documentação que ainda afirma "só Google OAuth" (`docs/rede/CURRENT_BACKEND_AUDIT.md`,
  `docs/rede/TEST_HARNESS.md`) precisa ser lida como desatualizada até ser
  corrigida — checar a data de cada doc antes de confiar nela como fonte da
  verdade sobre autenticação.
