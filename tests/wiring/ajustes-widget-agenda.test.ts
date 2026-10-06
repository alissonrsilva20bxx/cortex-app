import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Widget "Agenda" removivel na Inicio (#181).
 *
 * Teste de fiacao: le o fonte e afirma que a ligacao existe de verdade --
 * a chave entra no tipo como OPCIONAL, o item aparece na mesma lista dos
 * outros widgets dos Ajustes, e as duas secoes da Agenda ficam dentro da
 * MESMA condicional, nas duas paginas. O `?? true` e o que garante que
 * quem ja tem preferencia salva continua vendo a Agenda.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const PAGINAS = ["app/page.tsx", "app/dev-preview/app/page.tsx"];

/** Só o conteudo do painel da Inicio -- montar em outra aba nao conta. */
function painelInicio(src: string): string {
  const start = src.indexOf('<TabPanel tab="home"');
  if (start === -1) throw new Error('<TabPanel tab="home"> nao encontrado');
  return src.slice(start, src.indexOf("</TabPanel>", start));
}

describe("#181 — a chave da Agenda entra sem quebrar quem ja usa", () => {
  const types = read("lib/types.ts");

  it("HomeCardConfig declara `agenda` como opcional", () => {
    const bloco = types.slice(
      types.indexOf("export interface HomeCardConfig"),
      types.indexOf("}", types.indexOf("export interface HomeCardConfig"))
    );
    // Opcional de proposito: `agenda: boolean` obrigaria todo mundo a ter a
    // chave gravada, e quem nao tem cairia em `undefined` -> escondido.
    expect(bloco).toMatch(/agenda\?: boolean;/);
    expect(bloco).not.toMatch(/agenda: boolean;/);
  });

  it("os tres DEFAULT_HOME_CARDS trazem agenda ligada", () => {
    for (const arquivo of [...PAGINAS, "components/ajustes/AjustesTab.tsx"]) {
      const src = read(arquivo);
      const bloco = src.slice(
        src.indexOf("DEFAULT_HOME_CARDS: HomeCardConfig = {"),
        src.indexOf("};", src.indexOf("DEFAULT_HOME_CARDS: HomeCardConfig = {"))
      );
      expect(bloco, arquivo).toMatch(/agenda: true,/);
    }
  });
});

describe("#181 — o interruptor aparece na mesma lista dos outros widgets", () => {
  const ajustes = read("components/ajustes/AjustesTab.tsx");
  const lista = ajustes.slice(
    ajustes.indexOf("const homeCardItems"),
    ajustes.indexOf("];", ajustes.indexOf("const homeCardItems"))
  );

  it("entra em homeCardItems, com rotulo e descricao em PT-BR", () => {
    expect(lista).toMatch(/key: "agenda",/);
    expect(lista).toMatch(/label: "Agenda",/);
    expect(lista).toMatch(/desc: "[^"]+",/);
  });

  it("fica ao lado dos widgets que ja existiam, nao numa lista propria", () => {
    for (const key of ["nextJob", "objetivos", "agenda"]) {
      expect(lista, key).toMatch(new RegExp(`key: "${key}",`));
    }
  });

  it("usa o mesmo mecanismo e a mesma persistencia -- sem chave nova, sem banco", () => {
    // O loop da UI ja trata `homeCards[key] ?? true` e grava via updateHomeCards.
    expect(ajustes).toMatch(/const on = homeCards\[key\] \?\? true;/);
    expect(ajustes).toMatch(
      /localStorage\.setItem\("jobapp-home-cards", JSON\.stringify\(next\)\)/
    );
    // Nada de preferencia nova em tabela: a Agenda nao pode ter ido pro banco.
    const semComentarios = ajustes.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(semComentarios).not.toMatch(/from\("home_cards"\)|agenda_visivel/);
  });
});

describe("#181 — a Inicio esconde as DUAS secoes da Agenda, nas duas paginas", () => {
  for (const pagina of PAGINAS) {
    const painel = painelInicio(read(pagina));

    it(`${pagina}: SemanaSection e ProximosAtendimentos dentro da mesma condicional`, () => {
      const m = painel.match(
        /\{\(homeCards\.agenda \?\? true\) && \(\s*<>([\s\S]*?)<\/>\s*\)\}/
      );
      expect(m, "condicional da Agenda nao encontrada").not.toBeNull();
      // As duas tem que estar DENTRO; uma fora continuaria aparecendo.
      expect(m![1]).toMatch(/<SemanaSection/);
      expect(m![1]).toMatch(/<ProximosAtendimentos/);
    });

    it(`${pagina}: nenhuma das duas secoes sobra fora da condicional`, () => {
      const semCondicional = painel.replace(
        /\{\(homeCards\.agenda \?\? true\) && \(\s*<>[\s\S]*?<\/>\s*\)\}/,
        ""
      );
      expect(semCondicional).not.toMatch(/<SemanaSection/);
      expect(semCondicional).not.toMatch(/<ProximosAtendimentos/);
    });

    it(`${pagina}: o padrao e visivel (\`?? true\`), nao escondido`, () => {
      // `homeCards.agenda &&` esconderia a Agenda de todo mundo que ja tem
      // preferencia salva sem essa chave. E o bug que o `?? true` evita.
      expect(painel).not.toMatch(/\{homeCards\.agenda && \(/);
      expect(painel).toMatch(/homeCards\.agenda \?\? true/);
    });
  }
});
