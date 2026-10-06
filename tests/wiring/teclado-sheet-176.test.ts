import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MARGEM_CAMPO_PX,
  VARIAVEIS_TECLADO,
  areaVisivel,
  deslocamentoParaMostrar,
  instalarCampoVisivel,
  recuoDoTeclado,
  variaveisDoTeclado,
  type ElementoDoSheet,
  type JanelaDoSheet,
  type PainelDoSheet,
} from "../../lib/useCampoVisivelComTeclado";

/**
 * #176 — o teclado do celular cobria o campo ativo no Novo atendimento
 * (`JobForm`), na Nova Despesa (`DespesaForm`) e na Nova Entrada
 * (`ReceitaForm`). Os três têm casca de sheet própria (não usam o
 * `BottomSheet` compartilhado). A correção é o hook
 * `lib/useCampoVisivelComTeclado.ts`, ligado só nesses três formulários.
 *
 * Três partes:
 * 1. as contas puras, executadas;
 * 2. o efeito inteiro (`instalarCampoVisivel`), executado com uma janela,
 *    um `visualViewport`, um painel e campos falsos — confere o VALOR das
 *    variáveis, a rolagem limitada pela área visível e a limpeza;
 * 3. a fiação nos três formulários, lida no fonte (sem RTL/JSX no Vitest).
 * A medição na tela, antes e depois, está em
 * docs/jornada/prints/176/medicao-*.json (tests/visual/teclado-176.mjs).
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");

// ---------------------------------------------------------------------------
// 1. Contas puras
// ---------------------------------------------------------------------------

describe("recuoDoTeclado", () => {
  it("iPhone: a janela não muda e o visualViewport encolhe — o recuo é o tamanho do teclado", () => {
    expect(recuoDoTeclado(844, { height: 508, offsetTop: 0 })).toBe(336);
  });

  it("sem teclado, ou com a janela inteira redimensionada (Android), o recuo é zero", () => {
    expect(recuoDoTeclado(844, { height: 844, offsetTop: 0 })).toBe(0);
    expect(recuoDoTeclado(508, { height: 508, offsetTop: 0 })).toBe(0);
  });

  it("desconta o deslocamento do visualViewport (página rolada por baixo do teclado)", () => {
    expect(recuoDoTeclado(844, { height: 508, offsetTop: 100 })).toBe(236);
  });

  it("nunca negativo, e zero sem visualViewport", () => {
    expect(recuoDoTeclado(500, { height: 600, offsetTop: 0 })).toBe(0);
    expect(recuoDoTeclado(844, null)).toBe(0);
    expect(recuoDoTeclado(844, undefined)).toBe(0);
  });
});

describe("variaveisDoTeclado", () => {
  it("com teclado: o recuo e a altura útil do visualViewport (não a da janela)", () => {
    expect(variaveisDoTeclado(844, { height: 508, offsetTop: 0 })).toEqual({
      "--teclado-inset": "336px",
      "--teclado-altura-util": "508px",
    });
    expect(variaveisDoTeclado(932, { height: 596.4, offsetTop: 0 })).toEqual({
      "--teclado-inset": "336px",
      "--teclado-altura-util": "596px",
    });
  });

  it("sem teclado (ou Android): nenhuma variável", () => {
    expect(variaveisDoTeclado(844, { height: 844, offsetTop: 0 })).toBeNull();
    expect(variaveisDoTeclado(508, { height: 508, offsetTop: 0 })).toBeNull();
    expect(variaveisDoTeclado(844, null)).toBeNull();
  });

  it("escreve exatamente as duas variáveis que os formulários leem", () => {
    expect([...VARIAVEIS_TECLADO]).toEqual([
      "--teclado-inset",
      "--teclado-altura-util",
    ]);
  });
});

describe("areaVisivel", () => {
  const container = { top: 100, bottom: 800 };

  it("corta o container pelo fim do visualViewport (o teclado cobre o resto)", () => {
    expect(areaVisivel(container, { height: 508, offsetTop: 0 }, 844)).toEqual({
      top: 100,
      bottom: 508,
    });
  });

  it("corta também pelo topo do visualViewport", () => {
    expect(
      areaVisivel(container, { height: 400, offsetTop: 200 }, 844)
    ).toEqual({ top: 200, bottom: 600 });
  });

  it("container todo à vista: a área é o próprio container", () => {
    expect(
      areaVisivel({ top: 100, bottom: 400 }, { height: 844, offsetTop: 0 }, 844)
    ).toEqual({ top: 100, bottom: 400 });
  });

  it("sem visualViewport: corta pela janela", () => {
    expect(areaVisivel(container, null, 600)).toEqual({
      top: 100,
      bottom: 600,
    });
  });
});

describe("deslocamentoParaMostrar", () => {
  const area = { top: 100, bottom: 500 };

  it("campo já inteiro à vista (com folga): não rola", () => {
    expect(deslocamentoParaMostrar({ top: 200, bottom: 248 }, area)).toBe(0);
  });

  it("campo abaixo da área: rola pra baixo até a base do campo + folga", () => {
    expect(deslocamentoParaMostrar({ top: 600, bottom: 648 }, area)).toBe(
      648 - (500 - MARGEM_CAMPO_PX)
    );
  });

  it("campo encostado na base sem folga: ainda rola a folga", () => {
    expect(deslocamentoParaMostrar({ top: 452, bottom: 500 }, area)).toBe(
      MARGEM_CAMPO_PX
    );
  });

  it("campo acima da área: rola pra cima", () => {
    expect(deslocamentoParaMostrar({ top: 50, bottom: 98 }, area)).toBe(
      50 - (100 + MARGEM_CAMPO_PX)
    );
  });

  it("campo maior que a área: alinha pelo topo", () => {
    expect(deslocamentoParaMostrar({ top: 300, bottom: 900 }, area)).toBe(
      300 - (100 + MARGEM_CAMPO_PX)
    );
  });
});

// ---------------------------------------------------------------------------
// 2. O efeito inteiro, executado com uma janela falsa
// ---------------------------------------------------------------------------

function alvoDeEventos() {
  const ouvintes = new Map<string, Set<() => void>>();
  return {
    ouvintes,
    addEventListener(tipo: string, f: () => void) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo)!.add(f);
    },
    removeEventListener(tipo: string, f: () => void) {
      ouvintes.get(tipo)?.delete(f);
    },
    disparar(tipo: string) {
      for (const f of [...(ouvintes.get(tipo) ?? [])]) f();
    },
    total() {
      return [...ouvintes.values()].reduce((s, set) => s + set.size, 0);
    },
  };
}

/**
 * Janela de 844px. O painel do sheet vai de 100 a 844 e o corpo rolável de
 * 160 a 800 (o falso não encolhe sozinho). O campo está a 600–648 no
 * conteúdo: dentro do corpo, mas abaixo do fim do visualViewport (508)
 * quando o teclado de 336px abre. `requestAnimationFrame` enfileira, como no
 * navegador, e o cenário roda a fila depois de cada evento (`quadro()`).
 */
