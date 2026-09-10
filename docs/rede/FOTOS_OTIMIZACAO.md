# Fotos da Rede — otimização (correção dos requisitos pendentes)

Branch: `feature/rede-fotos-otimizacao`. Migration: `0033_rede_fotos_otimizacao.sql`.

## Por que existe

A entrega original de fotos (PR #105 / migration 0028) subia o **arquivo
cru** do `<input>` direto pro Storage, pelo cliente — sem compressão, sem
resize, sem remoção de EXIF/GPS, sem miniatura — e a paginação do feed era 20. O escopo aprovado pedia:

| Requisito                                                   | Antes                        | Agora                      |
| ----------------------------------------------------------- | ---------------------------- | -------------------------- |
| Até 2 fotos por post                                        | ✅                           | ✅ (inalterado)            |
| Imagem principal ≤ **150 KB** e ≤ **1280 px** (maior lado)  | ❌ (10 MB, tamanho original) | ✅                         |
| Miniatura ≤ **30 KB** e ≤ **400 px**                        | ❌ (não existia)             | ✅                         |
| Remover metadados (GPS/EXIF), preservar orientação          | ❌                           | ✅                         |
| Feed carrega só a miniatura; principal só ao abrir          | ❌ (feed baixava a original) | ✅                         |
| Paginação de **10** posts                                   | ❌ (20)                      | ✅ (`FEED_PAGE_SIZE = 10`) |
| Exclusão/fila de limpeza cobrindo principal **e** miniatura | ❌                           | ✅                         |
| Trava no backend/Storage, não só no navegador               | ❌                           | ✅                         |

## Como funciona

### 1. Processamento no cliente — `lib/rede/imagemComposer.ts`

No `PostComposer`, ao escolher o arquivo (antes de publicar):

- `createImageBitmap(file, { imageOrientation: "from-image" })` — **assa a
  orientação EXIF no pixel**. Reencodar por `<canvas>` depois disso
  descarta todo metadado (EXIF/GPS/XMP/orientação) por construção.
- **Principal**: maior lado ≤ 1280 px, loop de qualidade JPEG
  (0.82 → 0.42); se não couber em 150 KB, reduz a dimensão
  (1280 → 1080 → 920 → 800) e tenta de novo.
- **Miniatura**: maior lado ≤ 400 px, mesmo loop até ≤ 30 KB.
- **Se não couber de jeito nenhum, LANÇA** — o `PostComposer` mostra o
  erro e não publica. **Nunca cai pro arquivo original.**

O preview no compositor mostra a imagem principal já processada.

### 2. Rota autenticada — `app/api/rede/foto-upload/route.ts`

A migration 0033 **tira do cliente** o `INSERT` direto em
`storage.objects` (bucket `rede-midia`) e em `rede_post_fotos`. O único
caminho de gravação é esta rota:

1. Autentica pela sessão (`resolveGateAuth`) e confirma que o `postId` é
   do autor.
2. Re-valida do zero, no servidor (`lib/rede/jpeg.ts`, JS puro, sem lib
   nativa): é JPEG? dimensão dentro do limite? bytes dentro do limite?
3. **Remove metadados sensíveis** (APP1 EXIF/XMP/GPS, APP13 IPTC,
   APP3–APP15, COM) — mantém APP0/JFIF e APP2/ICC (perfil de cor, não
   identifica ninguém). Afirma `!contemMetadados` depois.
4. O que não passa é **rejeitado** (HTTP 422) — nunca "corrigido pra
   caber", nunca substituído pelo original.
5. Grava principal + miniatura via `service_role` e insere a linha de
   `rede_post_fotos` (`path` + `thumb_path`).

**Falha parcial**: se a miniatura falhar depois da principal já ter
subido, ou o `INSERT` falhar, a rota **remove o que subiu** — nunca deixa
principal nem miniatura órfã. E o `criarPost` (cliente), se qualquer foto
falhar, **apaga o post recém-criado** (rollback) — nada de post publicado
pela metade.

### 3. Trava de backend — bucket `rede-midia` (migration 0033)

- `file_size_limit = 163840` (160 KiB) — rejeita qualquer upload maior,
  **inclusive via `service_role`**.
- `allowed_mime_types = ['image/jpeg']` — rejeita qualquer outro formato.
- Sem policy de `INSERT` em `storage.objects` pro bucket → `anon` e
  `authenticated` não conseguem `upload()` de jeito nenhum. Só
  `service_role` (a rota).

Isso significa que um upload direto (curl com a anon key, SDK no console)
**não tem como contornar** a validação da rota.

> **Limite honesto**: a dimensão em pixels não é verificável no Storage
> sem processamento de imagem no servidor (indisponível no plano Free sem
> edge function). A trava efetiva contra dimensão é a rota
> (`lerDimensoesJpeg` no SOF do arquivo recebido) + o teto de 160 KiB do
> bucket, que limita indiretamente o que cabe. Um edge function via
> webhook foi **descartado** pelo usuário (apagaria arquivo já publicado).

### 4. Feed carrega só a miniatura + visualizador interno — `lib/rede/feed.ts`, `FotoViewer.tsx`

- `listarFeed` assina **só** `thumb_path` (URL de 5 min). A imagem
  principal **não é baixada no feed**.
- `PostCard` mostra a miniatura na grade. Tocar nela abre o
  **`FotoViewer`** — visualizador em tela cheia **dentro do app**
  (`createPortal` pro body), estilo Instagram, identidade JobApp. **Sem
  nova aba, sem `window.location`.**
- **Abertura instantânea percebida**: mostra já a miniatura da foto tocada
  (que o navegador acabou de exibir no feed → vem do cache) e, em
  paralelo, `assinarUrlsFoto` assina **em lote** as principais **deste
  post** (máx. 2, uma chamada) e pré-carrega as duas (`new Image()`).
  Navegar entre as 2 fotos usa a principal já pré-carregada — sem novo
  atraso de assinatura nem download. Nunca baixa principal de outro post.
- Miniatura de placeholder (blur leve, 2px) com **crossfade curto** (160ms)
  pra principal quando ela termina. Fundo **opaco** (`#0b0b0d`) pro feed
  não competir visualmente.
- Fecha por **X**, **Esc** e **Voltar do navegador/celular** — tudo via
  `history.pushState` + `popstate` (um só caminho de fechamento). Fechar
  devolve ao **mesmo ponto de rolagem** do feed (o feed nunca desmonta).
- Post com 2 fotos: **swipe**, setas, `← →` e contador **"1/2"**.
- Rolagem do fundo travada; foco preso no dialog (`role="dialog"`,
  `aria-modal`); foco volta pro elemento anterior ao fechar.
- Falha da principal (assinatura ou download): **miniatura continua
  visível** + mensagem discreta + **"Tentar de novo"** (re-assina o lote).

### 5. Fotos legadas (antes da 0033)

`thumb_path` é **nullable**. Foto sem miniatura → `thumbPath === path`, o
feed assina e mostra a própria principal na grade (comportamento antigo).
Nenhuma migração de dados retroativa.

## Validação

### Testes automatizados

- `tests/rede/services/jpeg.test.ts` — `lib/rede/jpeg.ts` (leitura de
  dimensão, detecção e remoção de EXIF/XMP/comentário, idempotência).
- `tests/rede/rls/rede_post_fotos.rls.test.ts` — reescrito pra 0033:
  `anon`/`authenticated` **não** sobem nem inserem direto; leitura
  respeita bloqueio; exclusão de foto/post enfileira **principal +
  miniatura**; dreno só por `service_role`.
- `tests/rede/rls/rede_posts_retencao.rls.test.ts` — ajustado pro bucket
  só-JPEG.
- Suíte `tests/rede` completa: **343/344** contra Supabase local com
  0028–0033 (a 1 falha é o flake pré-existente das curtidas, issue #107).

### Pipeline de imagem (navegador real)

Foto sintética 3024×4032 retrato + APP1 EXIF (Orientation + GPS):

|                            | Resultado                        | Alvo                |
| -------------------------- | -------------------------------- | ------------------- |
| Bitmap após orientação     | 4032×3024 (girou)                | orientação aplicada |
| Principal                  | 67 KB, 1280×960                  | ≤150 KB / ≤1280 px  |
| Miniatura                  | 12 KB, 400×300                   | ≤30 KB / ≤400 px    |
| Metadado sensível na saída | nenhum (só APP0 JFIF + APP2 ICC) | zero EXIF/GPS       |

### E2E em homologação — foto real de celular, via UI

Login `homolog-teste-a`, `localhost:3000` conectado só a `jobapp-homologacao`:

- **Post com 1 foto** (JPEG real de celular): 1 linha em `rede_post_fotos`
  com `path` + `thumb_path`; **exatamente 2 arquivos** no Storage —
  principal 101 KB / 714×1280 e miniatura 14,9 KB / 223×400; ambos
  `image/jpeg`; **zero metadado sensível**.
- **Post com 2 fotos**: 2 linhas, **exatamente 4 arquivos** (2 principal
  90–94 KB + 2 miniatura ~14 KB), todos dentro dos limites, sem EXIF.
- **Post legado** (foto `.png` 1×1 de antes da 0033) continua carregando —
  `thumb_path` null → feed assina o próprio `path`. Não foi tocado.
- Recarregar a página: todas as fotos voltam a aparecer.
- **FotoViewer**: abre com a miniatura instantânea; principal em crossfade;
  navegar entre as 2 fotos é instantâneo (pré-carregadas); X / Esc /
  Voltar fecham e devolvem à posição de rolagem; contador, setas e
  pontinhos corretos; fundo travado. Falha da assinatura → miniatura
  fica + "Tentar de novo" funciona.

### Homologação — schema (0033)

`thumb_path` existe; policies de INSERT dropadas; bucket 160 KiB / só
`image/jpeg`; trigger de exclusão referencia `thumb_path`; `anon` upload →
negado; `service_role` upload → ok; bucket rejeita `image/png` e payload
de 200 KB.

## Sequência de deploy da 0033

A 0033 **remove** a policy de INSERT em `storage.objects` (bucket
rede-midia) e em `rede_post_fotos`. O código antigo (PR #105, hoje em
`mockuptesterede`) sobe foto direto por essas policies — depois da 0033
ele passa a receber erro de RLS ao publicar com foto. Por isso **não
aplicar a 0033 isolada** enquanto o código antigo estiver no ar.

**Nota**: o Preview de `mockuptesterede` usa o **Supabase de produção**
(`seciereacfestemdhzhp`). "Aplicar no banco dos amigos" = aplicar em
produção.

### Ordem (janela curta de indisponibilidade de upload)

1. **Backup** de produção (as 4 tabelas + bucket `rede-midia`), como na
   Fase A — a 0033 não apaga dado, mas muda policies.
2. Abrir PR `feature/rede-fotos-otimizacao` → `mockuptesterede` e revisar.
3. **Aplicar 0033** em produção. `thumb_path` é aditiva/nullable — o
   código antigo que lê `path` continua funcionando; só o **upload**
   direto quebra a partir daqui.
4. **Imediatamente** mergear o PR → deploy de Preview do `mockuptesterede`
   com o código novo (rota + composer + FotoViewer).
5. Janela entre 3 e 4 (~2–3 min de build): quem tentar publicar **com
   foto** recebe "Não foi possível publicar". Publicar **sem foto**, ler o
   feed e abrir fotos continuam funcionando. Avisar o grupo de uma janela
   curta de manutenção.
6. **Abas antigas** já abertas: continuam com o bundle velho e falham no
   upload com foto até um **reload**. A mensagem é a de erro comum, não
   corrompe nada. Um `location.reload()` resolve.

### Produção "de verdade" (via `mockuptesterede` → `master`)

Quando a Rede inteira chegar em `master`, as migrations **0028–0033**
entram juntas com o código novo — não há 0033 isolada nesse caminho, nem
código antigo de upload pra quebrar.

### Rollback

- 0033 é reversível por roll-forward: recriar as policies de INSERT
  antigas (0028) numa migration nova + reverter o `file_size_limit`/
  `allowed_mime_types` do bucket. `thumb_path` pode ficar (nullable,
  inofensiva).
- Reverter o **código** (revert do PR) sem reverter a 0033 deixa o app
  sem caminho de upload — **reverter os dois juntos**.

## Pendente

- Revisão humana do PR (não há "Claude 2").
- Autorização agrupada: backup + 0033 em produção + merge/deploy.
- Exclusão dos posts de teste em homologação (`1c005b0c`, `9a5d37d6`) —
  aguardando liberação do usuário.
