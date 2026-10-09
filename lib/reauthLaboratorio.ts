import type { ReauthAdapter } from "@/lib/reauthRegras";

/** Senha que confirma a conta no laboratório (/dev-preview/app). */
export const SENHA_DO_LABORATORIO = "senha123";

/**
 * Confirmação da conta no laboratório, que não tem Supabase: a senha
 * {@link SENHA_DO_LABORATORIO} confirma, o Google não sai daqui e gravar o
 * PIN novo sempre dá certo (o hash fica só na tela).
 */
export const reauthDeLaboratorio: ReauthAdapter = {
  async metodos() {
    return ["senha", "google"];
  },
  async comSenha(senha) {
    return senha === SENHA_DO_LABORATORIO
      ? { ok: true }
      : { ok: false, erro: "Senha incorreta. Confira e tente de novo." };
  },
  async comGoogle() {
    return {
      ok: false,
      erro: `No laboratório o Google não abre. Use a senha ${SENHA_DO_LABORATORIO}.`,
    };
  },
  motivoPendente() {
    return null;
  },
  async retornoDoGoogle() {
    return false;
  },
  async gravarPin() {
    return true;
  },
};
