import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Tela que lê um dado que nenhuma tela escreve (retro das 3 semanas: o
 * status "concluído" só existia nos mocks). Teste de fiação, no padrão dos
 * outros em tests/wiring: lê o código como texto.
 *
 * Cada par é explícito: "o que alguém lê" -> "deve existir código de
 * PRODUÇÃO que escreve". Produção = app, components e lib, sem
 * app/dev-preview, sem lib/mock*.ts e sem testes. Os pares sem escritor
 * hoje ficam em quem-escreve-o-que-le.baseline.json como LACUNA CONHECIDA:
 * o teste fica verde, mas a lacuna está documentada. Lacuna nova falha; e
 * lacuna que ganhou escritor também falha, para tirar da baseline.
 */

const ROOT = join(__dirname, "..", "..");
const PASTAS = ["app", "components", "lib"];
const IGNORADAS = ["app/dev-preview", "components/ios-prototype", "node_modules"];

const ehProducao = (rel: string) =>
  !IGNORADAS.some((i) => rel === i || rel.startsWith(i + "/")) &&
  !/^lib\/mock[A-Za-z]*\.ts$/.test(rel) &&
  !/\.(test|spec)\.tsx?$/.test(rel);

function fontes(dir: string, saida: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) fontes(p, saida);
    else if (/\.tsx?$/.test(e.name)) {
      const rel = relative(ROOT, p).split(sep).join("/");
      if (ehProducao(rel)) saida.push(rel);
    }
  }
  return saida;
}

const producao = PASTAS.flatMap((p) => fontes(join(ROOT, p))).map((rel) => ({
  rel,
  texto: readFileSync(join(ROOT, rel), "utf-8"),
}));
const ler = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");

type Par = {
  id: string;
  /** Onde alguém lê o valor: arquivo e um trecho que prova a leitura. */
  le: { arquivo: string; trecho: RegExp };
  /** O que, em código de produção, escreve o valor. */
  escreve: RegExp;
};

/** Ação do cliente da Jornada: lida pelas missões/passos, escrita por registrar(). */
const acao = (nome: string, escreve?: RegExp): Par => ({
  id: `jornada:${nome}`,
  le: { arquivo: "lib/jornada/estado.ts", trecho: new RegExp(`"${nome}"`) },
  escreve: escreve ?? new RegExp(`registrar\\(\\s*"${nome}"\\s*\\)`),
});

const PARES: Par[] = [
  {
    id: "atendimento:status-concluído",
    le: {
      arquivo: "components/financeiro/movimentos.ts",
      trecho: /j\.status === "concluído"/,
    },
    escreve: /status:\s*"concluído"|<option value="concluído"/,
  },
  acao("despesa"),
  acao("receita"),
  acao("atendimento"),
  acao("guardar_meta"),
  acao("comprovante_cofre"),
  acao("criar_pin"),
  acao("ver_resumo"),
  acao("abrir_jornada", /registrarAbertura\(/),
  // Missões do capítulo e passos do Começo que leem estas duas ações:
  acao("planejar"),
  acao("descanso"),
];

const baseline: { id: string; motivo: string }[] = JSON.parse(
  readFileSync(join(__dirname, "quem-escreve-o-que-le.baseline.json"), "utf-8")
);
const conhecidas = new Set(baseline.map((b) => b.id));

const escritores = (p: Par) =>
  producao.filter((f) => p.escreve.test(f.texto)).map((f) => f.rel);

describe("quem escreve o que a tela lê", () => {
  it("cada valor da lista é de fato lido hoje (o par não está velho)", () => {
    for (const p of PARES) {
      expect(ler(p.le.arquivo), `${p.id} em ${p.le.arquivo}`).toMatch(
        p.le.trecho
      );
    }
  });

  it("toda ação da Jornada tem um par nesta lista", () => {
    const estado = ler("lib/jornada/estado.ts");
    const bloco = /export const ACOES = \[([\s\S]*?)\] as const/.exec(estado);
    expect(bloco).not.toBeNull();
    const acoes = [...bloco![1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
    expect(acoes.length).toBeGreaterThan(5);
    const cobertas = PARES.map((p) => p.id);
    expect(
      acoes.filter((a) => !cobertas.includes(`jornada:${a}`)),
      "Ação nova da Jornada: acrescente o par em PARES (quem escreve?)"
    ).toEqual([]);
  });

  it("nenhuma lacuna nova: todo valor lido tem escritor em produção", () => {
    const novas = PARES.filter(
      (p) => escritores(p).length === 0 && !conhecidas.has(p.id)
    ).map((p) => p.id);
    expect(
      novas,
      "Lido, mas nenhuma tela escreve (ligue o escritor ou registre na baseline com o motivo)"
    ).toEqual([]);
  });

  it("lacuna que ganhou escritor sai da baseline", () => {
    const resolvidas = PARES.filter(
      (p) => escritores(p).length > 0 && conhecidas.has(p.id)
    ).map((p) => p.id);
    expect(
      resolvidas,
      "Já tem escritor: tire de quem-escreve-o-que-le.baseline.json"
    ).toEqual([]);
  });

  it("a baseline só tem pares que existem", () => {
    const ids = PARES.map((p) => p.id);
    expect(baseline.map((b) => b.id).filter((id) => !ids.includes(id))).toEqual(
      []
    );
  });

  it("LACUNAS CONHECIDAS (documentadas, não bloqueiam)", () => {
    // Só para aparecer na saída do teste: o que ainda não tem escritor.
    console.info(
      "Lacunas conhecidas:\n" +
        baseline.map((b) => `  ${b.id}: ${b.motivo}`).join("\n")
    );
    expect(baseline.length).toBeGreaterThanOrEqual(0);
  });
});
