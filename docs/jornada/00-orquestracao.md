# 00 — Como orquestrar

Documento normativo. Se um ticket e este documento discordarem, **este documento vence**.

---

## 1. Papéis

**Orquestrador** (1 sessão). Não escreve código de produto. Ele:
- roda `scripts/jornada-criar-tickets.sh` uma vez pra subir as issues;
- escolhe o próximo ticket **da fronteira** (aberto, sem bloqueio pendente, sem dono) e
  entrega pra uma trabalhadora livre;
- atribui a issue à trabalhadora **antes** dela começar (isso é a reserva; issue aberta e
  sem dono = livre);
- quando uma trabalhadora entrega, abre o PR dela e **para**. Não mergeia.
- nunca trabalha dois tickets da mesma fase que mexam no mesmo arquivo (ver §6).

**Trabalhadora W1** e **Trabalhadora W2** (2 contas Claude). Cada uma:
- tem **o seu próprio worktree**, nunca compartilha diretório com a outra;
- faz **um ticket por vez**, do início ao fim;
- abre PR e **congela**: não mergeia, não fecha a issue, não mexe em outro ticket.

**Humano.** Único que mergeia PR, aplica migration, mexe em Vercel/Supabase, e fecha os
tickets de porteira (J00, J08).

---

## 2. Regras invioláveis

Quebrar qualquer uma destas é motivo de abortar o ticket e avisar o humano.

1. **Nunca mergear.** Trabalhadora e orquestrador abrem PR e param. O merge é do humano.
2. **Nunca aplicar migration em produção.** Migration só é *escrita* como arquivo
   `supabase/migrations/NNNN_*.sql`. Aplicar (mesmo em homologação) é do humano.
3. **Nada de banco, RLS, auth, variável de ambiente do Vercel ou produção** sem um ticket
   que autorize explicitamente.
4. **O repositório principal `C:\Users\miguel\JobApp` é intocável.** Sem `reset`, sem
   `checkout`, sem `clean`, sem `stash`, sem apagar arquivo. Ele tem arquivos locais não
   commitados (dezenas de PNGs de teste) que precisam continuar lá. Trabalhe **sempre**
   num worktree próprio.
5. **Nunca rodar um segundo `next dev`.** Dois servidores de desenvolvimento neste
   repositório se travam em silêncio. Antes de subir um, confira se já tem um rodando.
6. **Nunca entregar `localhost` como resultado.** Resultado é PR + print, ou o link do
   preview do Vercel da branch.
7. **Não misturar protótipo com app.** Os arquivos de `docs/jornada/referencias/` são
   **referência visual para ler**. Nenhuma linha deles é copiada pra dentro de
   `components/` ou `app/`. O protótipo é HTML único com estado falso; o app é React com
   Supabase.
8. **Não inventar número, nome nem texto.** Todo rótulo, título de seção e valor vem do
   mockup de referência ou dos dados reais do Supabase. Os nomes e valores dos mockups
   (Renata Ferreira, R$ 180, etc.) são **ilustrativos** e não entram no código.
9. **Uma issue, uma branch, um PR.** Sem acumular tickets num PR só.
10. **Português.** Commits, PRs, comentários de issue e código novo em PT-BR, seguindo o
    que já existe no repositório.

---

## 3. Branches

A base de tudo é `mockuptesterede` **depois** que o PR #148 for mergeado (ticket J00).

```
mockuptesterede                  (base; só o humano mergeia aqui)
└── feature/jornada              (branch de integração da fase 1+2)
    ├── agent/w1-j02-inicio      (W1)
    ├── agent/w2-j03-agenda      (W2)
    └── ...                      (uma por ticket)
```

- PR de trabalhadora: `agent/wN-jNN-<slug>` → **`feature/jornada`**.
- PR de integração: `feature/jornada` → **`mockuptesterede`**, aberto só no fim da Fase 1
  e de novo no fim da Fase 2.
- Nome da branch em minúsculas, sem acento, sem espaço.

Antes de começar um ticket, a trabalhadora **sempre** rebase/atualiza a sua branch em cima
de `feature/jornada`.

---

## 4. Worktrees

Cada trabalhadora tem um diretório fixo. Criar assim (a partir de `C:\Users\miguel\JobApp`,
que é só o diretório de onde se roda o comando — ele não é modificado):

```bash
git worktree add -b agent/w1-j02-inicio /c/Users/miguel/JobApp-W1 feature/jornada
git worktree add -b agent/w2-j03-agenda /c/Users/miguel/JobApp-W2 feature/jornada
```

