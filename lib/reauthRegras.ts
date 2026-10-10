/**
 * Confirmar que é a dona da conta (senha da conta ou Google) antes de mexer
 * no PIN: "Esqueci o PIN" na tela de bloqueio, e desligar/trocar o PIN nos
 * Ajustes. Aqui só as regras puras; a parte que fala com o Supabase mora em
 * lib/reauth.ts. Testado em tests/lib/reauth.test.ts.
 */

export type MetodoReauth = "senha" | "google";

/** Para que a confirmação foi pedida (volta do Google sabe o que fazer). */
export type MotivoReauth = "esqueci-pin" | "desligar-pin" | "trocar-pin";

export const MOTIVOS_REAUTH: readonly MotivoReauth[] = [
  "esqueci-pin",
  "desligar-pin",
  "trocar-pin",
];

export function ehMotivoReauth(x: unknown): x is MotivoReauth {
  return MOTIVOS_REAUTH.includes(x as MotivoReauth);
}

/** O mínimo do usuário do Supabase que estas regras leem. */
export interface UsuarioReauth {
  id: string;
  email?: string | null;
  last_sign_in_at?: string | null;
  identities?: { provider: string }[] | null;
  app_metadata?: { providers?: string[] | null } | null;
}

/** Como esta conta pode se confirmar: senha (conta de e-mail) e/ou Google. */
export function metodosDoUsuario(user: UsuarioReauth): MetodoReauth[] {
  const provedores = new Set<string>([
    ...(user.identities ?? []).map((i) => i.provider),
    ...(user.app_metadata?.providers ?? []),
  ]);
  const metodos: MetodoReauth[] = [];
  if (provedores.has("email") && user.email) metodos.push("senha");
  if (provedores.has("google")) metodos.push("google");
  return metodos;
}

/**
 * Marca gravada antes de ir para o Google. Na volta, a confirmação só vale
 * se a MESMA conta entrou de novo DEPOIS da marca: o `last_sign_in_at` do
 * Supabase tem que ser mais novo que o de antes (relógio do servidor dos
 * dois lados, sem depender do relógio do aparelho).
 */
export interface MarcaGoogle {
  motivo: MotivoReauth;
  usuarioId: string;
  /** `last_sign_in_at` antes de sair para o Google (ou null). */
  entradaAnterior: string | null;
  /** Quando a marca foi feita (ms, relógio do aparelho): validade curta. */
  feitaEm: number;
}

/** Até quanto tempo depois da marca a volta do Google ainda vale. */
export const VALIDADE_DA_MARCA_MS = 10 * 60_000;

export function retornoDoGoogleValido(
  marca: MarcaGoogle | null,
  motivo: MotivoReauth,
  user: UsuarioReauth | null,
  agora: number
): boolean {
  if (!marca || !user) return false;
  if (marca.motivo !== motivo) return false;
  if (agora - marca.feitaEm > VALIDADE_DA_MARCA_MS) return false;
  if (agora < marca.feitaEm) return false;
  if (user.id !== marca.usuarioId) return false;
  if (!user.last_sign_in_at) return false;
  const nova = Date.parse(user.last_sign_in_at);
  if (Number.isNaN(nova)) return false;
  if (marca.entradaAnterior == null) return true;
  const anterior = Date.parse(marca.entradaAnterior);
  return Number.isNaN(anterior) || nova > anterior;
}

export function lerMarca(bruto: string | null): MarcaGoogle | null {
  if (!bruto) return null;
  try {
    const m = JSON.parse(bruto) as Partial<MarcaGoogle>;
    if (
      !ehMotivoReauth(m.motivo) ||
      typeof m.usuarioId !== "string" ||
      typeof m.feitaEm !== "number" ||
      !(m.entradaAnterior === null || typeof m.entradaAnterior === "string")
    )
      return null;
    return m as MarcaGoogle;
  } catch {
    return null;
  }
}

/**
 * Tudo o que a tela de bloqueio e os Ajustes precisam para confirmar a
 * conta e gravar o PIN novo. O app usa `reauthSupabase` (lib/reauth.ts);
 * o laboratório (/dev-preview/app, sem Supabase) troca por um falso.
 */
export interface ReauthAdapter {
  metodos(): Promise<MetodoReauth[]>;
  comSenha(senha: string): Promise<{ ok: true } | { ok: false; erro: string }>;
  /** Vai para o Google (a página sai daqui). */
  comGoogle(motivo: MotivoReauth): Promise<{ ok: false; erro: string } | void>;
  /** Na volta: há uma confirmação pendente com este motivo? */
  motivoPendente(): MotivoReauth | null;
  /** Na volta: consome a marca e diz se a confirmação vale. */
  retornoDoGoogle(motivo: MotivoReauth): Promise<boolean>;
  /** Grava o hash do PIN novo na conta. */
  gravarPin(usuarioId: string, hash: string): Promise<boolean>;
}
