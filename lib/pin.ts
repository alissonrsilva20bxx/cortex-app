/** Texto visível do PIN que depende do navegador. */
export const TEXTOS_PIN = {
  // Fora de https (ex.: http pelo IP) o navegador não tem `crypto.subtle`
  // e o hash do PIN rejeita.
  semConexaoSegura: "O PIN precisa de conexão segura (https).",
} as const;

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return (await hashPin(pin)) === hash;
}
