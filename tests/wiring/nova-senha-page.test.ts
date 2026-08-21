import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * #94 — /login/nova-senha é o destino final do link de recuperação de
 * senha (chegando via /auth/callback?next=/login/nova-senha, que já trocou
 * o code por uma session real antes de redirecionar pra cá). Mesma técnica
 * de inspeção de código-fonte já usada em pinsetup-save-error.test.ts —
 * projeto não tem Testing Library/Playwright, ambiente do vitest é "node".
 */

const src = readFileSync(
  join(__dirname, "..", "..", "app", "login", "nova-senha", "page.tsx"),
  "utf-8"
);

describe("app/login/nova-senha/page.tsx", () => {
  it("chama updatePassword (lib/auth.ts), não signUp/signIn", () => {
    expect(src).toMatch(/updatePassword/);
  });

  it("é rota client (precisa de useState pro form)", () => {
    expect(src).toMatch(/"use client"/);
  });

  it("redireciona pra / após sucesso", () => {
    expect(src).toMatch(/router\.push\(\s*"\/"\s*\)/);
  });
});
