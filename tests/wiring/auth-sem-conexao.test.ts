import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * R21 (auditoria, sem internet): entrar, criar conta ou pedir link de senha
 * sem internet mostrava o genérico "Não foi possível concluir. Tente
 * novamente.", sem dizer que o problema é a conexão. O Supabase devolve a
 * falha de rede como AuthRetryableFetchError com status 0 (fetch nem
 * chegou ao servidor). Erro 5xx do servidor também vem com esse nome, mas
 * com o status do servidor: continua no genérico.
 */

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
    },
  },
}));

import {
  requestPasswordReset,
  signInWithEmail,
  signUpWithEmail,
} from "../../lib/auth";
import { TEXTOS_AUTH } from "../../lib/textosAuth";

/** O erro que o auth-js monta quando o fetch falha (lib/fetch.js). */
function erroDeRede(status: number) {
  return Object.assign(new Error("Failed to fetch"), {
    name: "AuthRetryableFetchError",
    status,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sem internet, o erro diz que é a conexão", () => {
  it("o texto existe e fala da internet", () => {
    expect(TEXTOS_AUTH.erro.semConexao).toBe(
      "Sem conexão. Confira a internet e tente de novo."
    );
  });

  it("entrar", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: erroDeRede(0) });
    const r = await signInWithEmail("a@b.test", "Senha1234");
    expect(r.error).toBe(TEXTOS_AUTH.erro.semConexao);
    expect(r.emailNaoConfirmado).toBe(false);
  });

  it("criar conta", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: erroDeRede(0),
    });
    const r = await signUpWithEmail("a@b.test", "Senha1234", "http://x");
    expect(r.error).toBe(TEXTOS_AUTH.erro.semConexao);
  });

  it("link de senha nova", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: erroDeRede(0) });
    const r = await requestPasswordReset("a@b.test", "http://x");
    expect(r.error).toBe(TEXTOS_AUTH.erro.semConexao);
  });

  it("servidor fora (503) continua no genérico", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: erroDeRede(503) });
    const r = await signInWithEmail("a@b.test", "Senha1234");
    expect(r.error).toBe(TEXTOS_AUTH.erro.generico);
  });
});
