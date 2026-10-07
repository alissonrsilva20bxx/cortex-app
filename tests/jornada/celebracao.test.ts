import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { Comemoracao } from "../../lib/jornada/estado";
import {
  _usarAudioParaTeste,
  tocarSom,
  type NomeSom,
} from "../../lib/jornada/som";
import * as textos from "../../lib/jornada/textos";
import {
  type Ambiente,
  TEMPOS,
  planoDaComemoracao,
  proximaParaTocar,
  textosDaComemoracao,
} from "../../components/jornada/celebracao/decidir";
import {
  _resetSessao,
  adiadasDaSessao,
  liberarAdiadas,
  primeiraVezDoConsumo,
  primeiraVezDoSom,
} from "../../components/jornada/celebracao/sessao";

/**
 * J13 (#163) — comemorações, sons e Modo discreto.
 *
 * O vitest daqui roda em node (sem DOM), então: a lógica (ordem, plano,
 * textos, sessão) é testada executando; o som, com um AudioContext falso;
 * o palco React, pelas garantias que ele tem que ter no código. E a
 * "intensidade na medida" é conferida contra o protótipo aprovado: os
 * tempos, as quantidades de partícula e as notas de cada som têm que ser
 * os de lá.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");
const DIR = "components/jornada/celebracao";
const ARQUIVOS = [
  ...readdirSync(join(ROOT, DIR))
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .map((f) => `${DIR}/${f}`),
  "lib/jornada/som.ts",
];
const PROTOTIPO = read("docs/jornada/referencias/prototipo-sua-jornada.html");
const PALCO = read(`${DIR}/ComemoracaoPalco.tsx`);

function soCodigo(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

let seq = 0;
function c(tipo: Comemoracao["tipo"], extra: Partial<Comemoracao> = {}) {
  return {
    id: `c${++seq}`,
    tipo,
    glow: tipo === "estagio" ? 0 : 20,
    ganhou: true,
    ...(tipo === "pequena" ? { acao: "despesa" as const, glow: 5 } : {}),
    ...(tipo === "selo"
      ? { selo: "planejadora" as const, nivel: 1 as const }
      : {}),
    ...(tipo === "estagio" ? { estagio: 2 } : {}),
    ...(tipo === "capitulo" ? { capitulo: { ano: 2026, mes: 10 } } : {}),
    ...(tipo === "marco" ? { marco: 500 as const, glow: 50 } : {}),
    ...(tipo === "meta" ? { glow: 100 } : {}),
    ...extra,
  } satisfies Comemoracao;
}

const NORMAL: Ambiente = {
  somLigado: true,
  modoDiscreto: false,
  movimentoReduzido: false,
};
const DISCRETO: Ambiente = { ...NORMAL, modoDiscreto: true };
const REDUZIDO: Ambiente = { ...NORMAL, movimentoReduzido: true };
const TIPOS: Comemoracao["tipo"][] = [
  "pequena",
  "selo",
  "estagio",
  "capitulo",
  "marco",
  "meta",
];

beforeEach(() => {
  _resetSessao();
  _usarAudioParaTeste(undefined);
});

// ---------------------------------------------------------------------------
// AudioContext falso
// ---------------------------------------------------------------------------

interface Gravacao {
  freqs: number[];
  ctor: number;
  /** `navigator.audioSession.type` no instante em que o contexto nasceu. */
  sessaoAoCriar: string | undefined;
}

function audioFalso(
  opcoes: {
    estado?: AudioContextState;
    resume?: () => Promise<void>;
    quebraAo?: "criar" | "oscilador";
  } = {}
) {
  const g: Gravacao = { freqs: [], ctor: 0, sessaoAoCriar: undefined };
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const no = () => ({ connect: vi.fn() });
  class Falso {
    state: AudioContextState = opcoes.estado ?? "running";
    currentTime = 0;
    sampleRate = 8000;
    destination = {};
    constructor() {
      g.ctor++;
      g.sessaoAoCriar = (
        globalThis.navigator as unknown as {
          audioSession?: { type: string };
        }
      )?.audioSession?.type;
      if (opcoes.quebraAo === "criar") throw new Error("sem áudio");
    }
    resume() {
      return opcoes.resume ? opcoes.resume() : Promise.resolve();
    }
    createGain() {
      return { ...no(), gain: param() };
    }
    createDynamicsCompressor() {
      return no();
    }
    createOscillator() {
      if (opcoes.quebraAo === "oscilador") throw new Error("quebrou");
      const freq = param();
      freq.setValueAtTime = vi.fn((f: number) => {
        g.freqs.push(f);
      });
      return {
        ...no(),
        type: "sine",
        frequency: freq,
        start: vi.fn(),
        stop: vi.fn(),
      };
    }
    createBuffer(_c: number, n: number) {
      return { getChannelData: () => new Float32Array(n) };
    }
    createBufferSource() {
      return { ...no(), buffer: null, start: vi.fn(), stop: vi.fn() };
    }
    createBiquadFilter() {
      return { ...no(), type: "", Q: { value: 0 }, frequency: param() };
    }
  }
  _usarAudioParaTeste(Falso as unknown as new () => AudioContext);
  return g;
}

