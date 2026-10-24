import { LOCALE } from "@/lib/locale";
import { TEXTOS_GUARDAR } from "./textos";

/** Maior valor aceito pela coluna numeric(10, 2) da migration 0044. */
const MAX_CENTAVOS = 9_999_999_999;

export type ValorGuardar =
  | { ok: true; centavos: number; valor: number }
  | { ok: false; erro: string };

/**
 * Lê o que a pessoa digitou ("25", "25,5", "1.250,00", "25.50"), com ou sem símbolo
 * da moeda na frente.
 * Devolve centavos inteiros (sem erro de ponto flutuante) e o valor.
 */
export function lerValorGuardar(texto: string): ValorGuardar {
  const t = texto.trim().replace(/\s/g, "").replace(/^[^\d.,-]+/, "");
  if (!t) return { ok: false, erro: TEXTOS_GUARDAR.erroValorVazio };

  let normal = t;
  if (t.includes(",")) {
    // vírgula é o decimal; ponto vira separador de milhar
    normal = t.replace(/\./g, "").replace(",", ".");
  } else if ((t.match(/\./g) ?? []).length > 1) {
    normal = t.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) {
    return { ok: false, erro: TEXTOS_GUARDAR.erroValorInvalido };
  }
  const [inteiro, frac = ""] = normal.split(".");
  const centavos = Number(inteiro) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(centavos) || centavos > MAX_CENTAVOS) {
    return { ok: false, erro: TEXTOS_GUARDAR.erroValorGrande };
  }
  if (centavos <= 0) return { ok: false, erro: TEXTOS_GUARDAR.erroValorZero };
  return { ok: true, centavos, valor: centavos / 100 };
}

/** "21 de out. · 14:30", no formato do LOCALE. */
export function quando(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString(LOCALE, { day: "2-digit", month: "short" });
  const hora = d.toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dia} · ${hora}`;
}
