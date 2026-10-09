/**
 * Limite de tentativas do PIN (trava do app e trava do Cofre, que usam o
 * mesmo PIN e o mesmo contador):
 *
 *  - os 4 primeiros erros não esperam nada;
 *  - o 5º erro trava o teclado por 1 minuto;
 *  - cada erro depois disso dobra a espera: 2, 4, 8… minutos, até 1 hora;
 *  - acertar o PIN, criar um PIN novo depois de confirmar a conta
 *    ("Esqueci o PIN") ou sair da conta zera o contador.
 *
 * O contador fica no aparelho, por conta (localStorage): recarregar a
 * página ou fechar o app não zera. Sair da conta zera, porque para voltar
 * é preciso a senha (ou o Google) da conta.
 *
 * Lógica pura + leitura/gravação que nunca lança; testada em
 * tests/lib/pinTentativas.test.ts.
 */

export const ERROS_ANTES_DA_ESPERA = 5;
export const ESPERA_INICIAL_MS = 60_000;
export const ESPERA_MAXIMA_MS = 60 * 60_000;

export interface EstadoTentativas {
  /** Erros seguidos desde o último acerto (ou desde que zerou). */
  erros: number;
  /** Até quando o teclado fica travado (ms desde 1970), ou null. */
  esperaAte: number | null;
}

export const SEM_TENTATIVAS: EstadoTentativas = { erros: 0, esperaAte: null };

/** Quanto esperar depois do erro número `erros` (0 antes do 5º). */
export function esperaParaErros(erros: number): number {
  if (erros < ERROS_ANTES_DA_ESPERA) return 0;
  const dobras = erros - ERROS_ANTES_DA_ESPERA;
  return Math.min(ESPERA_INICIAL_MS * 2 ** dobras, ESPERA_MAXIMA_MS);
}

/** O estado depois de mais um erro, às `agora` ms. */
export function registrarErro(
  estado: EstadoTentativas,
  agora: number
): EstadoTentativas {
  const erros = estado.erros + 1;
  const espera = esperaParaErros(erros);
  return { erros, esperaAte: espera > 0 ? agora + espera : null };
}

/** Quantos ms faltam de espera (0 = pode digitar). */
export function restanteDaEspera(
  estado: EstadoTentativas,
  agora: number
): number {
  return estado.esperaAte != null && estado.esperaAte > agora
    ? estado.esperaAte - agora
    : 0;
}

/** "1:00", "0:07", "16:00" — para a mensagem da espera. */
export function formatarEspera(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const min = Math.floor(total / 60);
  const seg = String(total % 60).padStart(2, "0");
  return `${min}:${seg}`;
}

const PREFIXO = "pin:tentativas:";
const chave = (usuarioId: string) => `${PREFIXO}${usuarioId}`;

function valido(x: unknown): x is EstadoTentativas {
  if (!x || typeof x !== "object") return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.erros === "number" &&
    Number.isInteger(e.erros) &&
    e.erros >= 0 &&
    (e.esperaAte === null || typeof e.esperaAte === "number")
  );
}

/** O contador desta conta neste aparelho. Nunca lança. */
export function lerTentativas(usuarioId: string): EstadoTentativas {
  try {
    if (typeof localStorage === "undefined") return SEM_TENTATIVAS;
    const bruto = localStorage.getItem(chave(usuarioId));
    if (!bruto) return SEM_TENTATIVAS;
    const e: unknown = JSON.parse(bruto);
    return valido(e) ? e : SEM_TENTATIVAS;
  } catch {
    return SEM_TENTATIVAS;
  }
}

export function gravarTentativas(
  usuarioId: string,
  estado: EstadoTentativas
): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(chave(usuarioId), JSON.stringify(estado));
  } catch {
    /* sem storage: o contador vale só enquanto a tela está aberta */
  }
}

export function zerarTentativas(usuarioId: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(chave(usuarioId));
  } catch {
    /* nada a fazer */
  }
}

/** Sair da conta: zera o contador de todas as contas deste aparelho. */
export function zerarTodasAsTentativas(): void {
  try {
    if (typeof localStorage === "undefined") return;
    const chaves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIXO)) chaves.push(k);
    }
    chaves.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* nada a fazer */
  }
}