afterEach(() => {
  _usarAudioParaTeste(undefined);
});

// ---------------------------------------------------------------------------
// 1. A fila sai na ordem que veio
// ---------------------------------------------------------------------------

describe("a fila sai na ordem que veio, de uma em uma", () => {
  function tocarTudo(fila: Comemoracao[]): string[] {
    const tocadas: string[] = [];
    let resto = [...fila];
    for (;;) {
      const p = proximaParaTocar(resto, adiadasDaSessao(resto));
      if (!p) break;
      tocadas.push(p.id);
      resto = resto.filter((x) => x.id !== p.id); // consumir
    }
    return tocadas;
  }

  it("pequena → selo → estágio → capítulo → marco → meta, sem reordenar", () => {
    const fila = TIPOS.map((t) => c(t));
    expect(tocarTudo(fila)).toEqual(fila.map((x) => x.id));
  });

  it("não reordena nem quando o servidor manda numa ordem estranha", () => {
    const fila = [c("meta"), c("pequena"), c("selo"), c("pequena")];
    expect(tocarTudo(fila)).toEqual(fila.map((x) => x.id));
  });

  it("uma de cada vez: a próxima é sempre a primeira que pode tocar", () => {
    const fila = [c("selo"), c("estagio")];
    expect(proximaParaTocar(fila, new Set())?.id).toBe(fila[0].id);
  });
});

// ---------------------------------------------------------------------------
// 2. Comemoração grande do atendimento fica pra próxima abertura
// ---------------------------------------------------------------------------

describe("adiada (registro de atendimento) espera a próxima abertura", () => {
  it("adiada que chega NESTA abertura não toca; as outras seguem na ordem", () => {
    const aoAbrir: Comemoracao[] = [];
    adiadasDaSessao(aoAbrir); // o host viu a fila (vazia) ao abrir
    const pequena = c("pequena", { acao: "atendimento", glow: 0 });
    const selo = c("selo", { adiada: true });
    const depois = c("pequena");
    const fila = [pequena, selo, depois];
    const adiadas = adiadasDaSessao(fila);
    expect(proximaParaTocar(fila, adiadas)?.id).toBe(pequena.id);
    const semPequena = [selo, depois];
    expect(proximaParaTocar(semPequena, adiadasDaSessao(semPequena))?.id).toBe(
      depois.id
    );
    // ...e o selo continua na fila (persistida pela J11), sem ser consumido.
    expect(proximaParaTocar([selo], adiadasDaSessao([selo]))).toBeNull();
  });

  it("adiada que já estava na fila ao abrir o app (abertura anterior) toca", () => {
    const selo = c("selo", { adiada: true });
    expect(proximaParaTocar([selo], adiadasDaSessao([selo]))?.id).toBe(selo.id);
  });

  it("voltar o app ao primeiro plano conta como nova abertura", () => {
    adiadasDaSessao([]);
    const selo = c("selo", { adiada: true });
    expect(proximaParaTocar([selo], adiadasDaSessao([selo]))).toBeNull();
    liberarAdiadas();
    expect(proximaParaTocar([selo], adiadasDaSessao([selo]))?.id).toBe(selo.id);
  });
});

// ---------------------------------------------------------------------------
// 3. Modo discreto
// ---------------------------------------------------------------------------

