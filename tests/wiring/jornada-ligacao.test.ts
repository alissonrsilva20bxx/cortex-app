import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { ACOES, ACOES_DA_DICA } from "../../lib/jornada/estado";

/**
 * J15 (#165) — o motor da Jornada ligado às ações reais do app.
 *
 * Ambiente node (sem DOM): a fiação é conferida no código-fonte. Cada ação
 * da spec §3 que existe hoje no app chama o registro do hook da J11, UMA
 * vez, DEPOIS que a ação principal deu certo, sem `await` (a Jornada nunca
 * é o caminho crítico). O diff de cada componente de ação é só import +
 * hook + chamada: nenhuma linha de negócio muda.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");

function soCodigo(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function arquivos(dir: string): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${nome}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...arquivos(rel));
    else if (/\.(ts|tsx)$/.test(rel)) out.push(rel);
  }
  return out;
}

const HOOK_IMPORT =
  'import { useJornada } from "@/components/jornada/useJornada";';
const PAGE = "app/page.tsx";

/**
 * Ação da spec → componente → o que tem que vir ANTES da chamada (a prova
 * de que a ação principal deu certo) e a condição da chamada, quando há.
 */
const LIGACOES = [
  {
    acao: "despesa",
    arquivo: "components/financeiro/DespesaForm.tsx",
    hook: "const { registrar } = useJornada(userId);",
    depoisDe: 'toast.error("Erro ao salvar despesa.");\n      return;\n    }',
    chamada: 'void registrar("despesa");',
    vezes: 1,
  },
  {
    acao: "receita",
    arquivo: "components/financeiro/ReceitaForm.tsx",
    hook: "const { registrar } = useJornada(userId);",
    depoisDe: 'toast.error("Erro ao salvar entrada.");\n      return;\n    }',
    chamada: 'void registrar("receita");',
    vezes: 1,
  },
  {
    // Só atendimento NOVO: editar um atendimento não registra de novo.
    acao: "atendimento",
    arquivo: "components/jobs/JobForm.tsx",
    hook: "const { registrar } = useJornada(userId);",
    depoisDe: "if (err) return setError(err.message);",
    chamada: 'if (!job) void registrar("atendimento");',
    vezes: 1,
  },
  {
    // "Guardar comprovante no Cofre": só a categoria Comprovantes.
    acao: "comprovante_cofre",
    arquivo: "components/cofre/UploadSheet.tsx",
    hook: "const { registrar } = useJornada(userId);",
    depoisDe: "if (err) return setError(err.message);",
    chamada:
      'if (categoria === "comprovantes") void registrar("comprovante_cofre");',
    vezes: 1,
  },
  {
    // "Guardar dinheiro numa meta" = o "Já guardado" da Wishlist subiu.
    // Editar nome/alvo sem guardar dinheiro não registra.
    acao: "guardar_meta",
    arquivo: "components/rede/RedeTab.tsx",
    hook: "const { registrar } = useJornada(usuario.id);",
    depoisDe: "const atualizado = await atualizarWishlistItem(",
    chamada:
      'if (atualizado.valorAtual > existing.valorAtual)\n          void registrar("guardar_meta");',
    vezes: 2,
  },
  {
    acao: "guardar_meta",
    arquivo: "components/rede/RedeTab.tsx",
    hook: "const { registrar } = useJornada(usuario.id);",
    depoisDe: "const criado = await criarWishlistItem(",
    chamada: 'if (criado.valorAtual > 0) void registrar("guardar_meta");',
    vezes: 2,
  },
  {
    // Jornada de Começo (0036): criar o PIN, depois de salvo.
    acao: "criar_pin",
    arquivo: "components/pin/PinSetup.tsx",
    hook: "const { registrar } = useJornada(userId);",
    depoisDe: 'setError("Não foi possível salvar o PIN. Tente novamente.");',
    chamada: 'void registrar("criar_pin");',
    vezes: 1,
  },
] as const;

/** Ações da spec §3 que NÃO existem hoje no app (listadas no PR). */
const NAO_EXISTEM_NO_APP = ["planejar", "descanso"] as const;

