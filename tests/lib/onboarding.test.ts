import { describe, expect, it } from "vitest";
import { hasNoRealGoal, isFreshAccount } from "../../lib/onboarding";
import type { Job, Meta } from "../../lib/types";

/**
 * T17/#70 — `handle_new_user()` (supabase/migrations/0001_jobapp_schema.sql)
 * seeds every new account with metas (dia:300, mes:3000, ano:36000) the
 * instant `auth.users` gets a row, before onboarding ever runs. Without
 * treating those exact values as "still untouched", `isNewUser` in
 * app/page.tsx could never be true for a real signup — onboarding was
 * unreachable. Confirmed via Playwright against local Supabase with a
 * real account before this fix landed.
 */

const SEEDED: Meta[] = [
  { periodo: "dia", valorAlvo: 300 },
  { periodo: "mes", valorAlvo: 3000 },
  { periodo: "ano", valorAlvo: 36000 },
];

describe("hasNoRealGoal", () => {
  it("treats the exact seeded defaults as 'no real goal yet'", () => {
    expect(hasNoRealGoal(SEEDED)).toBe(true);
  });

  it("treats an empty metas list the same way (old accounts, race-free)", () => {
    expect(hasNoRealGoal([])).toBe(true);
  });

  it("recognizes a real goal once any period deviates from the seed", () => {
    const customized: Meta[] = [
      { periodo: "dia", valorAlvo: 300 },
      { periodo: "mes", valorAlvo: 5000 }, // usuária mudou só a mensal
      { periodo: "ano", valorAlvo: 36000 },
    ];
    expect(hasNoRealGoal(customized)).toBe(false);
  });

  it("recognizes a real goal even if only the daily one changed", () => {
    const customized: Meta[] = [
      { periodo: "dia", valorAlvo: 100 },
      { periodo: "mes", valorAlvo: 3000 },
      { periodo: "ano", valorAlvo: 36000 },
    ];
    expect(hasNoRealGoal(customized)).toBe(false);
  });
});

describe("isFreshAccount", () => {
  it("is true for a brand-new account: seeded metas, no jobs", () => {
    expect(isFreshAccount([], SEEDED)).toBe(true);
  });

  it("is false once the account has any job, even with seeded metas", () => {
    const jobs: Job[] = [
      {
        id: "j1",
        clienteNome: "Cliente",
        data: "2026-08-21",
        hora: "10:00",
        valor: 100,
        modalidade: "presencial",
        status: "agendado",
        criadoEm: "2026-08-21T00:00:00Z",
      },
    ];
    expect(isFreshAccount(jobs, SEEDED)).toBe(false);
  });

  it("is false once a real goal was set, even with zero jobs", () => {
    const customized: Meta[] = [
      { periodo: "dia", valorAlvo: 300 },
      { periodo: "mes", valorAlvo: 5000 },
      { periodo: "ano", valorAlvo: 36000 },
    ];
    expect(isFreshAccount([], customized)).toBe(false);
  });
});
