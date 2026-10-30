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
  if (ehLimiteDeTentativas(m)) return erro.muitasTentativas;
  if (m.includes("email") && m.includes("invalid")) return erro.emailInvalido;
  return erro.generico;
}

function ehLimiteDeTentativas(m: string): boolean {
  return (
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    // Pedido repetido antes do intervalo do Supabase ("For security
    // purposes, you can only request this after N seconds").
    m.includes("for security purposes")
  );
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

/**
 * O fetch nem chegou ao servidor (sem internet): o auth-js devolve
 * AuthRetryableFetchError com status 0. Erro 5xx vem com o mesmo nome, mas
 * com o status do servidor, e fica no genérico (R21).
 */
function ehSemConexao(error: object): boolean {
  const { name, status } = error as { name?: unknown; status?: unknown };
  return name === "AuthRetryableFetchError" && status === 0;
}

function traduzirErro(error: { message: string }): string {
  if (ehSemConexao(error)) return TEXTOS_AUTH.erro.semConexao;
  const reasons = (error as { reasons?: unknown }).reasons;
  return mapAuthErrorMessage(
    error.message,
    Array.isArray(reasons) ? reasons.map(String) : []
  );
}

/** `emailNaoConfirmado`: a tela oferece "Reenviar e-mail" (R17 M5). */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ error: string | null; emailNaoConfirmado: boolean }> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return {
    error: error ? traduzirErro(error) : null,
    emailNaoConfirmado:
      !!error && error.message.toLowerCase().includes("email not confirmed"),
  };
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

/** Senha nova com espaço no começo ou no fim: o cadastro e a nova senha
 * avisam em vez de cortar em silêncio (R17 B1). O login continua cortando,
 * para quem já criou a senha quando o corte era calado. */
export function senhaComEspacoNasPontas(senha: string): boolean {
  return senha !== senha.trim();
}

/** Intervalo entre dois envios do e-mail de confirmação (o Supabase também
 * recusa pedidos repetidos antes de 60 s). */
export const ESPERA_REENVIO_MS = 60_000;

/** Quantos segundos faltam para poder reenviar; 0 = já pode. */
export function segundosParaReenviar(
  ultimoEnvio: number | null,
  agora: number
): number {
  if (ultimoEnvio == null) return 0;
  return Math.max(
    0,
    Math.ceil((ultimoEnvio + ESPERA_REENVIO_MS - agora) / 1000)
  );
}

/** Manda de novo o e-mail de confirmação do cadastro. `limite`: o Supabase
 * recusou por excesso de pedidos ("Muitas tentativas"); a tela espera o
 * intervalo antes de deixar tentar de novo (R18rev BAIXA 5). */
export async function resendSignupEmail(
  email: string,
  emailRedirectTo: string
): Promise<{ error: string | null; limite: boolean }> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
  });
  if (!error) return { error: null, limite: false };
  return {
    error: traduzirErro(error),
    limite:
      (error as { status?: unknown }).status === 429 ||
      ehLimiteDeTentativas(error.message.toLowerCase()),
  };
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