function cenario() {
  const vvEventos = alvoDeEventos();
  const viewport = {
    height: 844,
    offsetTop: 0,
    addEventListener: vvEventos.addEventListener,
    removeEventListener: vvEventos.removeEventListener,
  };
  const janelaEventos = alvoDeEventos();
  const painelEventos = alvoDeEventos();
  const estilo = new Map<string, string>();
  const overflow = new Map<unknown, string>();
  const documento = { activeElement: null as unknown };
  /** Que tipo de campo o elemento focado é (o seletor do hook decide). */
  const tipo = { atual: "input" };
  const fila = new Map<number, () => void>();
  let proximoId = 1;
  function quadro() {
    const agora = [...fila.values()];
    fila.clear();
    for (const cb of agora) cb();
  }

  const painel: PainelDoSheet = {
    parentElement: null,
    scrollHeight: 744,
    clientHeight: 744,
    scrollTop: 0,
    getBoundingClientRect: () => ({ top: 100, bottom: 844 }),
    matches: () => false,
    style: {
      setProperty: (n, v) => void estilo.set(n, v),
      removeProperty: (n) => estilo.delete(n),
    },
    contains: (outro) => outro === campo || outro === corpo,
    addEventListener: painelEventos.addEventListener,
    removeEventListener: painelEventos.removeEventListener,
  };
  const corpo: ElementoDoSheet = {
    parentElement: painel,
    scrollHeight: 1200,
    clientHeight: 640,
    scrollTop: 0,
    getBoundingClientRect: () => ({ top: 160, bottom: 800 }),
    matches: () => false,
  };
  overflow.set(corpo, "auto");
  const campo: ElementoDoSheet = {
    parentElement: corpo,
    scrollHeight: 48,
    clientHeight: 48,
    scrollTop: 0,
    getBoundingClientRect: () => ({
      top: 600 - corpo.scrollTop,
      bottom: 648 - corpo.scrollTop,
    }),
    matches: (sel) =>
      sel
        .split(",")
        .map((x) => x.trim())
        .includes(tipo.atual),
  };

  const janela: JanelaDoSheet = {
    innerHeight: 844,
    visualViewport: viewport,
    document: documento,
    addEventListener: janelaEventos.addEventListener,
    removeEventListener: janelaEventos.removeEventListener,
    requestAnimationFrame: (cb) => {
      const id = proximoId++;
      fila.set(id, cb);
      return id;
    },
    cancelAnimationFrame: (id) => void fila.delete(id),
    getComputedStyle: (el) => ({ overflowY: overflow.get(el) ?? "visible" }),
  };

  return {
    janela,
    painel,
    corpo,
    campo,
    estilo,
    vvEventos,
    janelaEventos,
    painelEventos,
    fila,
    tipo,
    instalar() {
      const limpar = instalarCampoVisivel(painel, janela);
      quadro();
      return limpar;
    },
    abrirTeclado(px: number) {
      viewport.height = janela.innerHeight - px;
      vvEventos.disparar("resize");
      quadro();
    },
    focar(el: unknown) {
      documento.activeElement = el;
      painelEventos.disparar("focusin");
      quadro();
    },
  };
}

