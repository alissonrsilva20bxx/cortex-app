import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

/**
 * Botão desenhado sem ação (retro das 3 semanas: Bloquear, Busca, Sino e
 * "Ver tudo" da Agenda pareciam ativos e não faziam nada). Teste de fiação
 * que lê o código com a API do TypeScript (AST), não com grep: um
 * `<button>` ou `role="button"` é "morto" quando não tem onClick, nem
 * type="submit", nem disabled, nem spread de props. Botão dentro de um
 * <form> sem type também não é morto (o navegador trata como submit).
 *
 * `disabled` NÃO salva o botão quando é só enfeite: `disabled` fixo
 * (`disabled` ou `disabled={true}`) ou `disabled={!onClick}`, sem handler,
 * é botão morto que só tem cara de desabilitado. O mesmo vale para o uso de
 * um componente que se desabilita assim quando falta a prop (BotaoRedondo)
 * sem passar a prop.
 *
 * A lista de hoje fica em botoes-sem-acao.baseline.json. O teste falha
 * quando surge um botão morto NOVO. Para consertar um da lista, ligue a
 * ação e tire a linha do JSON. A comparação é por arquivo + trecho (a
 * linha só ajuda a achar o botão), então mexer no arquivo não quebra.
 */

const ROOT = join(__dirname, "..", "..");
const PASTAS = ["app", "components"];
// components/ios-prototype é material de referência congelado: só a rota
// app/dev-preview/ios o importa (conferido no teste abaixo).
const IGNORADAS = [
  "app/dev-preview",
  "components/ios-prototype",
  "node_modules",
];

type Morto = { arquivo: string; linha: number; trecho: string };

function arquivosTsx(dir: string, saida: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    const rel = relative(ROOT, p).split(sep).join("/");
    if (IGNORADAS.some((i) => rel === i || rel.startsWith(i + "/"))) continue;
    if (e.isDirectory()) arquivosTsx(p, saida);
    else if (/\.tsx$/.test(e.name) && !/\.(test|spec)\.tsx$/.test(e.name)) {
      saida.push(rel);
    }
  }
  return saida;
}

function todosOsFontes(dir: string, saida: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.name === "node_modules") continue;
    if (e.isDirectory()) todosOsFontes(p, saida);
    else if (/\.tsx?$/.test(e.name)) {
      saida.push(relative(ROOT, p).split(sep).join("/"));
    }
  }
  return saida;
}

function atributo(
  attrs: ts.JsxAttributes,
  nome: string
): ts.JsxAttribute | undefined {
  return attrs.properties.find(
    (p): p is ts.JsxAttribute =>
      ts.isJsxAttribute(p) && p.name.getText() === nome
  );
}

function textoDe(a: ts.JsxAttribute | undefined): string | null {
  if (!a?.initializer) return null;
  if (ts.isStringLiteral(a.initializer)) return a.initializer.text;
  return null;
}

function dentroDeForm(no: ts.Node): boolean {
  for (let p = no.parent; p; p = p.parent) {
    if (ts.isJsxElement(p) && p.openingElement.tagName.getText() === "form") {
      return true;
    }
  }
  return false;
}

/** `disabled`, `disabled={true}` ou `disabled={!algo}`: desabilitado sem
 * depender de nada que mude, ou só porque falta um handler. */
function desabilitadoDeEnfeite(a: ts.JsxAttribute | undefined): boolean {
  if (!a) return false;
  if (!a.initializer) return true;
  if (!ts.isJsxExpression(a.initializer) || !a.initializer.expression) {
    return false;
  }
  const e = a.initializer.expression;
  if (e.kind === ts.SyntaxKind.TrueKeyword) return true;
  return (
    ts.isPrefixUnaryExpression(e) &&
    e.operator === ts.SyntaxKind.ExclamationToken &&
    ts.isIdentifier(e.operand)
  );
}

/** Componentes que se desabilitam quando falta uma prop (`disabled={!onClick}`
 * dentro de `function Nome({ onClick })`): nome -> prop. */
