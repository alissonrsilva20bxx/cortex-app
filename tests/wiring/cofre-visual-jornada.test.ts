import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RECENTES_MAX,
  formatDataArquivo,
  formatTamanho,
  recentes,
  totalUsado,
  ultimoEnvio,
} from "../../components/cofre/cofreResumo";
import type { CofreFile } from "../../lib/cofre/cofreCache";

/**
 * J05 (#155) — Cofre no visual novo da Jornada.
 *
 * Fiação (código-fonte como texto, sem RTL/JSX no Vitest) e lógica pura
 * executada de verdade. Os testes de proteção que já existiam
 * (`cofre-visual`, `cofre-lock-gate`, `cofre-cache`) continuam sendo a
 * fonte da verdade da trava; este arquivo afirma que o visual novo não
 * abriu nenhum caminho em volta dela.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const lf = (s: string) => s.replace(/\r\n/g, "\n");

const page = read("app/dev-preview/app/page.tsx");
const cofreTab = lf(read("components/cofre/CofreTab.tsx"));
const arquivos = lf(read("components/cofre/CofreArquivos.tsx"));
const resumo = lf(read("components/cofre/cofreResumo.ts"));

/** Índice do retorno principal (conteúdo sensível), depois dos dois gates. */
const mainReturnIdx = cofreTab.indexOf('return (\n    <div className="pb-4">');
const lockedGateIdx = cofreTab.indexOf('if (gateState === "locked") {');
const hiddenGateIdx = cofreTab.indexOf('if (gateState === "hidden") {');

describe("/dev-preview/app usa os componentes reais do Cofre", () => {
  it.each([
    ["CofreTab", "@/components/cofre/CofreTab"],
    ["UploadSheet", "@/components/cofre/UploadSheet"],
  ])("importa %s do caminho real, uma vez só", (name, path) => {
    expect(page).toMatch(
      new RegExp(`import\\s*{\\s*${name}\\s*}\\s*from\\s*"${path}"`)
    );
    const imports = page
      .split("\n")
      .filter(
        (l) => /^\s*import\b/.test(l) && new RegExp(`\\b${name}\\b`).test(l)
      );
    expect(imports).toHaveLength(1);
    expect(page).toContain(`<${name}`);
  });
});

