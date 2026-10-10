/**
 * Confirmação da conta pelo Supabase (senha ou Google) — regras em
 * lib/reauthRegras.ts.
 *
 * - Senha: `signInWithPassword` com o e-mail da própria conta. Senha certa
 *   renova a sessão da mesma conta; senha errada não mexe na sessão.
 * - Google: grava uma marca (sessionStorage, a mesma aba) e vai para o
 *   Google com `prompt=select_account`; a volta passa pelo
 *   /auth/callback com `next=/?reauth=<motivo>`, e quem pediu confere a
 *   marca com `retornoDoGoogle`.
 */
import { supabase } from "@/lib/supabase";
import {
  lerMarca,
  metodosDoUsuario,
  retornoDoGoogleValido,
  type MarcaGoogle,
  type MotivoReauth,
  type ReauthAdapter,
} from "@/lib/reauthRegras";

const CHAVE_MARCA = "reauth:google";

function lerMarcaGuardada(): MarcaGoogle | null {
  try {
    return lerMarca(sessionStorage.getItem(CHAVE_MARCA));
  } catch {
    return null;
  }
}

export const reauthSupabase: ReauthAdapter = {
  async metodos() {
    const { data } = await supabase.auth.getUser();
    return data.user ? metodosDoUsuario(data.user) : [];
  },

  async comSenha(senha) {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) return { ok: false, erro: "Esta conta não entra com senha." };
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    return error
      ? { ok: false, erro: "Senha incorreta. Confira e tente de novo." }
      : { ok: true };
  },

  async comGoogle(motivo) {
    const { data } = await supabase.auth.getUser();
    if (!data.user)
      return { ok: false, erro: "Sessão expirada. Entre de novo." };
    const marca: MarcaGoogle = {
      motivo,
      usuarioId: data.user.id,
      entradaAnterior: data.user.last_sign_in_at ?? null,
      feitaEm: Date.now(),
    };
    try {
      sessionStorage.setItem(CHAVE_MARCA, JSON.stringify(marca));
    } catch {
      return { ok: false, erro: "Não foi possível abrir o Google aqui." };
    }
    const next = `/?reauth=${motivo}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) return { ok: false, erro: "Não foi possível abrir o Google." };
  },

  motivoPendente() {
    return lerMarcaGuardada()?.motivo ?? null;
  },

  async retornoDoGoogle(motivo: MotivoReauth) {
    const marca = lerMarcaGuardada();
    if (!marca || marca.motivo !== motivo) return false;
    // A marca vale uma vez só.
    try {
      sessionStorage.removeItem(CHAVE_MARCA);
    } catch {
      /* nada a fazer */
    }
    const { data } = await supabase.auth.getUser();
    return retornoDoGoogleValido(marca, motivo, data.user, Date.now());
  },

  async gravarPin(usuarioId, hash) {
    const { error } = await supabase
      .from("configuracoes")
      .upsert(
        { user_id: usuarioId, pin_hash: hash },
        { onConflict: "user_id" }
      );
    return !error;
  },
};

/** O laboratório (/dev-preview/app) troca o adaptador por um falso. */
let adaptadorAtual: ReauthAdapter = reauthSupabase;
export function usarReauth(adaptador: ReauthAdapter | null) {
  adaptadorAtual = adaptador ?? reauthSupabase;
}
export function reauthAtual(): ReauthAdapter {
  return adaptadorAtual;
}

/** Tira o `?reauth=` da barra de endereço depois de tratar a volta. */
export function limparReauthDaUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("reauth")) return;
    url.searchParams.delete("reauth");
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    /* nada a fazer */
  }
}
