import type { AssinaturaStatus } from "@/lib/types";

/** Duração do teste grátis de quem começa a partir do onboarding "Linha do
 * tempo": 7 dias, sem cartão pra começar (a pílula 7/3/1, o aviso quando
 * faltam 2 e os planos no dia 8). */
export const TRIAL_DIAS = 7;

/** Duração do teste prometida antes (§7.1 do spec): quem começou antes do
 * corte continua com ela. */
export const TRIAL_DIAS_ANTIGO = 14;

/** Data do lançamento do onboarding "Linha do tempo". `trial_started_at`
 * antes dela: 14 dias, como foi prometido na entrada; a partir dela: 7.
 * Sem migration: o `computeAssinatura` decide pela data de início. */
export const CORTE_TRIAL_7_DIAS = "2026-10-09T00:00:00Z";

/** Quantos dias de teste esta conta tem, pela data em que o teste começou.
 * Data ilegível: 7, o teste de agora. */
export function diasDoTeste(trialStartedAt: string): number {
  const inicio = new Date(trialStartedAt).getTime();
  return inicio < new Date(CORTE_TRIAL_7_DIAS).getTime()
    ? TRIAL_DIAS_ANTIGO
    : TRIAL_DIAS;
}

/** O aviso do teste ("Faltam 2 dias do seu teste") aparece no dia em que
 * a pílula mostra este número; a tela 3 do onboarding diz o mesmo dia
 * (`TRIAL_DIAS + 1 - AVISO_FALTAM_DIAS`, o dia 6). */
export const AVISO_FALTAM_DIAS = 2;

export interface EstadoAssinatura {
  /** Status efetivo — considera o prazo do teste, não só o valor salvo. */
  status: AssinaturaStatus;
  /** Dias restantes de teste (nunca negativo); null fora do trial. */
  diasRestantes: number | null;
  /** Duração do teste desta conta (14 antes do corte, 7 depois). */
  diasDoTeste: number;
}

/**
 * Deriva o status efetivo da assinatura a partir de quando o teste começou.
 * "vencida" é computada pela data corrida, não por um cron que muda a coluna
 * no banco — sobrevive a qualquer timing (mesmo princípio do OnboardingFlow).
 */
export function computeAssinatura(
  trialStartedAt: string,
  assinaturaStatus: AssinaturaStatus,
  ref = new Date()
): EstadoAssinatura {
  const dias = diasDoTeste(trialStartedAt);
  if (assinaturaStatus === "ativa") {
    return { status: "ativa", diasRestantes: null, diasDoTeste: dias };
  }

  const inicio = new Date(trialStartedAt);
  const fimTrial = new Date(inicio);
  fimTrial.setDate(fimTrial.getDate() + dias);
  const diasRestantes = Math.ceil(
    (fimTrial.getTime() - ref.getTime()) / 86_400_000
  );

  if (diasRestantes <= 0) {
    return { status: "vencida", diasRestantes: 0, diasDoTeste: dias };
  }
  return { status: "trial", diasRestantes, diasDoTeste: dias };
}

/**
 * A pílula do contador (Início, durante o teste): quantos dias faltam (7 no
 * 1º dia, 1 no último; 14 no 1º dia de quem tem o teste antigo), quantos já
 * passaram e o total de bolinhas, o teste desta conta. `null` fora do
 * teste. O último dia ganha o acento e o atalho "Ver planos". O "faltam"
 * fica entre 1 e o total, mesmo com o relógio torto (início no futuro).
 */
export function estadoDaPilula(estado: EstadoAssinatura | null): {
  faltam: number;
  feitos: number;
  total: number;
  ultimo: boolean;
} | null {
  if (!estado || estado.status !== "trial" || estado.diasRestantes == null)
    return null;
  const total = estado.diasDoTeste;
  const faltam = Math.min(Math.max(estado.diasRestantes, 1), total);
  return { faltam, feitos: total + 1 - faltam, total, ultimo: faltam === 1 };
}
