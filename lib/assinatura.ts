import type { AssinaturaStatus } from "@/lib/types";

/** Duração do teste grátis (§7.1 do spec): 14 dias, sem cartão pra começar. */
export const TRIAL_DIAS = 14;

export interface EstadoAssinatura {
  /** Status efetivo — considera o prazo do teste, não só o valor salvo. */
  status: AssinaturaStatus;
  /** Dias restantes de teste (nunca negativo); null fora do trial. */
  diasRestantes: number | null;
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
  if (assinaturaStatus === "ativa") {
    return { status: "ativa", diasRestantes: null };
  }

  const inicio = new Date(trialStartedAt);
  const fimTrial = new Date(inicio);
  fimTrial.setDate(fimTrial.getDate() + TRIAL_DIAS);
  const diasRestantes = Math.ceil(
    (fimTrial.getTime() - ref.getTime()) / 86_400_000
  );

  if (diasRestantes <= 0) {
    return { status: "vencida", diasRestantes: 0 };
  }
  return { status: "trial", diasRestantes };
}