describe("app/page.tsx monta a Jornada no app autenticado", () => {
  const page = soCodigo(read(PAGE));

  it("importa o card, a tela e o host de comemoração dos caminhos reais", () => {
    expect(page).toContain(
      'import { JornadaCard } from "@/components/home/JornadaCard";'
    );
    expect(page).toContain(
      'import { JornadaScreen } from "@/components/jornada/JornadaScreen";'
    );
    expect(page).toContain(
      'import { ComemoracaoHost } from "@/components/jornada/celebracao/ComemoracaoHost";'
    );
  });

  it("o card fica no Início, logo depois do card principal (protótipo)", () => {
    const principal = page.indexOf("<HeroCard");
    const card = page.indexOf("<JornadaCard");
    const pequenos = page.indexOf("<NextJobCard");
    expect(card).toBeGreaterThan(principal);
    expect(pequenos).toBeGreaterThan(card);
    expect(page).toMatch(
      /\{usuario && \(\s*<JornadaCard\s+userId=\{usuario\.id\}\s+onAbrir=\{\(\) => setJornadaAberta\(true\)\}/
    );
  });

  it("a tela abre pelo card e o host monta uma vez, só com usuária logada", () => {
    expect(page).toMatch(
      /\{usuario && jornadaAberta && \(\s*<JornadaScreen\s+userId=\{usuario\.id\}\s+nome=\{usuario\.nome\.trim\(\)\.split\(\/\\s\+\/\)\[0\] \?\? ""\}\s+inicial=\{usuario\.nome\.trim\(\)\.charAt\(0\)\.toUpperCase\(\)\}\s+onVoltar=\{\(\) => setJornadaAberta\(false\)\}\s+onIrPara=\{\(aba\) => \{\s*setJornadaAberta\(false\);\s*handleTabChange\(aba\);/
    );
    expect(page).toMatch(
      /\{usuario && \(\s*<ComemoracaoHost\s+userId=\{usuario\.id\}\s+inicial=\{usuario\.nome\.trim\(\)\.charAt\(0\)\.toUpperCase\(\)\}\s+onVerJornada=\{\(\) => setJornadaAberta\(true\)\}\s*\/>\s*\)\}/
    );
    expect(page.match(/<ComemoracaoHost/g)).toHaveLength(1);
    expect(page.match(/<JornadaCard/g)).toHaveLength(1);
  });

  it("o host fica depois do retorno do PIN (não comemora por cima dele)", () => {
    const pin = page.indexOf("<PinScreen");
    const host = page.indexOf("<ComemoracaoHost");
    expect(pin).toBeGreaterThan(-1);
    expect(host).toBeGreaterThan(pin);
  });
});

describe("cada ação da spec chama o registro certo, depois da ação principal", () => {
  it.each(LIGACOES.map((l) => [`${l.acao} (${l.arquivo})`, l] as const))(
    "%s",
    (_nome, l) => {
      const src = read(l.arquivo);
      expect(src).toContain(HOOK_IMPORT);
      expect(src).toContain(l.hook);
      const prova = src.indexOf(l.depoisDe);
      expect(prova, "a ação principal").toBeGreaterThan(-1);
      const chamada = src.indexOf(l.chamada, prova);
      expect(chamada, "a chamada vem depois do sucesso").toBeGreaterThan(prova);
      // Uma ação, uma chamada (por caminho de sucesso).
      expect(
        soCodigo(src).match(new RegExp(`registrar\\("${l.acao}"\\)`, "g"))
      ).toHaveLength(l.vezes);
    }
  );

  it("nenhuma chamada usa await (não segura o fechamento do formulário)", () => {
    for (const l of LIGACOES) {
      expect(soCodigo(read(l.arquivo)), l.arquivo).not.toMatch(
        /await\s+registrar\(/
      );
    }
  });

  it("toda ação que o cliente registra está ligada, ou é da tela, ou não existe no app", () => {
    const ligadas = new Set<string>(LIGACOES.map((l) => l.acao));
    for (const a of ACOES) {
      const ok =
        ligadas.has(a) ||
        a === "abrir_jornada" ||
        a === "ver_resumo" ||
        (NAO_EXISTEM_NO_APP as readonly string[]).includes(a);
      expect(ok, a).toBe(true);
    }
    // abrir_jornada é da tela (J12), registrada ao abrir.
    expect(soCodigo(read("components/jornada/JornadaScreen.tsx"))).toMatch(
      /void registrarAbertura\(\)/
    );
    // ver_resumo (Jornada de Começo, 0036) também é da tela: ao abrir um
    // resumo, no toque (nunca num efeito).
    // Abrir um resumo (os botões do fim da tela) é "ver o primeiro resumo".
    const tela = soCodigo(read("components/jornada/JornadaScreen.tsx"));
    expect(tela).toMatch(
      /const abrirResumo = \(tipo: TipoPeriodo\) => \{\s*setResumo\(tipo\);\s*void registrar\("ver_resumo"\);/
    );
    expect(tela).toMatch(/onAbrir=\{abrirResumo\}/);
    expect(tela.match(/registrar\("ver_resumo"\)/g)).toHaveLength(1);
  });

  it("ninguém registra as dicas nem as ações que não existem no app", () => {
    const todos = [...arquivos("components"), ...arquivos("app")].filter(
      (f) => !f.startsWith("components/jornada/")
    );
    for (const f of todos) {
      const codigo = soCodigo(read(f));
      for (const a of [...ACOES_DA_DICA, ...NAO_EXISTEM_NO_APP]) {
        expect(codigo, `${f} registra ${a}`).not.toMatch(
          new RegExp(`registrar\\("${a}"\\)`)
        );
      }
    }
  });

  it("o registro só acontece nos componentes de ação listados", () => {
    const comRegistro = [...arquivos("components"), ...arquivos("app")]
      .filter((f) => !f.startsWith("components/jornada/"))
      .filter((f) => /\bregistrar\(\s*"/.test(soCodigo(read(f))))
      .sort();
    expect(comRegistro).toEqual(
      [...new Set(LIGACOES.map((l) => l.arquivo))].sort()
    );
  });
});

describe("os componentes de ação só ganharam import, hook e chamada", () => {
  it.each([...new Set(LIGACOES.map((l) => l.arquivo))])(
    "%s não fala com o motor nem calcula Glow",
    (arquivo) => {
      const codigo = soCodigo(read(arquivo));
      expect(codigo).not.toMatch(/@\/lib\/jornada\//);
      expect(codigo).not.toMatch(/jornada_registrar|jornada_estado/);
      expect(codigo).not.toMatch(/\bglow\b/i);
      // Só o import, o hook e as chamadas mencionam a Jornada.
      const linhas = codigo
        .split("\n")
        .filter((l) => /useJornada|registrar/.test(l));
      const esperadas =
        2 + LIGACOES.filter((l) => l.arquivo === arquivo).length;
      expect(linhas).toHaveLength(esperadas);
    }
  );
});
