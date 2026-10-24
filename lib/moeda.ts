import { LOCALE } from "@/lib/locale";

/**
 * Moeda do app: euro (padrão) ou dólar. É o ÚNICO arquivo que escreve
 * símbolo ou código de moeda e o único formatador de dinheiro (formatMoeda).
 * Trocar a moeda só muda a exibição e o preço dos planos: os valores que a
 * pessoa digitou são números e não são convertidos.
 */

export type Moeda = "EUR" | "USD";

export const MOEDAS: readonly Moeda[] = ["EUR", "USD"];
export const MOEDA_PADRAO: Moeda = "EUR";

/** Chave nova do aparelho (fora do prefixo jobapp-). */
export const CHAVE_MOEDA = "app-moeda";

/** Qualquer valor que não seja uma moeda aceita vira o padrão (euro). */
export function lerMoeda(valor: unknown): Moeda {
  return valor === "USD" ? "USD" : MOEDA_PADRAO;
}

/** "€ 1.234" / "€ 1.234,50" / "US$ 1.234": o formatador de dinheiro do app.
 * `casas` é o máximo de decimais; "auto" mostra centavos só quando o valor
 * tem (preços: "€ 15", "€ 12,50"). */
export function formatMoeda(
  valor: number,
  moeda: Moeda,
  casas: number | "auto" = 0
): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: lerMoeda(moeda),
    maximumFractionDigits:
      casas === "auto" ? (Number.isInteger(valor) ? 0 : 2) : casas,
  }).format(valor);
}

/** A moeda do pedido no formato do Stripe ("eur" ou "usd"). Qualquer outro
 * valor (ou nenhum) vira "eur". */
export function moedaDoStripe(moeda: unknown): "eur" | "usd" {
  const m = typeof moeda === "string" ? moeda.toUpperCase() : moeda;
  return lerMoeda(m) === "USD" ? "usd" : "eur";
}

/** Só o símbolo ("€", "US$"), para rótulos de campo: Valor (€). */
export function simboloMoeda(moeda: Moeda): string {
  const m = lerMoeda(moeda);
  return (
    new Intl.NumberFormat(LOCALE, { style: "currency", currency: m })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? m
  );
}

// ── escolha da pessoa, salva neste aparelho ──

const ouvintes = new Set<() => void>();

/** A moeda salva neste aparelho (euro se não houver, se for inválida ou se
 * não houver storage). Nunca lança. */
export function moedaSalva(): Moeda {
  try {
    return lerMoeda(localStorage.getItem(CHAVE_MOEDA));
  } catch {
    return MOEDA_PADRAO;
  }
}

/** Salva a moeda e avisa as telas abertas. Valor inválido vira euro. Nunca
 * lança. */
export function salvarMoeda(moeda: unknown): void {
  try {
    localStorage.setItem(CHAVE_MOEDA, lerMoeda(moeda));
  } catch {
    /* sem storage: vale só até recarregar */
  }
  ouvintes.forEach((f) => f());
}

/** Avisa quando a moeda muda (nesta aba ou em outra). Devolve o "parar". */
export function assinarMoeda(aviso: () => void): () => void {
  ouvintes.add(aviso);
  const outraAba = (e: StorageEvent) => {
    if (e.key === CHAVE_MOEDA || e.key === null) aviso();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", outraAba);
  }
  return () => {
    ouvintes.delete(aviso);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", outraAba);
    }
  };
}
