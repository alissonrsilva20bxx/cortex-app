import { supabase } from "./supabase";
import { TEXTOS_AUTH } from "./textosAuth";

/**
 * Traduz mensagens de erro do Supabase Auth (sempre em inglês) pra
 * português. Fallback genérico nunca vaza a mensagem crua do provedor.
 *
 * `reasons` vem do erro de senha fraca (`AuthWeakPasswordError`): "length",
 * "characters" ou "pwned". Sem ele, o texto da mensagem decide.
 */
export function mapAuthErrorMessage(
  message: string,
  reasons: readonly string[] = []
): string {
  const erro = TEXTOS_AUTH.erro;
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return erro.credenciais;
  if (m.includes("email not confirmed")) return erro.emailNaoConfirmado;
  if (m.includes("already registered")) return erro.jaCadastrado;
  const minimo = m.match(/at least (\d+) characters?/);
  if (reasons.includes("length") || minimo) {
    return erro.senhaCurta(minimo ? Number(minimo[1]) : null);
  }
  if (
    reasons.includes("characters") ||
    m.includes("should contain at least one character")
  ) {
    return erro.senhaSemVariedade(oQueFaltaNaSenha(message));
  }
  if (
    reasons.includes("pwned") ||
    m.includes("known to be weak") ||
    m.includes("pwned")
  ) {
    return erro.senhaVazada;
  }
  if (m.includes("password") && m.includes("weak")) return erro.senhaFraca;
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return erro.muitasTentativas;
  }
  if (m.includes("email") && m.includes("invalid")) return erro.emailInvalido;
  return erro.generico;
}

/** Lê os grupos de caracteres que o Supabase exige ("…of each: abc…, 012…"). */
function oQueFaltaNaSenha(message: string): string[] {
  const v = TEXTOS_AUTH.variedade;
  const itens: string[] = [];
  if (message.includes("abcdefghijklmnopqrstuvwxyz")) itens.push(v.minuscula);
  if (message.includes("ABCDEFGHIJKLMNOPQRSTUVWXYZ")) itens.push(v.maiuscula);
  if (message.includes("0123456789")) itens.push(v.numero);
  if (message.includes("!@#")) itens.push(v.simbolo);
  return itens;
}

function traduzirErro(error: { message: string }): string {
  const reasons = (error as { reasons?: unknown }).reasons;
  return mapAuthErrorMessage(
    error.message,
    Array.isArray(reasons) ? reasons.map(String) : []
  );
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { error: error ? traduzirErro(error) : null };
}

export async function signUpWithEmail(
  email: string,
  password: string,
  emailRedirectTo: string
): Promise<{ error: string | null; needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });
  if (error) {
    return {
      error: traduzirErro(error),
      needsConfirmation: false,
    };
  }
  // Supabase não retorna erro pra e-mail já cadastrado (evita enumeração) —
  // em vez disso devolve um user "fantasma" com identities: []. Tratamos
  // como o mesmo "verifique seu e-mail" do caso normal, sem revelar se a
  // conta já existia (mesmo padrão neutro do reset de senha).
  if (data.user && data.user.identities?.length === 0) {
    return { error: null, needsConfirmation: true };
  }
  const needsConfirmation = !!data.user && !data.session;
  return { error: null, needsConfirmation };
}

export async function requestPasswordReset(
  email: string,
  redirectTo: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  return { error: error ? traduzirErro(error) : null };
}

export async function updatePassword(
  newPassword: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: error ? traduzirErro(error) : null };
}
