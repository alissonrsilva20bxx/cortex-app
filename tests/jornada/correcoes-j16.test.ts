import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Comemoracao } from "../../lib/jornada/estado";
import { SELO } from "../../lib/jornada/textos";
import { textosDaComemoracao } from "../../components/jornada/celebracao/decidir";
import {
  _resetPausa,
  comemoracaoPausada,
  definirPausa,
} from "../../components/jornada/celebracao/pausa";

/**
 * Correções achadas no smoke da J16 (#166).
 *
 *  - #196: a comemoração tocava por cima do recap do mês. Agora é uma
 *    camada de cada vez: recap primeiro, comemoração depois, sem perder
 *    nada da fila.
 *  - #199: o selo "Mês a mês" I sai no primeiro mês (é o que a spec §5 diz:
 *    "meses na Jornada", I = 1), mas o texto dizia "um mês inteiro". O
 *    texto foi alinhado à spec; o servidor não mudou.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");
const soCodigo = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const PALCO = soCodigo(
  read("components/jornada/celebracao/ComemoracaoPalco.tsx")
);
const RECAP = soCodigo(read("components/recap/RecapSheet.tsx"));

beforeEach(() => _resetPausa());

describe("#196: recap do mês primeiro, comemoração depois", () => {
  it("uma camada aberta pausa a comemoração; fechar a última retoma", () => {
    expect(comemoracaoPausada()).toBe(false);
    definirPausa("recap", true);
    expect(comemoracaoPausada()).toBe(true);
    definirPausa("outra", true);
    definirPausa("recap", false);
    expect(comemoracaoPausada()).toBe(true);
    definirPausa("outra", false);
    expect(comemoracaoPausada()).toBe(false);
  });

  it("marcar a mesma camada duas vezes (StrictMode) não prende a pausa", () => {
    definirPausa("recap", true);
    definirPausa("recap", true);
    definirPausa("recap", false);
    expect(comemoracaoPausada()).toBe(false);
  });

  it("o recap pausa enquanto está aberto, com a mesma condição do sheet", () => {
    expect(RECAP).toContain(
      'import { usePausarComemoracao } from "@/components/jornada/celebracao/pausa";'
    );
    expect(RECAP).toMatch(
      /usePausarComemoracao\("recap", !!recap && !dismissed\);/
    );
    expect(RECAP).toMatch(/open=\{!!recap && !dismissed\}/);
  });

  it("pausado, o palco não escolhe ninguém (nada toca, nada é consumido)", () => {
    expect(PALCO).toMatch(/const pausada = useComemoracaoPausada\(\);/);
    expect(PALCO).toMatch(
      /const proxima = pausada \? null : proximaParaTocar\(fila, adiadas\);/
    );
    // O consumo só acontece no fim da linha do tempo da próxima: sem
    // próxima, o item fica na fila persistente da J11 e volta depois.
    expect(PALCO).toMatch(/if \(!c\) \{\s*setAtual\(null\);\s*return;\s*\}/);
  });

  it("pausado, nem o aviso pequeno fica na tela", () => {
    expect(PALCO).toMatch(/\{aviso && !pausada && \(/);
  });

  it("a pausa solta sozinha quando a camada desmonta (não prende a fila)", () => {
    const pausa = soCodigo(read("components/jornada/celebracao/pausa.ts"));
    expect(pausa).toMatch(
      /definirPausa\(camada, aberta\);\s*return \(\) => definirPausa\(camada, false\);/
    );
  });
});

describe("#199: o texto do selo diz o que a spec §5 diz", () => {
  it("Mês a mês I = o primeiro mês na Jornada (não 'um mês inteiro')", () => {
    expect(SELO.mes_a_mes.descricao).not.toMatch(/inteiro/i);
    expect(SELO.mes_a_mes.descricao).toMatch(/primeiro mês na Jornada/);
  });

  it("Um ano = um ano na Jornada (sem prometer 'ano inteiro')", () => {
    expect(SELO.um_ano.descricao).not.toMatch(/inteiro/i);
    expect(SELO.um_ano.descricao).toMatch(/ano na sua Jornada/);
  });

  it("a spec continua dizendo exatamente isso, e o servidor conta assim", () => {
    const spec = read("docs/jornada/spec-sua-jornada.md");
    expect(spec).toContain(
      "| Mês a mês | meses na Jornada | 1 | 3 | 6 | Organizar |"
    );
    expect(spec).toContain(
      "| Um ano | um ano na Jornada | 1 | — | — | Organizar |"
    );
    const sql = read("supabase/migrations/0035_jornada_rpcs.sql");
    expect(sql).toMatch(
      /\('mes_a_mes',\s*'organizar',\s*'meses_na_jornada',\s*1, 3, 6\)/
    );
  });

  it("a comemoração mostra a descrição só no nível I (ela fala do nível I)", () => {
    const selo = (nivel: 1 | 2 | 3): Comemoracao => ({
      id: `s${nivel}`,
      tipo: "selo",
      selo: "mes_a_mes",
      nivel,
      glow: 20,
      ganhou: true,
    });
    expect(textosDaComemoracao(selo(1), false).apoio).toBe(
      SELO.mes_a_mes.descricao
    );
    expect(textosDaComemoracao(selo(2), false).apoio).toBe("");
    expect(textosDaComemoracao(selo(3), false).apoio).toBe("");
  });
});