describe("CofreTab monta a composição do mockup com os componentes novos", () => {
  it("importa as seções e a lista reais de ./CofreArquivos e a lógica de ./cofreResumo", () => {
    expect(cofreTab).toMatch(
      /import\s*{[^}]*\bListaArquivos\b[^}]*\bSecaoCofre\b[^}]*}\s*from\s*"\.\/CofreArquivos"/
    );
    expect(cofreTab).toMatch(
      /import\s*{[^}]*\btotalUsado\b[^}]*}\s*from\s*"\.\/cofreResumo"/
    );
  });

  it('os títulos exatos "Recentes" e "Todos os arquivos" estão no JSX, e o <h2> vem do título', () => {
    expect(cofreTab).toContain('<SecaoCofre titulo="Recentes" verTudo>');
    expect(cofreTab).toMatch(
      /<SecaoCofre titulo="Todos os arquivos" id=\{TODOS_OS_ARQUIVOS_ID\}>/
    );
    expect(arquivos).toContain('titulo: "Recentes" | "Todos os arquivos";');
    expect(arquivos).toMatch(
      /<h2 style=\{SECTION_TITLE_STYLE\}>\{titulo\}<\/h2>/
    );
  });

  it("Recentes recebe o recorte real (recentes(filtered)) e Todos os arquivos a lista completa filtrada", () => {
    expect(cofreTab).toContain("const listaRecentes = recentes(filtered);");
    const recentesBloco = cofreTab.slice(
      cofreTab.indexOf('<SecaoCofre titulo="Recentes" verTudo>'),
      cofreTab.indexOf('<SecaoCofre titulo="Todos os arquivos"')
    );
    expect(recentesBloco).toContain("files={listaRecentes}");
    const todosBloco = cofreTab.slice(
      cofreTab.indexOf('<SecaoCofre titulo="Todos os arquivos"')
    );
    expect(todosBloco).toMatch(/files=\{filtered\}/);
  });

  it('"Ver tudo ›" é só uma âncora para "Todos os arquivos" na mesma tela', () => {
    expect(arquivos).toMatch(
      /href=\{`#\$\{TODOS_OS_ARQUIVOS_ID\}`\}[\s\S]{0,400}Ver tudo ›/
    );
  });

  it("segue a ordem do mockup: título, Protegido, Enviar, categorias, Recentes, Todos os arquivos", () => {
    const content = cofreTab.slice(mainReturnIdx);
    const ordem = [
      />\s*Cofre\s*<\/h1>/,
      />\s*Protegido\s*<\/h2>/,
      /<Upload size=\{22\} \/>/,
      /ORDEM_AZULEJOS\.map/,
      /<SecaoCofre titulo="Recentes" verTudo>/,
      /<SecaoCofre titulo="Todos os arquivos"/,
    ].map((re) => {
      const m = content.match(re);
      expect(m, String(re)).not.toBeNull();
      return m!.index!;
    });
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
  });

  it("os 3 números do card Protegido são dados reais (contagem, soma de tamanhos, último envio), sem cota nem porcentagem", () => {
    expect(cofreTab).toContain("const usado = totalUsado(files);");
    expect(cofreTab).toContain("const ultimo = ultimoEnvio(files);");
    expect(cofreTab).toMatch(
      /\{formatTamanho\(usado\)\}(\{" "\}|\s)[\s\S]{0,160}>usado</
    );
    expect(cofreTab).toMatch(
      /\{ultimo \?\? "—"\}(\{" "\}|\s)[\s\S]{0,120}>último</
    );
    // Só código (comentários explicam justamente que não existe cota), e só
    // o bloco do card: um `calc(100% ...)` do CSS da fileira de azulejos não
    // é "porcentagem de cota", que é o que esta regra protege.
    const inicio = cofreTab.indexOf("<Shield size={26}");
    const codigo = cofreTab
      .slice(inicio, cofreTab.indexOf(">último<", inicio))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(inicio).toBeGreaterThan(-1);
    expect(codigo).not.toMatch(/\d\s*%|cota|quota/i);
  });

  it("o card Protegido usa os tokens --hero-* da fundação (J01)", () => {
    expect(cofreTab).toContain('background: "var(--hero-bg)"');
    expect(cofreTab).toContain('boxShadow: "0 14px 30px var(--hero-shadow)"');
    expect(cofreTab).toContain('color: "var(--hero-text-muted)"');
  });
});

describe("Categorias: a lista real do app, não as 3 do mockup", () => {
  it("os chips usam CATS com Todos + as 4 categorias reais, incluindo Pessoal", () => {
    const cats = cofreTab.match(/const CATS:[\s\S]*?\];/)![0];
    const ids = [...cats.matchAll(/id: "([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual([
      "todos",
      "comprovantes",
      "conversas",
      "documentos",
      "pessoal",
    ]);
    // Os chips viraram os azulejos do mockup, mas a lista de categorias é a
    // mesma: ORDEM_AZULEJOS cobre as 5 de CATS, nenhuma some.
    const ordem = cofreTab.match(/const ORDEM_AZULEJOS:[\s\S]*?\];/)![0];
    const nosAzulejos = [...ordem.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect([...nosAzulejos].sort()).toEqual([...ids].sort());
  });

  it("o rótulo da categoria em cada linha vem de CATS, sem texto próprio", () => {
    expect(cofreTab).toContain("CATS.find((c) => c.id === cat)?.label");
    expect(cofreTab).toMatch(/rotuloCategoria=\{rotuloCategoria\}/);
    expect(arquivos).not.toMatch(
      /"(Comprovantes|Conversas|Documentos|Pessoal)"/
    );
  });
});