Nos tickets seguintes, reaproveite o mesmo diretório trocando de branch dentro dele:

```bash
cd /c/Users/miguel/JobApp-W1
git fetch origin
git checkout -b agent/w1-j04-financeiro origin/feature/jornada
```

**Armadilha obrigatória:** um worktree novo **não tem `.env.local`**, e sem ele o
`next dev` quebra em *toda* rota (o middleware cai). Copie antes de rodar qualquer coisa:

```bash
cp /c/Users/miguel/JobApp/.env.local /c/Users/miguel/JobApp-W1/.env.local
```

E **não rode `npm install` dentro de um worktree**: `node_modules` ali é uma junction pro
repositório principal, e o `npm install` a substitui por uma pasta real sem volta fácil.
Se faltar dependência, avise o humano.

---

## 5. O ciclo de uma trabalhadora

1. Ler `docs/jornada/00-orquestracao.md` (este arquivo) e o ticket.
2. Abrir a referência do ticket e **olhar** (ver §8).
3. Criar a branch a partir de `feature/jornada`.
4. Implementar. Só nos arquivos que o ticket lista (§6).
5. Rodar, **em ordem**, e tudo tem que passar:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   ```
6. Adicionar o teste de fiação que o ticket pede (ver §7).
7. Tirar os prints que o ticket pede e anexar no PR.
8. Commitar e abrir o PR pra `feature/jornada`.
9. Comentar na issue: o que foi feito, o que **não** foi feito, e qualquer coisa que
   encontrou e não estava no ticket. **Não fechar a issue.**
10. Parar.

### Commits

```
feat(jornada): <o que mudou>

