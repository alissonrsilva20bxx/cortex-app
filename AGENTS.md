# AGENTS.md

Só o que o ambiente não mostra. Regras de código estão em `CODING_STANDARDS.md`.

## Supabase (conta do dono)

- `seciereacfestemdhzhp` = Cortex App. ATIVO. Todos os `.env.local` apontam para ele.
- `pmrnpbwlddzgcyaqexap` = jobapp-homologacao. Pausado.
- `xwboflihgejtyozmnfex` = JobApp. Pausado.
- Nunca leia, imprima ou grave chaves e `.env`.
- Não mexa em `supabase/migrations` sem autorização do dono.

## Ambiente

- Rode `vitest`, `tsc` e `lint` pelo `cmd.exe` (ex.: `cmd.exe /c "npx vitest run"`). O `node_modules` do worktree é um link para `C:\Users\miguel\JobApp\node_modules` e o WSL não o resolve bem.
- Não rode `npm install` no worktree: ele mexeria no `node_modules` do projeto principal.
- `git.exe` é lento. Use `timeout` e não rode vários ao mesmo tempo.
- Suba um único `next dev` por vez e encerre ao terminar.
- Antes de pedir teste ao dono: `npm run pre-teste` verde. Os testes de `tests/rede` só rodam com `npm run teste-banco`.

## Ponteiros

- Termos do domínio: `GLOSSARY.md` (nesta branch ainda se chama `CONTEXT.md`).
- Roteiro de pré-teste e o que os testes não provam: `docs/pre-teste.md`.
- Julgamento de código e tela: `CODING_STANDARDS.md`.