function componentesQueSeDesabilitam(
  codigo: string
): { nome: string; prop: string }[] {
  const fonte = ts.createSourceFile(
    "x.tsx",
    codigo,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const achados: { nome: string; prop: string }[] = [];
  const ver = (no: ts.Node, atual: string | null, props: Set<string>) => {
    let nome = atual;
    let seusProps = props;
    if (
      ts.isFunctionDeclaration(no) &&
      no.name &&
      /^[A-Z]/.test(no.name.text)
    ) {
      nome = no.name.text;
      // Só vale a prop do próprio componente: `disabled={!podeEnviar}` de um
      // estado local não é "falta o handler".
      seusProps = new Set(
        no.parameters.flatMap((p) =>
          ts.isObjectBindingPattern(p.name)
            ? p.name.elements.map((e) => e.name.getText())
            : []
        )
      );
    }
    if (ts.isJsxAttribute(no) && no.name.getText() === "disabled" && nome) {
      const e =
        no.initializer && ts.isJsxExpression(no.initializer)
          ? no.initializer.expression
          : undefined;
      if (
        e &&
        ts.isPrefixUnaryExpression(e) &&
        e.operator === ts.SyntaxKind.ExclamationToken &&
        ts.isIdentifier(e.operand) &&
        seusProps.has(e.operand.text)
      ) {
        achados.push({ nome, prop: e.operand.text });
      }
    }
    ts.forEachChild(no, (f) => ver(f, nome, seusProps));
  };
  ver(fonte, null, new Set());
  return achados;
}

function acharMortos(
  rel: string,
  codigo: string,
  comportamentos: { nome: string; prop: string }[] = []
): Morto[] {
  const fonte = ts.createSourceFile(
    rel,
    codigo,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const mortos: Morto[] = [];
  const ver = (no: ts.Node) => {
    if (ts.isJsxOpeningElement(no) || ts.isJsxSelfClosingElement(no)) {
      const attrs = no.attributes;
      const ehBotao =
        no.tagName.getText() === "button" ||
        textoDe(atributo(attrs, "role")) === "button";
      const temSpread = attrs.properties.some(ts.isJsxSpreadAttribute);
      const tipo = atributo(attrs, "type");
      const viraSubmit =
        textoDe(tipo) === "submit" ||
        // type={expressão}: não dá para provar que é morto
        (tipo !== undefined && textoDe(tipo) === null) ||
        (no.tagName.getText() === "button" && !tipo && dentroDeForm(no));
      const disabled = atributo(attrs, "disabled");
      const temHandler = atributo(attrs, "onClick") !== undefined;
      const vivo =
        temSpread ||
        viraSubmit ||
        temHandler ||
        (disabled !== undefined && !desabilitadoDeEnfeite(disabled));
      // Uso de um componente que se desabilita sem a prop (BotaoRedondo).
      const semAProp = comportamentos.some(
        (c) =>
          c.nome === no.tagName.getText() &&
          !temSpread &&
          atributo(attrs, c.prop) === undefined
      );
      if ((ehBotao && !vivo) || semAProp) {
        const { line } = fonte.getLineAndCharacterOfPosition(
          no.getStart(fonte)
        );
        mortos.push({
          arquivo: rel,
          linha: line + 1,
          // inclui o texto de dentro, para o trecho ser único o bastante
          trecho: (ts.isJsxOpeningElement(no) ? no.parent : no)
            .getText(fonte)
            .replace(/\s+/g, " ")
            .slice(0, 120),
        });
      }
    }
    ts.forEachChild(no, ver);
  };
  ver(fonte);
  return mortos;
}

/**
 * Ações desenhadas sem função que o detector não enxerga porque o botão é
 * gerado de uma lista (AgendaAcoes: `{ label, Icon }` sem `onClick`).
 * Continuam explícitas aqui. Quando ganharem ação, o teste abaixo falha
 * para a linha sair daqui.
 */
const SEM_ACAO_CONHECIDOS = [
  {
    arquivo: "components/jobs/AgendaAcoes.tsx",
    trecho: '{ label: "Bloquear", Icon: IconeBloquear }',
    motivo: "vira item próprio com a migration 0043 (bloqueio de horário)",
  },
];

const chave = (m: Morto) => `${m.arquivo}::${m.trecho}`;

describe("botões com ação", () => {
  const baseline: Morto[] = JSON.parse(
    readFileSync(join(__dirname, "botoes-sem-acao.baseline.json"), "utf-8")
  );

  const arquivos = PASTAS.flatMap((p) => arquivosTsx(join(ROOT, p)));
  const comportamentos = arquivos.flatMap((rel) =>
    componentesQueSeDesabilitam(readFileSync(join(ROOT, rel), "utf-8"))
  );
  const achados: Morto[] = arquivos.flatMap((rel) =>
    acharMortos(rel, readFileSync(join(ROOT, rel), "utf-8"), comportamentos)
  );

  it("o detector acha botão sem ação e deixa passar os que têm ação", () => {
    const codigo = `
      const a = <button>morto</button>;
      const b = <div role="button">morto</div>;
      const c = <button onClick={f}>vivo</button>;
      const d = <button type="submit">vivo</button>;
      const e = <button disabled={salvando}>vivo</button>;
      const g = <button {...props}>vivo</button>;
      const h = <form><button>envia</button></form>;
      const i = <div role="button" onClick={f} />;
    `;
    const m = acharMortos("x.tsx", codigo);
    expect(m.map((x) => x.linha)).toEqual([2, 3]);
  });

  it("disabled de enfeite (fixo ou só porque falta o handler) conta como morto", () => {
    const codigo = `
      const a = <button disabled>fixo</button>;
      const b = <button disabled={true}>fixo</button>;
      const c = <button disabled={!onClick}>sem handler</button>;
      const d = <button onClick={f} disabled={!onClick}>vivo</button>;
      const e = <button disabled={salvando}>por estado</button>;
      const f = <button onClick={f} disabled>com handler</button>;
    `;
    const m = acharMortos("x.tsx", codigo);
    expect(m.map((x) => x.linha)).toEqual([2, 3, 4]);
  });

  it("achou o componente que se desabilita sem a prop e o uso sem ela", () => {
    const def = `
      export function Redondo({ onClick }) {
        return <button onClick={onClick} disabled={!onClick} />;
      }
    `;
    const comp = componentesQueSeDesabilitam(def);
    expect(comp).toEqual([{ nome: "Redondo", prop: "onClick" }]);
    const uso = `
      const a = <Redondo rotulo="x" />;
      const b = <Redondo rotulo="y" onClick={f} />;
    `;
    expect(acharMortos("x.tsx", uso, comp).map((x) => x.linha)).toEqual([2]);
  });

  it("a varredura lê os arquivos de verdade e o ios-prototype só vai ao laboratório", () => {
    const arquivos = PASTAS.flatMap((p) => arquivosTsx(join(ROOT, p)));
    expect(arquivos.length).toBeGreaterThan(50);
    expect(arquivos).toContain("components/jobs/AgendaAcoes.tsx");
    const importadores = [...PASTAS, "lib"]
      .flatMap((p) => todosOsFontes(join(ROOT, p)))
      .filter((rel) => !rel.startsWith("components/ios-prototype/"))
      .filter((rel) =>
        /components\/ios-prototype\/IosPrototypeApp"/.test(
          readFileSync(join(ROOT, rel), "utf-8")
        )
      );
    expect(importadores).toEqual(["app/dev-preview/ios/page.tsx"]);
  });

  it("nenhum botão morto novo (fora da baseline)", () => {
    const restante = new Map<string, number>();
    for (const b of baseline) {
      restante.set(chave(b), (restante.get(chave(b)) ?? 0) + 1);
    }
    const novos: Morto[] = [];
    for (const a of achados) {
      const n = restante.get(chave(a)) ?? 0;
      if (n > 0) restante.set(chave(a), n - 1);
      else novos.push(a);
    }
    const msg = novos
      .map((n) => `  ${n.arquivo}:${n.linha}  ${n.trecho}`)
      .join("\n");
    expect(
      novos,
      `Botão sem ação (sem onClick, type="submit", disabled ou spread):\n${msg}\n` +
        "Ligue a ação ou deixe o botão desabilitado de forma visível."
    ).toEqual([]);
  });

  it("as ações de lista sem função continuam explícitas (e saem daqui quando ganharem ação)", () => {
    for (const c of SEM_ACAO_CONHECIDOS) {
      const src = readFileSync(join(ROOT, c.arquivo), "utf-8");
      expect(src, `${c.arquivo}: ${c.motivo}`).toContain(c.trecho);
    }
  });

  it("a baseline não guarda botão que já foi consertado", () => {
    const vivos = new Map<string, number>();
    for (const a of achados) {
      vivos.set(chave(a), (vivos.get(chave(a)) ?? 0) + 1);
    }
    const velhos: Morto[] = [];
    for (const b of baseline) {
      const n = vivos.get(chave(b)) ?? 0;
      if (n > 0) vivos.set(chave(b), n - 1);
      else velhos.push(b);
    }
    expect(
      velhos,
      "Tire estas linhas de botoes-sem-acao.baseline.json:\n" +
        velhos.map((v) => `  ${v.arquivo}:${v.linha}`).join("\n")
    ).toEqual([]);
  });
});
