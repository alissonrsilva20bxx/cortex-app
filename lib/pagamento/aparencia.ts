/**
 * A aparência do Payment Element (o iframe do Stripe) com as cores do app:
 * as variáveis do desenho (--pe-*, --t-*) lidas do tema de agora e passadas
 * ao Stripe em rgb() (o Stripe não entende `color-mix()` nem `var()`).
 */

/** Resolve qualquer cor CSS (inclusive color-mix e var) para "rgb(r, g, b)". */
export function corResolvida(css: string, base: HTMLElement): string {
  const sonda = document.createElement("span");
  sonda.style.color = css;
  sonda.style.display = "none";
  base.appendChild(sonda);
  const lida = getComputedStyle(sonda).color;
  sonda.remove();
  // color(srgb r g b) / oklab(): passa por um canvas para virar rgb().
  if (/^rgba?\(/.test(lida)) return lida;
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const g = c.getContext("2d");
  if (!g) return lida;
  g.fillStyle = lida;
  g.fillRect(0, 0, 1, 1);
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${gr}, ${b})`;
}

export function aparenciaDoApp(base: HTMLElement, escuro: boolean) {
  const cor = (v: string) => corResolvida(`var(${v})`, base);
  return {
    theme: escuro ? "night" : "stripe",
    variables: {
      colorPrimary: cor("--t-acc"),
      colorBackground: cor("--pe-input"),
      colorText: cor("--pe-text"),
      colorTextSecondary: cor("--pe-label"),
      colorDanger: cor("--t-red"),
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      borderRadius: "12px",
      spacingUnit: "4px",
    },
    rules: {
      ".Input": {
        boxShadow: `0 0 0 1px ${cor("--pe-border")}`,
        border: "none",
      },
      ".Input--invalid": { boxShadow: `0 0 0 2px ${cor("--t-red")}` },
      ".Tab": { boxShadow: `0 0 0 1px ${cor("--pe-border")}`, border: "none" },
      ".Tab--selected": { boxShadow: `0 0 0 2px ${cor("--t-acc")}` },
      ".Label": { fontWeight: "600", fontSize: "12px" },
    },
  };
}

/** A fonte do app dentro do iframe do Stripe. */
export const FONTES_DO_STRIPE = [
  {
    cssSrc:
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap",
  },
];
