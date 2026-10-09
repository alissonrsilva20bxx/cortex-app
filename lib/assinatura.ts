import type { AssinaturaStatus } from "@/lib/types";

/** Duração do teste grátis: 7 dias, sem cartão pra começar. Era 14 (§7.1
 * do spec); o onboarding "Linha do tempo" aprovado é de 7 dias (a pílula
 * 7/3/1, o aviso no dia 5 e os planos no dia 8), e mostrar 7 contando 14
 * deixaria a pílula e a tela de planos erradas. Nada no app bloqueia por
 * assinatura: muda só quando o aviso de fim aparece. */
export const TRIAL_DIAS = 7;

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

/**
 * A pílula do contador (Início, durante o teste): quantos dias faltam (7 no
 * 1º dia, 1 no último) e quantos já passaram, para as 7 bolinhas. `null`
 * fora do teste. O último dia ganha o acento e o atalho "Ver planos".
 */
export function estadoDaPilula(
  estado: EstadoAssinatura | null
): { faltam: number; feitos: number; ultimo: boolean } | null {
  if (!estado || estado.status !== "trial" || estado.diasRestantes == null)
    return null;
  const faltam = Math.min(Math.max(estado.diasRestantes, 1), TRIAL_DIAS);
  return { faltam, feitos: TRIAL_DIAS + 1 - faltam, ultimo: faltam === 1 };
}
