import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** "Lembrar cliente" (proposta 2): fiação do botão até a folha de compartilhar. */
const ROOT = join(__dirname, "..", "..");
/** Só o código (sem comentários), para as checagens do que o código FAZ. */
const semComentario = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");
const CARD = read("components/jobs/AgendaProximoCard.tsx");
const TAB = read("components/jobs/JobsTab.tsx");
const SHEET = read("components/jobs/LembrarClienteSheet.tsx");
const IMG = read("lib/lembrete/imagem.ts");
const GER = read("lib/lembrete/cartaoAgenda.ts");

describe("o botão do card abre o Lembrar cliente", () => {
  it("chama onLembrar e só fica desabilitado sem ação ou quando não faz sentido lembrar", () => {
    expect(CARD).toMatch(
      /onClick=\{\(\) => onLembrar\?\.\(job\)\}\s+disabled=\{!onLembrar \|\| !podeLembrar\(job\)\}[\s\S]{0,800}Lembrar cliente ›/
    );
  });
  it("a Agenda passa onLembrar e monta a folha com o agendamento ATUAL da lista (refeito se mudar)", () => {
    expect(TAB).toMatch(
      /<AgendaProximoCard[\s\S]{0,120}onLembrar=\{setLembrarJobId\}/
    );
    expect(TAB).toContain("jobs.find((j) => j.id === lembrarId)");
    expect(TAB).toMatch(/<LembrarClienteSheet\s+job=\{lembrarJob\}/);
  });
  it("a página passa nome e telefone dela (app e laboratório)", () => {
    expect(read("app/page.tsx")).toMatch(
      /profissional=\{\{\s*nome: usuario\.nome,\s*telefone: usuario\.telefone,?\s*\}\}/
    );
    expect(read("app/dev-preview/app/page.tsx")).toMatch(
      /profissional=\{\{ nome: usuario\.nome, telefone: usuario\.telefone \}\}/
    );
    expect(read("app/page.tsx")).toMatch(/telefone:\s*authUser\.phone \|\|/);
  });
});

describe("a folha: cartão refeito na hora, imagem pronta antes do toque, nada enviado sozinho", () => {
  it("dados, SVG e texto saem do agendamento atual (useMemo com o job)", () => {
    expect(SHEET).toMatch(
      /dadosDoLembrete\(job, profissional\)[\s\S]{0,40}\[job, profissional\]/
    );
    expect(SHEET).toMatch(
      /cartaoAgendaSvg\(dados, modo\)[\s\S]{0,40}\[dados, modo\]/
    );
  });
  it("o PNG é gerado quando o SVG muda (antes do toque) e o Compartilhar usa o pronto", () => {
    expect(SHEET).toMatch(
      /useEffect\(\(\) => \{\s*setPng\(null\);\s*if \(!svg\) return;[\s\S]{0,120}svgParaPng\(svg\)/
    );
    expect(SHEET).toMatch(
      /if \(!png \|\| !dados\) return;\s*const r = await compartilharLembrete\(png, nomeDoArquivo\(dados\), texto\);/
    );
  });
  it("sem suporte: baixa a imagem e oferece o wa.me com o texto", () => {
    expect(SHEET).toMatch(
      /if \(r === "sem-suporte"\) \{\s*baixarImagem\(png, nomeDoArquivo\(dados\)\);\s*setPlanoB\(true\);/
    );
    expect(SHEET).toContain("href={linkWhatsApp(texto)}");
  });
  it("o cartão segue o modo do app (claro/escuro)", () => {
    expect(SHEET).toMatch(
      /getAttribute\("data-mode"\) === "light"\s*\?\s*"claro"\s*:\s*"escuro"/
    );
  });
  it("tudo no aparelho: nada de rede, Supabase, Storage ou envio automático", () => {
    for (const [nome, src] of [
      ["sheet", SHEET],
      ["imagem", IMG],
      ["gerador", GER],
    ] as const) {
      expect(semComentario(src), nome).not.toMatch(
        /supabase|storage|fetch\(|XMLHttpRequest|sendBeacon/i
      );
    }
    expect(IMG).toContain("canvas.toBlob(");
    expect(IMG).toMatch(/nav\.share\(dados\)/);
  });
});
