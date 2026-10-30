import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * R18rev BAIXA 4: quem está logada e volta do Google com falha (a
 * reconfirmação do PIN) passa por /login?error=auth_failed, e o middleware
 * a leva ao início. O aviso sumia: o início não lia o `?error=`, e o toast
 * comum some sozinho em 3,2 s. Agora o início mostra o aviso e ele fica na
 * tela até a pessoa agir (tocar ou digitar).
 */

import { tirarErroDaUrl } from "@/components/useAvisoErroDeEntrada";
import { ouvirPrimeiraAcao } from "@/components/Toast";
import { TEXTOS_AUTH } from "@/lib/textosAuth";

const ler = (rel: string) =>
  readFileSync(join(process.cwd(), rel), "utf-8").replace(/\r\n/g, "\n");

describe("o início lê o ?error= da volta do login", () => {
  it("com ?error=: tem aviso, e o endereço fica sem o parâmetro", () => {
    expect(tirarErroDaUrl("?error=auth_failed")).toEqual({
      temErro: true,
      semErro: "",
    });
  });

  it("os outros parâmetros ficam (laboratório)", () => {
    expect(tirarErroDaUrl("?sair=falha&error=auth_failed")).toEqual({
      temErro: true,
      semErro: "?sair=falha",
    });
  });

  it("sem ?error=: nada muda", () => {
    expect(tirarErroDaUrl("")).toEqual({ temErro: false, semErro: "" });
    expect(tirarErroDaUrl("?jornada=nova")).toEqual({
      temErro: false,
      semErro: "?jornada=nova",
    });
  });

  it("o texto é o mesmo do login, em constante", () => {
    expect(TEXTOS_AUTH.erro.entrada).toBe(
      "Não foi possível concluir a autenticação. Tente de novo."
    );
    expect(ler("app/login/page.tsx")).toMatch(
      /toast\.error\(TEXTOS_AUTH\.erro\.entrada\)/
    );
  });
});

describe("o aviso fica até a pessoa agir", () => {
  function alvoFalso() {
    const ouvintes = new Map<string, Set<() => void>>();
    return {
      addEventListener: (tipo: string, fn: () => void) => {
        if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
        ouvintes.get(tipo)!.add(fn);
      },
      removeEventListener: (tipo: string, fn: () => void) => {
        ouvintes.get(tipo)?.delete(fn);
      },
      disparar: (tipo: string) => {
        for (const fn of [...(ouvintes.get(tipo) ?? [])]) fn();
      },
      quantos: () => [...ouvintes.values()].reduce((n, set) => n + set.size, 0),
    };
  }

  it("não fecha sozinho com o tempo; fecha no primeiro toque, uma vez só", () => {
    vi.useFakeTimers();
    const alvo = alvoFalso();
    const fechar = vi.fn();
    ouvirPrimeiraAcao(alvo, fechar);
    // O toque que abriu o aviso não conta: só a partir do próximo.
    alvo.disparar("pointerdown");
    expect(fechar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(fechar).not.toHaveBeenCalled();
    alvo.disparar("pointerdown");
    expect(fechar).toHaveBeenCalledTimes(1);
    alvo.disparar("keydown");
    expect(fechar).toHaveBeenCalledTimes(1);
    expect(alvo.quantos()).toBe(0);
    vi.useRealTimers();
  });

  it("uma tecla também conta como agir", () => {
    vi.useFakeTimers();
    const alvo = alvoFalso();
    const fechar = vi.fn();
    ouvirPrimeiraAcao(alvo, fechar);
    vi.advanceTimersByTime(0);
    alvo.disparar("keydown");
    expect(fechar).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("o Toast usa isso no aviso ateAgir, sem o tempo de 3,2 s", () => {
    const toast = ler("components/Toast.tsx");
    expect(toast).toMatch(
      /if \(opcoes\?\.ateAgir\) \{\s*ouvirPrimeiraAcao\(window, fechar\);\s*return;\s*\}/
    );
  });

  it("o início do app e o laboratório mostram o aviso", () => {
    for (const pagina of ["app/page.tsx", "app/dev-preview/app/page.tsx"]) {
      expect(ler(pagina)).toMatch(/^\s*useAvisoErroDeEntrada\(\);/m);
    }
    expect(ler("components/useAvisoErroDeEntrada.ts")).toMatch(
      /toast\.error\(TEXTOS_AUTH\.erro\.entrada, \{ ateAgir: true \}\)/
    );
  });
});
