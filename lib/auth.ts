import { supabase } from "./supabase";

/**
 * Traduz mensagens de erro do Supabase Auth (sempre em inglês) pra
 * português. Fallback genérico nunca vaza a mensagem crua do provedor.
 */
export function mapAuthErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }
  if (m.includes("already registered")) {
    return "Já existe uma conta com este e-mail. Tente entrar.";
  }
  if (m.includes("password") && (m.includes("least") || m.includes("weak"))) {
    return "Senha muito curta — use pelo menos 6 caracteres.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Muitas tentativas. Aguarde um momento e tente de novo.";
  }
  if (m.includes("email") && m.includes("invalid")) {
    return "E-mail inválido.";
  }
  return "Não foi possível concluir. Tente novamente.";
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { error: error ? mapAuthErrorMessage(error.message) : null };
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
      error: mapAuthErrorMessage(error.message),
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
  return { error: error ? mapAuthErrorMessage(error.message) : null };
}

export async function updatePassword(
  newPassword: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: error ? mapAuthErrorMessage(error.message) : null };
}
