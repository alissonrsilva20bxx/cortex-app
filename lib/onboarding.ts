import type { Job, Meta } from "@/lib/types";

/**
 * `handle_new_user()` (supabase/migrations/0001_jobapp_schema.sql, ver
 * também 0004_baseline_correcao.sql) semeia toda conta nova com estes
 * valores exatos assim que `auth.users` ganha uma linha — antes do
 * onboarding sequer rodar. Sem levar isso em conta, `metas.length === 0`
 * nunca é verdadeiro pra uma conta real (T17/#70): a usuária nunca via a
 * etapa de meta nem a home reconhecia "1º uso" nenhuma vez.
 *
 * Trata esses valores como "ainda não mexida", não "meta já definida" —
 * uma usuária que definisse a meta pra exatamente um desses valores só
 * veria o onboarding mais uma vez (inofensivo), o oposto do bug atual
 * (nunca ver onboarding nenhuma vez).
 */
const SEEDED_META_DEFAULTS: Record<Meta["periodo"], number> = {
  dia: 300,
  mes: 3000,
  ano: 36000,
};

function isSeededDefault(meta: Meta): boolean {
  return SEEDED_META_DEFAULTS[meta.periodo] === meta.valorAlvo;
}

/** Nenhuma meta foi de fato definida ainda — todas seguem no valor-semente (ou não há nenhuma). */
export function hasNoRealGoal(metas: Meta[]): boolean {
  return metas.every(isSeededDefault);
}

/** 1º uso de verdade: nenhum atendimento registrado e nenhuma meta real definida. */
export function isFreshAccount(jobs: Job[], metas: Meta[]): boolean {
  return jobs.length === 0 && hasNoRealGoal(metas);
}
