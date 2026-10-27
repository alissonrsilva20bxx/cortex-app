import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Sair da conta (R14rev, MÉDIA): o botão Sair (`handleSignOut` em
 * app/page.tsx) chama `sairDaConta`, que apaga do aparelho o que é da conta
 * ANTES de sair. Aqui o fluxo roda de verdade, com um localStorage falso:
 * o que a Jornada grava (cache `jobapp-jornada:<id>` e dias de descanso
 * `jobapp-descansos:<id>`) some junto com o resto, e só depois o Supabase
 * sai e a tela vai para o login. O resto (Rede, Cofre, PIN e tentativas do
 * PIN) também é gravado aqui e conferido: tirar qualquer limpeza da lista
 * do `sairDaConta` derruba o teste (R15rev, BAIXA 2).
 */

// O transporte de produção (Supabase) não é usado.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { sairDaConta } from "@/lib/sairDaConta";
import { lojaDaUsuaria, usarTransporteDeLaboratorio } from "@/lib/jornada/cliente";
import * as cache from "@/lib/jornada/cache";
import { lerDescansos } from "@/lib/jornada/descansos";
import { diaDoRelogio } from "@/lib/relogio";
import type { TransporteJornada } from "@/lib/jornada/estado";
import * as redeCache from "@/lib/rede/redeCache";
import * as redeCachePersist from "@/lib/rede/redeCachePersist";
import * as cofreCache from "@/lib/cofre/cofreCache";
import * as pinHashCache from "@/lib/pinHashCache";
import { gravarTentativas, lerTentativas, SEM_TENTATIVAS } from "@/lib/pinTentativas";

function disco() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    clear: () => m.clear(),
    get length() {
      return m.size;
    },
    chaves: () => [...m.keys()].sort(),
  };
}

const ler = (rel: string) =>
  readFileSync(join(process.cwd(), rel), "utf-8").replace(/\r\n/g, "\n");

const parado: TransporteJornada = {
  lerEstado: () => new Promise(() => {}),
  registrar: () => new Promise(() => {}),
  salvarPreferencias: () => new Promise(() => {}),
};

let s: ReturnType<typeof disco>;

beforeEach(() => {
  s = disco();
  vi.stubGlobal("localStorage", s);
  cache._usarArmazenamentoParaTeste(undefined as never);
  cache._resetParaTeste();
  redeCache._resetParaTeste();
  cofreCache._resetParaTeste();
  usarTransporteDeLaboratorio(parado);
});

afterEach(() => {
  usarTransporteDeLaboratorio(null);
  vi.unstubAllGlobals();
});

describe("Sair da conta apaga a Jornada do aparelho", () => {
  it("o fluxo do botão Sair: descansos e cache da Jornada somem ANTES do signOut; depois vai ao login", async () => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const dia = diaDoRelogio(amanha);
    // O que a Jornada grava de verdade: o dia marcado (descansos.ts) e o
    // retrato em cache (cache.ts).
    lojaDaUsuaria("u-sai").marcarDescanso(dia, true);
    s.setItem("jobapp-jornada:u-sai", '{"v":"v2"}');
    s.setItem("tema", "escuro"); // o que não é da conta fica
    expect(lerDescansos("u-sai")).toEqual({ [dia]: true });
    expect(s.chaves()).toContain("jobapp-descansos:u-sai");

    const ordem: string[] = [];
    let chavesNoSignOut: string[] = [];
    await sairDaConta({
      signOut: async () => {
        chavesNoSignOut = s.chaves();
        ordem.push("signOut");
      },
      irPara: (rota) => ordem.push(rota),
    });

    expect(ordem).toEqual(["signOut", "/login"]);
    expect(chavesNoSignOut).toEqual(["tema"]);
    expect(s.getItem("jobapp-descansos:u-sai")).toBeNull();
    expect(s.getItem("jobapp-jornada:u-sai")).toBeNull();
    // E em memória: a loja da conta foi esquecida.
    expect(lojaDaUsuaria("u-sai").retrato().descansos).toEqual({});
  });

  it("o resto da conta também some antes do signOut: Rede, Cofre, PIN e tentativas (aparelho e memória)", async () => {
    // Gravado pelos próprios módulos, como o app grava.
    redeCache.vincularUsuario("u-sai");
    redeCache.escrever("u-sai", "perfil", { nome: "x" });
    redeCache.lembrarAcesso("u-sai", true);
    redeCachePersist.salvarAcesso("u-sai", true, Date.now());
    s.setItem("jobapp-rede-cache:u-sai", "{}");
    cofreCache.vincularUsuario("u-sai");
    cofreCache.escrever("u-sai", []);
    pinHashCache.gravar("u-sai", "hash-falso");
    gravarTentativas("u-sai", { erros: 3, esperaAte: null });
    s.setItem("tema", "escuro"); // o que não é da conta fica
    expect(s.chaves()).toEqual([
      "jobapp-cofre-cache:u-sai",
      "jobapp-pin:u-sai",
      "jobapp-rede-acesso:u-sai",
      "jobapp-rede-cache:u-sai",
      "pin:tentativas:u-sai",
      "tema",
    ]);
    expect(pinHashCache.ler("u-sai")).toBe("hash-falso");
    expect(lerTentativas("u-sai").erros).toBe(3);

    let chavesNoSignOut: string[] = [];
    await sairDaConta({
      signOut: async () => {
        chavesNoSignOut = s.chaves();
      },
      irPara: () => {},
    });

    expect(chavesNoSignOut).toEqual(["tema"]);
    expect(redeCache.ler("u-sai", "perfil")).toBeNull();
    expect(redeCache.acessoLembrado("u-sai")).toBeUndefined();
    expect(redeCachePersist.carregarAcesso("u-sai")).toBeNull();
    expect(cofreCache.ler("u-sai")).toBeNull();
    expect(pinHashCache.ler("u-sai")).toBeUndefined();
    expect(lerTentativas("u-sai")).toEqual(SEM_TENTATIVAS);
  });

  it("app/page.tsx: o botão Sair (handleSignOut) é o sairDaConta com o signOut do Supabase e o login", () => {
    const page = ler("app/page.tsx");
    expect(page).toMatch(/import \{ sairDaConta \} from "@\/lib\/sairDaConta";/);
    expect(page).toMatch(
      /function handleSignOut\(\) \{\s*return sairDaConta\(\{\s*signOut: \(\) => supabase\.auth\.signOut\(\),\s*irPara: \(rota\) => \{\s*window\.location\.href = rota;\s*\},\s*\}\);\s*\}/
    );
    expect(page).toMatch(/onSair=\{handleSignOut\}/);
    expect(page).toMatch(/onSignOut=\{handleSignOut\}/);
  });
});