describe("A proteção continua fiada e o visual novo não passa por fora dela", () => {
  it("os dois gates ainda retornam antes do conteúdo, e todo o conteúdo novo está depois deles", () => {
    expect(hiddenGateIdx).toBeGreaterThan(-1);
    expect(lockedGateIdx).toBeGreaterThan(hiddenGateIdx);
    expect(mainReturnIdx).toBeGreaterThan(lockedGateIdx);
    for (const marca of [
      "<SecaoCofre",
      "<ListaArquivos",
      "onClick={onEnviar}",
      "ORDEM_AZULEJOS.map",
      "<Shield size={26}",
    ]) {
      const idx = cofreTab.indexOf(marca, lockedGateIdx);
      expect(idx, marca).toBeGreaterThan(mainReturnIdx);
      expect(cofreTab.lastIndexOf(marca, lockedGateIdx), marca).toBe(-1);
    }
  });

  it("perder foco/visibilidade/pagehide continua travando, sem destravar sozinho", () => {
    expect(cofreTab).toContain(
      'document.addEventListener("visibilitychange", onVisibilityChange);'
    );
    expect(cofreTab).toContain('document.addEventListener("pagehide", lock);');
    expect(cofreTab).toContain('window.addEventListener("blur", lock);');
    expect(cofreTab).toContain("setUnlocked(nextUnlockedOnLoseFocus());");
    expect(cofreTab.match(/setUnlocked\(true\)/g)).toHaveLength(1);
  });

  it("o PIN continua sendo o PinScreen real, em portal, como única saída do estado travado", () => {
    expect(cofreTab).toMatch(
      /return createPortal\(\s*<PinScreen[\s\S]*?onUnlock=\{\(\) => setUnlocked\(true\)\}/
    );
  });

  it("os arquivos novos não tocam trava, foco, cache, rede nem PIN", () => {
    for (const src of [arquivos, resumo]) {
      expect(src).not.toMatch(
        /addEventListener|setUnlocked|lockGate|PinScreen|supabase|createSignedUrl|localStorage|sessionStorage/
      );
      // só o tipo do cache, nunca o módulo
      expect(src).not.toMatch(
        /import\s+\*\s+as\s+cofreCache|import\s*{[^}]*}\s*from\s*"@\/lib\/cofre\/cofreCache"/
      );
    }
  });

  it("as linhas abrem o arquivo pelo openFile de sempre (URL assinada de 120s, na hora)", () => {
    const listas = cofreTab.match(/<ListaArquivos[\s\S]*?\/>/g) ?? [];
    expect(listas).toHaveLength(2);
    for (const lista of listas) expect(lista).toContain("onOpen={openFile}");
    expect(arquivos).toContain("onClick={() => onOpen(f.path)}");
  });

  it('"Enviar" não abre um UploadSheet de dentro do Cofre (o seletor de arquivo tira o foco e o Cofre trava): depende de onEnviar da página', () => {
    expect(cofreTab).not.toMatch(/import\s*{[^}]*\bUploadSheet\b/);
    expect(cofreTab).toContain("onEnviar?: () => void;");
    expect(cofreTab).toMatch(/onClick=\{onEnviar\}\s*disabled=\{!onEnviar\}/);
  });

  it("os arquivos protegidos ficaram intocados nesta branch (conteúdo idêntico ao da base é checado pelo diff; aqui, a presença)", () => {
    expect(read("components/cofre/lockGate.ts")).toContain(
      "export function computeGateState"
    );
    expect(read("lib/cofre/cofreCache.ts")).toContain(
      "export interface CofreFile"
    );
  });
});

