# ADR 0002 — Cofre usa Supabase Storage (não localStorage)

**Status:** Aceito

## Contexto

O Cofre Privado precisa armazenar imagens de forma isolada da galeria do dispositivo e protegida por autenticação. As alternativas foram: IndexedDB/localStorage no browser, ou Supabase Storage com bucket privado.

## Decisão

Imagens do Cofre são armazenadas exclusivamente no Supabase Storage em um bucket privado (`cofre`), com acesso restrito ao token de sessão do Usuário autenticado.

## Razões

- localStorage e IndexedDB são acessíveis por qualquer script da origem — não oferecem isolamento real.
- Supabase Storage com RLS (Row Level Security) garante que apenas o próprio usuário acessa suas imagens, mesmo que o anon key seja exposto.
- Permite acesso às imagens de qualquer dispositivo após login, sem transferência manual.
- O bucket privado não gera URLs públicas — as imagens só são servidas com token temporário assinado.

## Consequências

- Requer conexão com internet para acessar o Cofre (sem modo offline para imagens).
- Upload de imagens grandes pode ser lento em conexões móveis — limitar tamanho por arquivo (sugestão: 10 MB).
- Custo de storage no Supabase deve ser monitorado se o uso crescer.
