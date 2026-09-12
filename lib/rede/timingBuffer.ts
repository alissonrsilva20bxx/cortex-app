/**
 * TEMP-TIMING -- buffer das linhas `[rede-timing]` pra ler na própria tela
 * do celular, sem precisar de Mac + Web Inspector pra abrir o console do
 * Safari (ver `components/rede/RedeTimingOverlay.tsx`, que exibe isto).
 * Remover junto do resto da instrumentação `TEMP-TIMING` (ver handoff da
 * PR #121) depois que o reteste confirmar o fix do gate da Rede.
 *
 * Intercepta `console.info` UMA vez, só no navegador (nunca no servidor --
 * SSR roda em Node, patchar lá afetaria log do processo inteiro sem
 * necessidade). Toda linha que comece com "[rede-timing]" é replicada pro
 * buffer; o `console.info` original sempre roda também, então nada some do
 * Web Inspector de verdade pra quem tiver um Mac à mão.
 */

type Ouvinte = (linhas: readonly string[]) => void;

const MAX_LINHAS = 80;
const linhas: string[] = [];
const ouvintes = new Set<Ouvinte>();
let instalado = false;

function notificar(): void {
  const copia = [...linhas];
  ouvintes.forEach((f) => f(copia));
}

function instalar(): void {
  if (instalado || typeof window === "undefined") return;
  instalado = true;
  const original = console.info.bind(console);
  console.info = (...args: unknown[]) => {
    original(...args);
    const primeiro = args[0];
    if (typeof primeiro === "string" && primeiro.startsWith("[rede-timing]")) {
      const hora = new Date().toISOString().slice(11, 23);
      linhas.push(`${hora} ${args.map((a) => String(a)).join(" ")}`);
      while (linhas.length > MAX_LINHAS) linhas.shift();
      notificar();
    }
  };
}

instalar();

export function obterLinhas(): readonly string[] {
  return linhas;
}

export function assinar(f: Ouvinte): () => void {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

/** Só pra teste -- limpa o buffer e desfaz o "já instalei" (não desfaz o
 * patch em si, mas evita que testes vazem linhas de um caso pro outro). */
export function _resetParaTeste(): void {
  linhas.length = 0;
}
