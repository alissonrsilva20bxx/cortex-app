import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regressão do indicador lateral de rolagem confirmado manualmente no
 * aparelho real. Causa raiz REAL (verificada ao vivo via Playwright, não
 * só lida no relato da ticket): o `<main overflow-y-auto>` de
 * `app/page.tsx` nunca chega a fazer overflow sozinho --
 * `main.scrollHeight === main.clientHeight` sempre, porque ele só cresce
 * pra caber o conteúdo dentro de um `<body>`/`<html>` sem altura travada
 * (mesmo comportamento já registrado na memória "main nunca rola, quem
 * rola é window"). Quem rola de verdade é o documento
 * (`document.documentElement.scrollHeight > window.innerHeight`) -- é o
 * scrollbar NATIVO do viewport que aparecia no Safari/iPhone, não um
 * scrollbar do `<main>`.
 *
 * Por isso a correção tem duas partes:
 *  1. `.no-scrollbar` (já existente em `styles/globals.css`, usada por
 *     `FilterChips`/`PerfilPublicoScreen`/`JobsTab`) no `<html>`
 *     (`app/layout.tsx`) -- é o container que de fato rola hoje.
 *  2. A mesma classe no `<main>` também, como defesa extra: se um dia ele
 *     passar a ter altura travada e overflow-ar sozinho (mudança de
 *     layout futura), o indicador já vem escondido sem precisar de nova
 *     correção.
 *
 * `.no-scrollbar` só esconde o indicador visual (`::-webkit-scrollbar` +
 * `scrollbar-width`/`-ms-overflow-style`) -- não mexe em `overflow`, então
 * touch scroll/momentum/acessibilidade continuam intactos. Teste de
 * código-fonte (mesmo padrão dos `*-visual.test.ts`): garante que o
 * container que REALMENTE rola (app real + dev-preview, que precisam
 * ficar coerentes) usa a regra compartilhada -- não uma cópia local que
 * poderia divergir de novo.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("styles/globals.css define a regra compartilhada", () => {
  const css = read("styles/globals.css");

  it(".no-scrollbar esconde o indicador nos 3 motores sem usar overflow:hidden", () => {
    expect(css).toMatch(
      /\.no-scrollbar::-webkit-scrollbar\s*\{\s*display:\s*none;\s*\}/
    );
    const bloco = css.match(/\.no-scrollbar\s*\{[\s\S]*?\}/)?.[0] ?? "";
    expect(bloco).toMatch(/-ms-overflow-style:\s*none;/);
    expect(bloco).toMatch(/scrollbar-width:\s*none;/);
    // a regra não pode desligar overflow (senão a rolagem para de funcionar)
    expect(bloco).not.toMatch(/overflow:\s*hidden/);
  });
});

describe("o <html> (quem rola de verdade) usa a regra compartilhada", () => {
  const src = read("app/layout.tsx");

  it("className do <html> inclui no-scrollbar", () => {
    expect(src).toMatch(
      /<html\s*\n\s*lang="pt-BR"\s*\n\s*data-theme="pink-neon"\s*\n\s*className=\{`\$\{jakarta\.variable\} no-scrollbar`\}/
    );
    expect(src).not.toMatch(/overflow-y-hidden|overflow-hidden/);
  });
});

describe("o <main> rolável do app real também usa a regra (defesa extra)", () => {
  const src = read("app/page.tsx");

  it('className combina "overflow-y-auto" com "no-scrollbar" (não overflow:hidden)', () => {
    expect(src).toMatch(
      /<main\s*\n\s*className="flex-1 overflow-y-auto no-scrollbar pb-40 px-4"/
    );
    expect(src).not.toMatch(/overflow-y-hidden|overflow-hidden/);
  });
});

describe("o dev-preview fica coerente com o app real (mesmos dois <main>)", () => {
  const src = read("app/dev-preview/app/page.tsx");

  it("o <main> do shell completo (casca com todas as abas) usa no-scrollbar", () => {
    expect(src).toMatch(
      /<main\s*\n\s*className="flex-1 overflow-y-auto no-scrollbar pb-40 px-4"/
    );
  });

  it("o <main> do preview de onboarding também usa no-scrollbar", () => {
    expect(src).toMatch(
      /<main\s*\n\s*className="flex-1 overflow-y-auto no-scrollbar px-4"/
    );
  });

  it("nenhum dos dois usa overflow:hidden/overflow-hidden", () => {
    expect(src).not.toMatch(/overflow-y-hidden|overflow-hidden/);
  });

  // dev-preview/app compartilha o mesmo <html> de app/layout.tsx (Next.js
  // só permite <html>/<body> no layout raiz) -- nada a duplicar aqui.
});