describe("Modo discreto: sem som, mínimo, nada chamativo", () => {
  it.each(TIPOS)(
    "%s: sem som, sem vibração, sem efeito, só o aviso neutro",
    (t) => {
      const p = planoDaComemoracao(c(t), DISCRETO);
      expect(p.som).toBeNull();
      expect(p.vibracao).toBeNull();
      expect(p.efeitos).toBe(false);
      expect(p.forma).toBe("aviso");
      expect(p.neutro).toBe(true);
    }
  );

  it.each(TIPOS)("%s: o texto não mostra Glow nem dinheiro", (t) => {
    const tx = textosDaComemoracao(c(t), true);
    const tudo = Object.values(tx).join(" ");
    expect(tudo).not.toContain(textos.NOME_GLOW);
    expect(tudo).not.toMatch(/€/);
  });

  it("com o Modo discreto ligado, o som nunca é agendado", () => {
    const g = audioFalso();
    for (const t of TIPOS) {
      const p = planoDaComemoracao(c(t), DISCRETO);
      expect(tocarSom(p.som ?? "check", { ligado: p.som !== null })).toBe(
        false
      );
    }
    expect(g.freqs).toEqual([]);
  });

  it("som desligado nas preferências também não toca (mas a comemoração segue)", () => {
    const p = planoDaComemoracao(c("selo"), { ...NORMAL, somLigado: false });
    expect(p.som).toBeNull();
    expect(p.forma).toBe("selo");
  });

  it("o palco só toca com `ligado` vindo do plano (que já aplicou o discreto)", () => {
    expect(soCodigo(PALCO)).toMatch(/ligado: plano\.som !== null/);
  });
});

// ---------------------------------------------------------------------------
// 4. Movimento reduzido
// ---------------------------------------------------------------------------