describe("Nenhum nome de arquivo, tamanho ou data do mockup no código", () => {
  const ILUSTRATIVOS = [
    "recibo-renata-ferreira",
    "print-combinado-marcos",
    "lembrete-consulta",
    "recibo-camila-duarte",
    "contrato-studio",
    "recibo-juliana",
    "print-agenda-julho",
    "rg-frente",
    "Renata",
    "1,3 MB",
    "19/09",
    "239 KB",
    "305 KB",
    "86 KB",
    "193 KB",
    "412 KB",
    "198 KB",
    "288 KB",
    "19 de set",
    "17 de set",
    "Trava do app ativa",
  ];
  const arquivosCofre = readdirSync(join(ROOT, "components/cofre")).map(
    (f) => `components/cofre/${f}`
  );

  it.each(arquivosCofre)("%s não contém valor do mockup", (arquivo) => {
    const src = read(arquivo);
    for (const valor of ILUSTRATIVOS) {
      expect(src, `${valor} em ${arquivo}`).not.toContain(valor);
    }
  });
});

// ---------------------------------------------------------------------------
// Lógica pura
// ---------------------------------------------------------------------------

function arquivo(
  nome: string,
  createdAt: string,
  size = 1000,
  categoria = "documentos"
): CofreFile {
  return {
    name: nome,
    path: `u/${categoria}/${nome}`,
    categoria,
    size,
    createdAt,
  };
}

describe("cofreResumo", () => {
  it("formatTamanho usa vírgula decimal e as mesmas faixas B/KB/MB", () => {
    expect(formatTamanho(0)).toBe("0 B");
    expect(formatTamanho(512)).toBe("512 B");
    expect(formatTamanho(2048)).toBe("2 KB");
    expect(formatTamanho(2.5 * 1024 * 1024)).toBe("2,5 MB");
    expect(formatTamanho(3 * 1024 * 1024)).toBe("3 MB");
    expect(formatTamanho(-5)).toBe("0 B");
    expect(formatTamanho(Number.NaN)).toBe("0 B");
  });

  it("totalUsado soma os tamanhos reais e ignora negativos", () => {
    expect(totalUsado([])).toBe(0);
    expect(
      totalUsado([
        arquivo("a", "2026-10-01T10:00:00Z", 1000),
        arquivo("b", "2026-10-02T10:00:00Z", 24),
        arquivo("c", "x", -3),
      ])
    ).toBe(1024);
  });

  it("ultimoEnvio: data do mais recente em dd/mm; null com Cofre vazio ou sem data válida", () => {
    expect(ultimoEnvio([])).toBeNull();
    expect(ultimoEnvio([arquivo("a", "lixo")])).toBeNull();
    expect(
      ultimoEnvio([
        arquivo("a", "2026-09-28T12:00:00"),
        arquivo("b", "2026-10-03T12:00:00"),
        arquivo("c", "2026-07-01T12:00:00"),
      ])
    ).toBe("03/10");
  });

  it(`recentes: no máximo ${RECENTES_MAX}, do mais novo pro mais antigo, sem alterar a lista original`, () => {
    const lista = [
      arquivo("1", "2026-01-01T00:00:00Z"),
      arquivo("5", "2026-05-01T00:00:00Z"),
      arquivo("3", "2026-03-01T00:00:00Z"),
      arquivo("6", "2026-06-01T00:00:00Z"),
      arquivo("2", "2026-02-01T00:00:00Z"),
      arquivo("4", "2026-04-01T00:00:00Z"),
    ];
    const copia = [...lista];
    expect(recentes(lista).map((f) => f.name)).toEqual(["6", "5", "4", "3"]);
    expect(lista).toEqual(copia);
    expect(recentes(lista.slice(0, 2)).map((f) => f.name)).toEqual(["5", "1"]);
    expect(recentes([])).toEqual([]);
  });

  it("formatDataArquivo: dia com 2 dígitos e mês abreviado; traço para data inválida", () => {
    expect(formatDataArquivo("2026-10-03T12:00:00")).toBe("03 de out.");
    expect(formatDataArquivo("lixo")).toBe("—");
  });
});