Ticket: J04 (#<numero>)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

**Armadilha:** `git commit -m "..."` com acento grave (`` ` ``) na mensagem é corrompido
pelo bash (substituição de comando). Escreva a mensagem num arquivo e use
`git commit -F mensagem.txt`.

---

## 6. Mapa de arquivos — quem mexe em quê

É **isto** que impede as duas trabalhadoras de se atropelarem. Um ticket só toca os
arquivos da sua linha. Se precisar de um arquivo de outra linha, **pare e avise o
orquestrador**.

### Arquivos compartilhados — só J01 e J11 podem tocar

| Arquivo | Quem pode |
| ------- | --------- |
| `styles/globals.css` | **J01** (fase 1), **J12** (fase 2, só tokens novos da Jornada) |
| `components/TabPanel.tsx` | **J01** |
| `components/BottomNav.tsx` | **J01** |
| `components/FAB.tsx` | **J01** |
| `app/page.tsx` | **J01**, depois **J15** (só pra ligar o motor) |
| `app/dev-preview/app/page.tsx` | **J01**, depois **J12** |
| `lib/mockAppData.ts` | **J01** |

Qualquer outro ticket que sentir necessidade de mexer num destes está com o escopo errado.

### Fase 1 — as 5 telas

| Ticket | Arquivos | Trabalhadora |
| ------ | -------- | ------------ |
| J01 | os compartilhados acima | W1 (sozinha; bloqueia as outras) |
| J02 Início | `components/home/*`, `components/charts/*` | W1 |
| J03 Agenda | `components/jobs/*` | W2 |
| J04 Financeiro | `components/financeiro/*` | W1 |
| J05 Cofre | `components/cofre/*` | W2 |
| J06 Rede | `components/rede/RedeTab.tsx`, `components/rede/RedeHeader.tsx`, `components/rede/FeedScreen.tsx` **e mais nada de `rede/`** | W1 |
| J07 regressão | só `tests/` e prints | W2 |

### Fase 2 — o motor

| Ticket | Arquivos | Trabalhadora |
| ------ | -------- | ------------ |
| J09 migrations | `supabase/migrations/00NN_jornada_*.sql` | W1 |
| J10 servidor | `supabase/migrations/00NN_jornada_rpcs.sql`, `lib/jornada/servidor.ts` | W1 |
| J11 cliente | `lib/jornada/*` (menos `servidor.ts`), `components/jornada/useJornada.ts` | W2 |
| J12 tela | `components/jornada/JornadaScreen.tsx` + filhos, `components/home/JornadaCard.tsx`, `styles/globals.css` (só tokens `--j-*`) | W2 |
| J13 comemoração | `components/jornada/celebracao/*`, `lib/jornada/som.ts` | W1 |
| J14 resumos | `components/jornada/resumos/*` | W2 |
| J15 ligação | `app/page.tsx` e, em cada componente de ação, **apenas a chamada** ao motor | W1 |
| J16 regressão | só `tests/` e prints | W2 |

**Numeração de migration:** a última aplicada é `0033_rede_fotos_otimizacao.sql`. A próxima
livre é **0034**. Antes de criar, rode `ls supabase/migrations | tail -5` — se outra branch
tiver pegado o número, pegue o seguinte e avise. (Já aconteceu: dois PRs colidiram no
mesmo número e um teve que ser renumerado.)

---

## 7. Teste obrigatório: fiação

Este repositório **não tem** `@testing-library/react` nem plugin de JSX no Vitest.
Portanto **não existe teste de renderização**. O padrão daqui é o **teste de fiação**: o
teste lê o arquivo-fonte como texto e afirma que a ligação certa existe.

Veja `tests/wiring/cofre-visual.test.ts` e `tests/wiring/inicio-visual.test.ts` como
modelo. O formato é:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("...", () => {
  const page = read("app/dev-preview/app/page.tsx");
  it("importa o componente real, não uma cópia", () => {
    expect(page).toMatch(/from\s*"@\/components\/home\/HeroCard"/);
  });
});
```

Isso pega exatamente os bugs que apareceram nos relatórios anteriores: import antigo que
ficou, número do mockup copiado pra dentro do código, alvo de toque que não foi corrigido.
**Cada ticket que muda tela precisa de pelo menos um teste assim.**

---

## 8. Como olhar as referências

As referências são HTML. Para **ver**, não leia o HTML inteiro — abra e tire print.

```bash
# as 5 telas, 8 temas, claro e escuro
docs/jornada/referencias/5-telas-8-temas-claro-escuro.html

# o protótipo aprovado da gamificação (interativo, com painel de demos)
docs/jornada/referencias/prototipo-sua-jornada.html
```

Com Playwright: **chame `page.bringToFront()` antes de qualquer coisa**, senão a janela
roda a ~4 fps e tudo parece travado.

No arquivo das 5 telas, os seletores são:
- cada celular é `.phone`, com `data-t="inicio|agenda|financeiro|cofre|rede"`;
- modo com `data-md="light|dark"`;
- tema com `data-tm="pink-neon|purple|ocean|midnight|grafite|gold|emerald|crimson"`;
- estado da pílula com `data-force="auto|open|compact"`.

No protótipo da Jornada, o painel da direita tem botões de demo; o script está dentro de
uma IIFE, então variáveis internas **não** são globais — não tente ler `S.sparks` por
`evaluate`.

**Animação não se revisa com um print.** Se o ticket mexe em transição, amostre a linha do
tempo (vários prints em instantes diferentes). Um print só não mostra transição nenhuma.

---

## 9. Para testar no app

- Rota de laboratório: **`/dev-preview/app`**. É nela que se testa. **Não** use
  `/dev-preview/rede` pra nada de posicionamento ou animação: ela não passa pelo
  `TabPanel` e o resultado engana.
- O `<main>` de `app/page.tsx` **nunca** transborda sozinho; quem rola é sempre
  `document`/`window`. Se você está medindo scroll no `main`, está medindo a coisa errada.
- `/dev-preview/session` dá 503 no local porque falta `SUPABASE_SERVICE_ROLE_KEY` no
  `.env.local`. É pré-existente e não afeta produção — **não tente consertar**.
- Muitas chamadas `evaluate()` pesadas seguidas na mesma página deixam a leitura/escrita
  lenta. Isso é o Playwright, não o app.

---

## 10. Links

- Preview da base (`mockuptesterede`):
  `https://jobapp-git-mockuptesterede-bxx-project.vercel.app`
- Preview da branch de integração (passa a existir quando `feature/jornada` for enviada):
  `https://jobapp-git-feature-jornada-bxx-project.vercel.app`
- Preview de branch segue a branch sozinho. O alias `jobapp-beta-bxx` **não** — ele precisa
  ser reapontado à mão, e não é usado neste trabalho.

---

## 11. Quando parar e chamar o humano

- O ticket pede algo que uma regra do §2 proíbe.
- Dois tickets precisam do mesmo arquivo.
- `npm test` falha em algo que você não mexeu (anote qual e pare — não "conserte" de
  passagem).
- A referência não responde uma pergunta visual (ex.: o que acontece ao toque num card que
  o mockup não mostra). **Não decida sozinha** — pergunte.
- Precisa de migration aplicada, de Supabase, de Vercel ou de convite.
