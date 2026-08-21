import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #94 — lib/auth.ts centraliza as chamadas de auth por e-mail/senha
 * (signInWithPassword/signUp/resetPasswordForEmail/updateUser) e traduz os
 * erros do Supabase Auth pra mensagens em português. Mesma técnica de mock
 * de módulo já usada em dev-preview-gate-auth.test.ts.
 */

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      updateUser: mocks.updateUser,
    },
  },
}));

import {
  mapAuthErrorMessage,
  requestPasswordReset,
  signInWithEmail,
  signUpWithEmail,
  updatePassword,
} from "../../lib/auth";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mapAuthErrorMessage", () => {
  it("traduz credenciais inválidas", () => {
    expect(mapAuthErrorMessage("Invalid login credentials")).toBe(
      "E-mail ou senha incorretos."
    );
  });

  it("traduz e-mail não confirmado", () => {
    expect(mapAuthErrorMessage("Email not confirmed")).toBe(
      "Confirme seu e-mail antes de entrar."
    );
  });

  it("traduz conta já existente", () => {
    expect(mapAuthErrorMessage("User already registered")).toBe(
      "Já existe uma conta com este e-mail. Tente entrar."
    );
  });

  it("traduz senha fraca/curta", () => {
    expect(
      mapAuthErrorMessage("Password should be at least 6 characters")
    ).toBe("Senha muito curta — use pelo menos 6 caracteres.");
  });

  it("traduz rate limit", () => {
    expect(mapAuthErrorMessage("Email rate limit exceeded")).toBe(
      "Muitas tentativas. Aguarde um momento e tente de novo."
    );
  });

  it("cai num fallback genérico pra erro desconhecido, nunca vazio", () => {
    const msg = mapAuthErrorMessage("some obscure supabase error");
    expect(msg.length).toBeGreaterThan(0);
    expect(msg).toBe("Não foi possível concluir. Tente novamente.");
  });

  it("é case-insensitive", () => {
    expect(mapAuthErrorMessage("INVALID LOGIN CREDENTIALS")).toBe(
      "E-mail ou senha incorretos."
    );
  });
});

describe("signInWithEmail", () => {
  it("retorna error: null no sucesso", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    const result = await signInWithEmail("a@b.com", "senha123");
    expect(result).toEqual({ error: null });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "senha123",
    });
  });

  it("mapeia o erro do Supabase pra português", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: "Invalid login credentials" },
    });
    const result = await signInWithEmail("a@b.com", "errada");
    expect(result).toEqual({ error: "E-mail ou senha incorretos." });
  });
});

describe("signUpWithEmail", () => {
  it("sinaliza needsConfirmation quando o Supabase cria user sem session", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "u1", identities: [{ id: "i1" }] }, session: null },
      error: null,
    });
    const result = await signUpWithEmail(
      "a@b.com",
      "senha123",
      "http://localhost:3000/auth/callback"
    );
    expect(result).toEqual({ error: null, needsConfirmation: true });
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "senha123",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback" },
    });
  });

  it("não sinaliza needsConfirmation quando a session já vem pronta (confirmação desabilitada)", async () => {
    mocks.signUp.mockResolvedValue({
      data: {
        user: { id: "u1", identities: [{ id: "i1" }] },
        session: { access_token: "t" },
      },
      error: null,
    });
    const result = await signUpWithEmail(
      "a@b.com",
      "senha123",
      "http://localhost:3000/auth/callback"
    );
    expect(result).toEqual({ error: null, needsConfirmation: false });
  });

  it("trata e-mail já cadastrado (identities vazio) como sucesso silencioso — nunca revela que a conta já existia", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: "u1", identities: [] }, session: null },
      error: null,
    });
    const result = await signUpWithEmail(
      "ja-existe@b.com",
      "senha123",
      "http://localhost:3000/auth/callback"
    );
    // Mesmo resultado do caminho de signup normal (needsConfirmation
    // sem erro) — devolver uma mensagem diferente aqui reintroduziria a
    // enumeração de e-mail que o Supabase evita de propósito.
    expect(result).toEqual({ error: null, needsConfirmation: true });
  });

  it("mapeia erro do Supabase pra português e nunca sinaliza needsConfirmation nesse caso", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Password should be at least 6 characters" },
    });
    const result = await signUpWithEmail(
      "a@b.com",
      "123",
      "http://localhost:3000/auth/callback"
    );
    expect(result).toEqual({
      error: "Senha muito curta — use pelo menos 6 caracteres.",
      needsConfirmation: false,
    });
  });
});

describe("requestPasswordReset", () => {
  it("chama resetPasswordForEmail com o redirectTo informado", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const result = await requestPasswordReset(
      "a@b.com",
      "http://localhost:3000/auth/callback?next=/login/nova-senha"
    );
    expect(result).toEqual({ error: null });
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("a@b.com", {
      redirectTo: "http://localhost:3000/auth/callback?next=/login/nova-senha",
    });
  });

  it("mapeia erro real (ex.: rate limit) pra português", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: "Email rate limit exceeded" },
    });
    const result = await requestPasswordReset(
      "a@b.com",
      "http://localhost:3000/auth/callback?next=/login/nova-senha"
    );
    expect(result).toEqual({
      error: "Muitas tentativas. Aguarde um momento e tente de novo.",
    });
  });
});

describe("updatePassword", () => {
  it("retorna error: null no sucesso", async () => {
    mocks.updateUser.mockResolvedValue({ data: {}, error: null });
    const result = await updatePassword("novaSenha123");
    expect(result).toEqual({ error: null });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      password: "novaSenha123",
    });
  });

  it("mapeia erro do Supabase pra português", async () => {
    mocks.updateUser.mockResolvedValue({
      data: {},
      error: { message: "Password should be at least 6 characters" },
    });
    const result = await updatePassword("123");
    expect(result).toEqual({
      error: "Senha muito curta — use pelo menos 6 caracteres.",
    });
  });
});
