# Revisão Codex — Fundação Backend da Rede

**Data:** 2026-07-25  
**Status:** correções documentais obrigatórias antes de qualquer implementação.

## Veredito

Os cinco documentos atendem à estrutura solicitada e são uma boa base. Ainda não estão aprovados para implementação porque contêm um bloqueio crítico de autorização e algumas inferências apresentadas como fatos.

## Bloqueador crítico

### Assinatura não pode ter escrita pelo proprietário

`rede_assinaturas.status` controla acesso comercial. O usuário deve poder consultar a própria assinatura, mas nunca definir `ativa`, reiniciar trial ou alterar datas.

Corrigir em todos os documentos:

- `SELECT`: somente o próprio usuário.
- `INSERT/UPDATE/DELETE`: somente webhook/backend confiável com service role.
- Operações privilegiadas devem ser server-side, autenticadas, idempotentes e auditáveis.
- Adicionar testes que provem que um cliente autenticado não consegue autoativar ou prorrogar o plano.

## Correções de alta prioridade

### Estado remoto é desconhecido

Tipos gerados e scripts locais provam apenas um snapshot anterior, não o estado atual do Supabase.

- Trocar “foi aplicado manualmente” por “há indícios; confirmar no remoto”.
- `RD-00` não pode criar/reconciliar baseline antes de uma auditoria remota controlada.
- `CREATE TABLE IF NOT EXISTS` não reconcilia colunas, constraints, triggers ou policies divergentes.
- Criar um ticket anterior a `RD-00`: inventário/diff remoto somente leitura e banco descartável para ensaio.

### Anonimato não está confirmado

`Avatar.tsx` suportar `anonimo` é capacidade visual, não decisão de produto.

- Posts anônimos: proposta a validar.
- Comentários anônimos: proposta adicional, também a validar.
- Não deixar anonimato bloquear o MVP até decisão explícita.
- Se aprovado futuramente, exigir acesso somente por view/RPC endurecida, revogar acesso direto à tabela base, grants mínimos, `search_path` seguro e testes contra vazamento de `autor_id`.

### Convites precisam ser resistentes a abuso

Adicionar ao modelo e aos critérios:

- código com entropia suficiente;
- armazenar hash, não código reutilizável em texto puro;
- expiração e uso único;
- rate limit;
- autenticação server-side;
- consumo atômico/transacional;
- proteção contra corrida e força bruta;
- logs sem registrar o código completo.

### Rollback

Remover `DROP TABLE ... CASCADE` como estratégia padrão ou “sem efeito colateral”.

- Preferir roll-forward.
- Definir reversão explícita por objeto.
- Exigir backup/export antes de mudança destrutiva.
- Considerar policies, publication, bucket e objetos do Storage.
- Nunca apagar dados reais do beta automaticamente.

### RLS e Realtime

- Policies que consultam `rede_convites`, `rede_admins`, participantes e bloqueios exigem desenho contra recursão.
- Funções auxiliares devem ter grants mínimos e testes adversariais.
- Não tratar Realtime + RLS como garantia sem validar a configuração real com duas sessões e testes automatizados.

## Ajuste de escopo

Marcar como propostas que não bloqueiam o MVP sem decisão:

- posts/comentários anônimos;
- imagens e bucket de mídia;
- categorias extras;
- assinatura separada;
- moderação/admin completa;
- SSR/SEO;
- endpoints adicionais além do acesso beta mínimo.

O beta reduzido permanece: perfil/LiveLinks, feed de texto, amizades, chat 1:1 de texto, curtidas/comentários, bloqueio e denúncia.

## Qualidade dos tickets

Adicionar:

1. Ticket de auditoria remota e diff antes do baseline.
2. Ticket de harness de testes local/staging.
3. Testes automatizados de RLS com múltiplos usuários.
4. Testes de concorrência para convites, amizades, curtidas e conversa única.
5. Testes de rotas sem service role no cliente.
6. Geração de tipos contra ambiente local/staging, não produção como primeiro passo.

## Entrega solicitada à Claude Letícia

Atualizar apenas os cinco documentos existentes e este arquivo de handoff/status.

Não implementar migrations, services, endpoints ou testes ainda.  
Não acessar Supabase remoto.  
Não fazer commit, push ou deploy.  
Ao terminar, atualizar `HANDOFF_TO_CODEX.md` com uma lista exata das correções e aguardar nova revisão.