describe("instalarCampoVisivel (o efeito do hook, executado)", () => {
  it("sem teclado, não escreve variável nenhuma", () => {
    const c = cenario();
    c.instalar();
    expect(c.estilo.size).toBe(0);
  });

  it("iPhone: com o teclado aberto, escreve o recuo e a altura útil DO visualViewport", () => {
    const c = cenario();
    c.instalar();
    c.abrirTeclado(336);
    expect(c.estilo.get("--teclado-inset")).toBe("336px");
    expect(c.estilo.get("--teclado-altura-util")).toBe("508px");
  });

  it("ao fechar o teclado, remove as variáveis", () => {
    const c = cenario();
    c.instalar();
    c.abrirTeclado(336);
    c.abrirTeclado(0);
    expect(c.estilo.size).toBe(0);
  });

  it("rola o corpo até o campo focado caber ACIMA do teclado (área limitada pelo visualViewport)", () => {
    const c = cenario();
    c.instalar();
    c.focar(c.campo);
    // Sem teclado o campo (600–648) já cabe no corpo (160–800): não rola.
    expect(c.corpo.scrollTop).toBe(0);
    c.abrirTeclado(336);
    // Com teclado, a área visível termina em 508: rola até 648 caber com folga.
    expect(c.corpo.scrollTop).toBe(648 - (508 - MARGEM_CAMPO_PX));
    const r = c.campo.getBoundingClientRect();
    expect(r.bottom).toBeLessThanOrEqual(508 - MARGEM_CAMPO_PX);
    expect(r.top).toBeGreaterThanOrEqual(160);
  });

  it.each(["textarea", "select"])(
    "também rola até um %s focado (Observações é textarea)",
    (t) => {
      const c = cenario();
      c.tipo.atual = t;
      c.instalar();
      c.focar(c.campo);
      c.abrirTeclado(336);
      expect(c.corpo.scrollTop).toBe(648 - (508 - MARGEM_CAMPO_PX));
    }
  );

  it("não rola por elemento que não é campo de formulário (ex.: botão)", () => {
    const c = cenario();
    c.tipo.atual = "button";
    c.instalar();
    c.focar(c.campo);
    c.abrirTeclado(336);
    expect(c.corpo.scrollTop).toBe(0);
  });

  it("não rola por campo fora do sheet nem por elemento que não é campo", () => {
    const c = cenario();
    c.instalar();
    c.abrirTeclado(336);
    c.focar({ ...c.campo }); // outro campo, que o painel não contém
    expect(c.corpo.scrollTop).toBe(0);
    c.focar(c.corpo); // dentro do painel, mas não é campo
    expect(c.corpo.scrollTop).toBe(0);
  });

  it("ouve o resize e o scroll do visualViewport, o resize da janela e o foco no painel", () => {
    const c = cenario();
    c.instalar();
    expect(c.vvEventos.ouvintes.get("resize")?.size).toBe(1);
    expect(c.vvEventos.ouvintes.get("scroll")?.size).toBe(1);
    expect(c.janelaEventos.ouvintes.get("resize")?.size).toBe(1);
    expect(c.painelEventos.ouvintes.get("focusin")?.size).toBe(1);
  });

  it("a limpeza (sheet fechado) remove todos os ouvintes e as variáveis", () => {
    const c = cenario();
    const limpar = c.instalar();
    c.abrirTeclado(336);
    expect(c.estilo.size).toBe(2);
    c.vvEventos.disparar("resize"); // agenda um quadro que não chega a rodar
    limpar();
    expect(c.fila.size).toBe(0);
    expect(c.estilo.size).toBe(0);
    expect(c.vvEventos.total()).toBe(0);
    expect(c.janelaEventos.total()).toBe(0);
    expect(c.painelEventos.total()).toBe(0);
  });
});

