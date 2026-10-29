import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * Decisão do capitão (27/10): conta nova entra na Rede direto durante o
 * teste, sem código e sem fila de beta. Depois do teste, só a Rede para
 * (tela de renovação). Este arquivo prova pelo caminho que a tela usa de
 * verdade: lê qual função o `RedeGatedTab` chama para decidir e chama essa
 * mesma função com o banco de uma conta no teste e sem convite.
 */

const raiz = resolve(__dirname, "../..");
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");

/** Cliente de mentira: `configuracoes` e `rede_convites` de uma conta. */
function banco(config: unknown, convites: unknown[]) {
  const resposta = (tabela: string) =>
    tabela === "configuracoes"
      ? { data: config, error: null, status: 200 }
      : { data: convites, error: null, status: 200 };
  return {
    from: vi.fn((tabela: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: () => Promise.resolve(resposta(tabela)),
          limit: () => Promise.resolve(resposta(tabela)),
        })),
      })),
    })),
    auth: { refreshSession: vi.fn() },
  };
}

/** A função que a guarda da Rede chama, tirada do próprio componente. */
async function verificadorDaGuarda() {
  const src = ler("components/rede/RedeGatedTab.tsx");
  const chamada = src.match(/(\w+)\(supabase, usuario\.id\)\.then\(aplicar\)/);
  expect(chamada).toBeTruthy();
  const nome = chamada![1];
  const de = src.match(
    new RegExp(`import \\{[^}]*\\b${nome}\\b[^}]*\\} from "@/lib/([^"]+)"`)
  );
  expect(de).toBeTruthy();
  const mod = (await import(join(raiz, "lib", de![1]))) as Record<
    string,
    (c: unknown, id: string) => Promise<{ unlocked: boolean }>
  >;
  return mod[nome];
}

const haDias = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

describe("Rede: entra pelo teste, sem código nem beta", () => {
  it("conta no teste (3 dias) e SEM convite: a guarda libera a Rede", async () => {
    const verificar = await verificadorDaGuarda();
    const r = await verificar(
      banco({ assinatura_status: "trial", trial_started_at: haDias(3) }, []),
      "u1"
    );
    expect(r.unlocked).toBe(true);
  });

  it("assinatura ativa, teste vencido, sem convite: libera", async () => {
    const verificar = await verificadorDaGuarda();
    const r = await verificar(
      banco({ assinatura_status: "ativa", trial_started_at: haDias(40) }, []),
      "u1"
    );
    expect(r.unlocked).toBe(true);
  });

  it("teste acabou, sem assinatura e sem convite: não libera", async () => {
    const verificar = await verificadorDaGuarda();
    const r = await verificar(
      banco({ assinatura_status: "trial", trial_started_at: haDias(40) }, []),
      "u1"
    );
    expect(r.unlocked).toBe(false);
  });

  it("quem já tinha convite usado continua entrando depois do teste (N4)", async () => {
    const verificar = await verificadorDaGuarda();
    const r = await verificar(
      banco({ assinatura_status: "trial", trial_started_at: haDias(40) }, [
        { id: "cv-1" },
      ]),
      "u1"
    );
    expect(r.unlocked).toBe(true);
  });

  it("sem acesso, a guarda mostra a renovação (não vitrine de beta nem campo de código)", () => {
    const src = ler("components/rede/RedeGatedTab.tsx");
    expect(src).toContain("<RedeRenovacao onVerPlanos={onVerPlanos} />");
    expect(src).not.toMatch(/RedeTeaserGate|SerialKeySheet/);
  });

  it("as rotas de beta e de código não existem mais", () => {
    expect(existsSync(join(raiz, "app/api/rede/solicitar-beta"))).toBe(false);
    expect(existsSync(join(raiz, "app/api/rede/convites"))).toBe(false);
    expect(existsSync(join(raiz, "components/rede/SerialKeySheet.tsx"))).toBe(
      false
    );
    expect(existsSync(join(raiz, "components/rede/RedeTeaserGate.tsx"))).toBe(
      false
    );
  });

  it("nenhum texto visível de beta, código de convite ou fila no app", () => {
    const proibidos = [
      /participar da beta/i,
      /Solicitação de beta/i,
      /código de (convite|acesso)/i,
      /lista de espera/i,
      /REDE-BETA/,
      /Tem um convite\?/,
      /seu convite/i,
    ];
    const arquivos: string[] = [];
    const varrer = (dir: string) => {
      for (const nome of readdirSync(join(raiz, dir))) {
        const p = `${dir}/${nome}`;
        if (statSync(join(raiz, p)).isDirectory()) varrer(p);
        else if (/\.tsx?$/.test(nome) && !p.startsWith("app/dev-preview"))
          arquivos.push(p);
      }
    };
    ["app", "components", "lib"].forEach(varrer);
    const achados = arquivos.flatMap((p) => {
      const src = ler(p);
      return proibidos.filter((re) => re.test(src)).map((re) => `${p} ${re}`);
    });
    expect(achados).toEqual([]);
  });

  it("app/page.tsx liga a renovação ao Ver planos e reconfere depois do Pagamento", () => {
    const page = ler("app/page.tsx");
    const i = page.indexOf("<RedeGatedTab");
    const elemento = page.slice(i, page.indexOf("/>", i));
    expect(elemento).toContain(
      "onVerPlanos={() => setReabrirPlanos((n) => n + 1)}"
    );
    expect(elemento).toContain("recarregarSinal={releituraAssinatura}");
  });
});