describe("prefers-reduced-motion: sem animação grande", () => {
  it.each(TIPOS)("%s: sem confete/partícula e sem animação de entrada", (t) => {
    const p = planoDaComemoracao(c(t), REDUZIDO);
    expect(p.efeitos).toBe(false);
    expect(p.animar).toBe(false);
  });

  it("estágio mostra a tela já pronta, com o plim curto (como o protótipo)", () => {
    const p = planoDaComemoracao(c("estagio"), REDUZIDO);
    expect(p.forma).toBe("palco");
    expect(p.som).toBe("plim");
  });

  it("o CSS desliga as animações em prefers-reduced-motion", () => {
    // Pixel do protótipo: as comemorações usam o CSS da Jornada, com a
    // mesma regra de movimento reduzido do protótipo.
    expect(read("components/jornada/jornada.module.css")).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration: 0\.01s/
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Som bloqueado não derruba a comemoração
// ---------------------------------------------------------------------------

describe("som bloqueado ou ausente não derruba nada", () => {
  const NOMES: NomeSom[] = [
    "plim",
    "tick",
    "pop",
    "check",
    "stamp",
    "stage",
    "swish",
  ];

  it("áudio bloqueado antes do 1º toque (suspended, resume recusado): não toca, não lança", async () => {
    audioFalso({
      estado: "suspended",
      resume: () => Promise.reject(new Error("bloqueado")),
    });
    for (const n of NOMES) expect(tocarSom(n, { ligado: true })).toBe(false);
    await Promise.resolve();
  });

  it("navegador sem Web Audio: não toca, não lança", () => {
    _usarAudioParaTeste(null);
    for (const n of NOMES) expect(tocarSom(n, { ligado: true })).toBe(false);
  });

  it("AudioContext que quebra ao criar ou ao tocar: não lança", () => {
    audioFalso({ quebraAo: "criar" });
    expect(() => tocarSom("stage", { ligado: true })).not.toThrow();
    audioFalso({ quebraAo: "oscilador" });
    expect(tocarSom("plim", { ligado: true })).toBe(false);
  });

  it("a comemoração não depende do som: o plano é o mesmo com ou sem áudio", () => {
    _usarAudioParaTeste(null);
    const p = planoDaComemoracao(c("estagio"), NORMAL);
    expect(p.forma).toBe("palco");
    // O palco ignora o retorno de tocarSom e segue a linha do tempo.
    expect(soCodigo(PALCO)).not.toMatch(/if \(\s*!?tocarSom/);
  });

  it("o som nunca fura o silencioso: sessão de áudio 'ambient' ANTES do contexto nascer", () => {
    const sessao = { type: "auto" };
    vi.stubGlobal("navigator", { audioSession: sessao });
    try {
      const g = audioFalso();
      expect(tocarSom("plim", { ligado: true })).toBe(true);
      expect(g.sessaoAoCriar).toBe("ambient");
      expect(sessao.type).toBe("ambient");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sem navigator.audioSession (fora do Safari) o som segue sem lançar", () => {
    vi.stubGlobal("navigator", {});
    try {
      audioFalso();
      expect(tocarSom("plim", { ligado: true })).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("áudio liberado: o plim toca as notas do protótipo", () => {
    const g = audioFalso();
    expect(tocarSom("plim", { ligado: true })).toBe(true);
    expect(g.freqs).toEqual([1318.5, 1975.5, 2637]);
  });
});

// ---------------------------------------------------------------------------
// 6. Montar duas vezes não repete
// ---------------------------------------------------------------------------

describe("o palco: voltar ao app e o aviso sair da tela", () => {
  it("voltar ao primeiro plano (visibilitychange) libera as adiadas no palco", () => {
    const codigo = soCodigo(PALCO);
    const corpo = codigo.match(/const visivel = \(\) => \{([\s\S]*?)\n {4}\};/);
    expect(corpo).not.toBeNull();
    expect(corpo![1]).toMatch(/document\.visibilityState === "visible"/);
    expect(corpo![1]).toContain("liberarAdiadas()");
    expect(codigo).toMatch(/addEventListener\("visibilitychange", visivel\)/);
  });

  it("o aviso some e sai do DOM com timers próprios (a troca de item não cancela)", () => {
    const codigo = soCodigo(PALCO);
    const mostrar = codigo.match(
      /const mostrarAviso = useCallback\(([\s\S]*?)\}, \[\]\);/
    );
    expect(mostrar).not.toBeNull();
    expect(mostrar![1]).toMatch(/avisoTimers\.current = \[/);
    expect(mostrar![1]).toMatch(/setAvisoOn\(false\), duracaoMs\)/);
    expect(mostrar![1]).toMatch(/atualAviso\?\.id === a\.id \? null/);
    // O "esconder" não mora nos timers da linha do tempo do item.
    expect(codigo).not.toMatch(/depois\(plano\.duracaoMs, \(\) => setAvisoOn/);
  });
});

describe("montar duas vezes (StrictMode) não repete comemoração", () => {
  it("o som de uma comemoração toca uma vez só", () => {
    expect(primeiraVezDoSom("x")).toBe(true);
    expect(primeiraVezDoSom("x")).toBe(false);
  });

  it("cada comemoração é consumida uma vez só", () => {
    expect(primeiraVezDoConsumo("x")).toBe(true);
    expect(primeiraVezDoConsumo("x")).toBe(false);
  });

  it("observar a fila duas vezes (duas montagens) dá o mesmo resultado", () => {
    const selo = c("selo", { adiada: true });
    const a = adiadasDaSessao([selo]);
    const b = adiadasDaSessao([selo]);
    expect([...a]).toEqual([...b]);
  });

  it("o palco só toca som e só consome passando pelas travas da sessão", () => {
    const codigo = soCodigo(PALCO);
    expect(codigo).toMatch(/if \(primeiraVezDoSom\(c\.id\)\) \{\s*tocarSom\(/);
    expect(codigo).toMatch(/if \(primeiraVezDoConsumo\(id\)\) consumir\(id\)/);
    // Nenhuma outra chamada de som ou de consumo fora das travas.
    expect(codigo.match(/tocarSom\(/g)).toHaveLength(1);
    expect(codigo.match(/consumir\(/g)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 7. Intensidade "na medida" = protótipo
// ---------------------------------------------------------------------------

describe("intensidade e sons = protótipo aprovado", () => {
  it("linha do tempo do palco e do selo com os tempos do protótipo", () => {
    expect(PROTOTIPO).toContain(`setTimeout(peak, ${TEMPOS.palcoPico})`);
    expect(PROTOTIPO).toMatch(
      new RegExp(
        `ov\\.classList\\.add\\('p4'\\); \\}, ${TEMPOS.palcoDetalhes}\\)`
      )
    );
    expect(PROTOTIPO).toMatch(
      new RegExp(
        `ov\\.classList\\.add\\('p5'\\); \\}, ${TEMPOS.palcoPronto}\\)`
      )
    );
    expect(PROTOTIPO).toMatch(
      new RegExp(`play\\('stamp', \\.3\\); \\}, ${TEMPOS.seloCarimbo}\\)`)
    );
    expect(PROTOTIPO).toMatch(new RegExp(`\\}, ${TEMPOS.seloImpacto}\\);`));
  });

  it("aviso pequeno fica 1900ms (com Glow) e 2200ms (sem), como o protótipo", () => {
    expect(planoDaComemoracao(c("pequena"), NORMAL).duracaoMs).toBe(1900);
    expect(
      planoDaComemoracao(c("pequena", { glow: 0, ganhou: false }), NORMAL)
        .duracaoMs
    ).toBe(2200);
    expect(PROTOTIPO).toContain("prefs.discreet, 1900);");
    expect(PROTOTIPO).toContain("ic('check', 18, 3), true, 2200);");
  });

  it("quantidades de partícula e confete iguais às do protótipo", () => {
    const part = soCodigo(read(`${DIR}/particulas.ts`));
    const palco = soCodigo(PALCO);
    // estouro pequeno 16 + 8, grande 34; confete 170 + 70 em 450ms
    expect(PROTOTIPO).toContain("burst(o.x, o.y, 16, false)");
    expect(PROTOTIPO).toContain("burst(W / 2 - 60, 34, 8, false)");
    expect(PROTOTIPO).toContain("burst(o.x, o.y, 34, true)");
    expect(palco).toMatch(/estouro\(w \/ 2, 34, 16, false\)/);
    expect(palco).toMatch(/estouro\(w \/ 2 - 60, 34, 8, false\)/);
    expect(palco).toMatch(/estouro\([^)]*, 34, true\)/);
    expect(PROTOTIPO).toContain("for (var i = 0; i < 170; i++)");
    expect(PROTOTIPO).toContain("for (var j = 0; j < 70; j++)");
    expect(part).toContain("for (let i = 0; i < 170; i++)");
    expect(part).toContain("for (let j = 0; j < 70; j++)");
    expect(part).toMatch(/\}, 450\)/);
  });

  it("cada som tem exatamente as notas do bloco SFX do protótipo", () => {
    const sfxProto = PROTOTIPO.slice(
      PROTOTIPO.indexOf("var SFX = {"),
      PROTOTIPO.indexOf("var lastTick")
    );
    const som = soCodigo(read("lib/jornada/som.ts"));
    const numeros = (s: string) =>
      (s.match(/\d*\.\d+|\d+/g) ?? []).map(Number).filter((n) => n >= 40);
    // Toda frequência/limiar do protótipo (>= 40) aparece no som.ts.
    const doProto = new Set(numeros(sfxProto));
    const doSom = new Set(numeros(som));
    for (const n of doProto) expect(doSom.has(n), `nota ${n}`).toBe(true);
  });

  it("som por tipo = o do protótipo (pequena: plim; selo: stamp; estágio/meta: stage)", () => {
    expect(planoDaComemoracao(c("pequena"), NORMAL).som).toBe("plim");
    expect(
      planoDaComemoracao(c("pequena", { glow: 0, ganhou: false }), NORMAL).som
    ).toBe("check");
    expect(planoDaComemoracao(c("selo"), NORMAL).som).toBe("stamp");
    expect(planoDaComemoracao(c("capitulo"), NORMAL).som).toBe("stamp");
    expect(planoDaComemoracao(c("marco"), NORMAL).som).toBe("stamp");
    expect(planoDaComemoracao(c("estagio"), NORMAL).som).toBe("stage");
    expect(planoDaComemoracao(c("meta"), NORMAL).som).toBe("stage");
    expect(planoDaComemoracao(c("selo"), NORMAL).atrasoSom).toBe(0.3);
  });

  it("forma por tipo = a do protótipo (aviso, medalha, tela cheia)", () => {
    expect(planoDaComemoracao(c("pequena"), NORMAL).forma).toBe("aviso");
    for (const t of ["selo", "capitulo", "marco"] as const)
      expect(planoDaComemoracao(c(t), NORMAL).forma).toBe("selo");
    for (const t of ["estagio", "meta"] as const)
      expect(planoDaComemoracao(c(t), NORMAL).forma).toBe("palco");
  });
});

// ---------------------------------------------------------------------------
// 8. Textos só de textos.ts
// ---------------------------------------------------------------------------

describe("nenhum texto visível fora de lib/jornada/textos.ts", () => {
  it("todo texto que a comemoração mostra sai de textos.ts", () => {
    const deTextos = new Set<string>([
      "",
      textos.LIMITE_DO_DIA,
      ...Object.values(textos.ROTULO_ACAO),
      ...Object.values(textos.TITULO_COMEMORACAO),
      textos.SELO.planejadora.nome,
      textos.SELO.planejadora.descricao,
      textos.nomeSeloComNivel("planejadora", 2),
      textos.nomeEstagio(2),
      textos.tituloCapitulo(10),
      textos.nomeEnfeite(10),
      textos.textoMarco(500),
      ...[5, 20, 50, 100].map(textos.glowGanho),
      // Pixel do protótipo: as linhas do selo, do estágio, do capítulo e do
      // marco (todas de textos.ts).
      textos.COMEMORACAO.seloNivel(2),
      textos.COMEMORACAO.capituloCompleto(10),
      textos.COMEMORACAO.enfeiteNaColecao(10),
      textos.COMEMORACAO.marcoApoio,
      ...[0, 1, 2, 3, 4, 5].map(textos.subEstagio),
    ]);
    const casos = [
      ...TIPOS.map((t) => c(t)),
      c("selo", { nivel: 2 }),
      c("pequena", { glow: 0, ganhou: false }),
    ];
    for (const disc of [false, true])
      for (const x of casos)
        for (const v of Object.values(textosDaComemoracao(x, disc)))
          expect(deTextos.has(v), `"${v}" (${x.tipo})`).toBe(true);
  });

  it.each(ARQUIVOS.filter((f) => f.endsWith(".tsx")))(
    "%s não tem texto solto no JSX",
    (arquivo) => {
      const codigo = soCodigo(read(arquivo));
      // Texto entre tags na mesma linha: >Algo< ou {expr} Algo<
      const naLinha = [
        ...codigo.matchAll(
          /[>}]([^<>{}\n;()=?:]*[A-Za-zÀ-ÿ]{2,}[^<>{}\n;()=?:]*)</g
        ),
      ].map((m) => m[1].trim());
      // Texto JSX quebrado pelo Prettier: uma linha só de palavras.
      const PALAVRAS_TS = new Set(["return", "else", "break", "default"]);
      const linhasSoTexto = codigo
        .split("\n")
        .map((l) => l.trim())
        .filter(
          (l) =>
            /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ,.!·]*$/.test(l) &&
            !l.endsWith(",") &&
            (/\s/.test(l) || /[À-ÿ]/.test(l)) &&
            !PALAVRAS_TS.has(l)
        );
      expect([...naLinha, ...linhasSoTexto]).toEqual([]);
      // Atributos com texto de interface
      expect(codigo).not.toMatch(
        /(aria-label|title|alt|placeholder)="[^"]*[A-Za-zÀ-ÿ]/
      );
    }
  );
});

// ---------------------------------------------------------------------------
// 9. A comemoração não calcula nem decide Glow
// ---------------------------------------------------------------------------

describe("a comemoração só mostra o Glow que o servidor mandou", () => {
  it.each(ARQUIVOS)(
    "%s não faz conta com Glow nem fala com o servidor",
    (arquivo) => {
      const codigo = soCodigo(read(arquivo));
      expect(codigo).not.toMatch(
        /glow\s*[-+*/]=?\s*\d|\d\s*[-+*/]\s*\w*\.glow/i
      );
      expect(codigo).not.toMatch(
        /from "@\/lib\/jornada\/(servidor|cliente|cache)"/
      );
      expect(codigo).not.toMatch(/\.rpc\(|supabase/);
    }
  );

  it("só o host fala com o hook da J11; o palco recebe tudo por props", () => {
    expect(soCodigo(PALCO)).not.toContain("useJornada");
    expect(soCodigo(read(`${DIR}/ComemoracaoHost.tsx`))).toContain(
      'from "@/components/jornada/useJornada"'
    );
  });

  it("o host repassa as preferências de verdade (a chave da J12 chega aqui)", () => {
    const host = soCodigo(read(`${DIR}/ComemoracaoHost.tsx`));
    expect(host).toMatch(/somLigado:\s*estado\.preferencias\.somLigado,/);
    expect(host).toMatch(/modoDiscreto:\s*estado\.preferencias\.modoDiscreto,/);
    expect(host).toMatch(/movimentoReduzido(,|:\s*movimentoReduzido)/);
    // E não fixa nenhuma delas.
    expect(host).not.toMatch(
      /(somLigado|modoDiscreto|movimentoReduzido):\s*(true|false)/
    );
  });

  it("o host não toca nada antes de saber as preferências (discrição)", () => {
    expect(soCodigo(read(`${DIR}/ComemoracaoHost.tsx`))).toMatch(
      /if \(!estado\) return null;/
    );
  });
});