describe("useCampoVisivelComTeclado (o hook)", () => {
  const hook = read("lib/useCampoVisivelComTeclado.ts");

  it("só liga o efeito real ao React, com o sheet aberto, na janela de verdade", () => {
    expect(hook).toMatch(
      /if \(!aberto \|\| !painel\) return;\s*return instalarCampoVisivel\(painel, window\);\s*\}, \[painelRef, aberto\]\);/
    );
  });

  it("rola só o container do sheet, nunca a página (sem scrollIntoView nem window.scrollTo)", () => {
    expect(hook).not.toMatch(/scrollIntoView\(|\.scroll(To|By)?\(/);
  });
});

// ---------------------------------------------------------------------------
// 3. Fiação nos três formulários
// ---------------------------------------------------------------------------

const FORMULARIOS = [
  {
    arquivo: "components/jobs/JobForm.tsx",
    nome: "Novo atendimento",
    alturaBase: "90dvh",
    alturaUtilBase: "100dvh",
  },
  {
    arquivo: "components/financeiro/DespesaForm.tsx",
    nome: "Nova Despesa",
    alturaBase: "90vh",
    alturaUtilBase: "100vh",
  },
  {
    arquivo: "components/financeiro/ReceitaForm.tsx",
    nome: "Nova Entrada",
    alturaBase: "90vh",
    alturaUtilBase: "100vh",
  },
];

/** A tag de abertura do painel `role="dialog"`, com o `style` que vem logo depois. */
function painelDoFonte(src: string): string {
  const inicio = src.indexOf('role="dialog"');
  expect(inicio, 'role="dialog" não encontrado').toBeGreaterThan(-1);
  const abertura = src.lastIndexOf("<div", inicio);
  const fimStyle = src.indexOf("}}", inicio);
  return src.slice(abertura, fimStyle);
}

describe.each(FORMULARIOS)(
  "$nome ($arquivo)",
  ({ arquivo, alturaBase, alturaUtilBase }) => {
    const src = read(arquivo);
    const tag = painelDoFonte(src);

    it("importa o hook real e o liga no painel do sheet, com o estado `open`", () => {
      expect(src).toMatch(
        /import \{ useCampoVisivelComTeclado \} from "@\/lib\/useCampoVisivelComTeclado";/
      );
      expect(src).toContain("const painelRef = useRef<HTMLDivElement>(null);");
      expect(src).toContain("useCampoVisivelComTeclado(painelRef, open);");
      expect(tag).toContain("ref={painelRef}");
    });

    it("o painel sobe acima do teclado: bottom vem do recuo, com 0px quando não há teclado", () => {
      expect(tag).toContain('bottom: "var(--teclado-inset, 0px)",');
      expect(tag).not.toMatch(/\bbottom: 0,/);
    });

    it(`a altura máxima cabe na área útil, e sem teclado continua ${alturaBase}`, () => {
      expect(tag.replace(/\s+/g, " ")).toContain(
        `maxHeight: "min(${alturaBase}, calc(var(--teclado-altura-util, ${alturaUtilBase}) * 0.9))",`
      );
    });

    it("não sobrou classe de altura máxima competindo com o maxHeight", () => {
      const classe = tag.match(/className="([^"]*)"/)?.[1] ?? "";
      expect(classe).not.toMatch(/max-h-/);
    });
  }
);

describe("Escopo: só os três formulários em sheet", () => {
  it("o BottomSheet compartilhado e o MetaForm não usam o hook", () => {
    for (const arquivo of [
      "components/ui/BottomSheet.tsx",
      "components/financeiro/MetaForm.tsx",
    ]) {
      expect(read(arquivo), arquivo).not.toContain("useCampoVisivelComTeclado");
    }
  });
});
