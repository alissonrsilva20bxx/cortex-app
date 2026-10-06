import type { CofreFile } from "@/lib/cofre/cofreCache";

/**
 * Lógica pura da tela do Cofre (J05, Jornada): os números do card
 * "Protegido", a seção "Recentes" e a formatação das linhas.
 *
 * Fica fora do `.tsx` pra ter teste executável (o Vitest deste projeto
 * roda em `node`, sem JSX). Nada aqui toca a trava, o foco ou o cache:
 * só recebe a lista que `CofreTab` já buscou e devolve texto/recorte.
 */

/** Quantos arquivos a seção "Recentes" mostra — o mesmo número de linhas do mockup aprovado. */
export const RECENTES_MAX = 4;

const numeroPtBr = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

/** "512 KB", "2,5 MB" — tamanho com vírgula decimal, como o mockup. */
export function formatTamanho(bytes: number): string {
  const b = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  if (b < 1024 * 1024 * 1024) return `${numeroPtBr.format(b / 1024 / 1024)} MB`;
  return `${numeroPtBr.format(b / 1024 / 1024 / 1024)} GB`;
}

/** Soma real dos tamanhos dos arquivos já buscados (metadado do storage). */
export function totalUsado(files: readonly CofreFile[]): number {
  return files.reduce((soma, f) => soma + (f.size > 0 ? f.size : 0), 0);
}

function dataValida(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Data do envio mais recente, "03/10". `null` com o Cofre vazio ou sem
 * nenhuma data válida — quem chama mostra um traço em vez de inventar.
 */
export function ultimoEnvio(files: readonly CofreFile[]): string | null {
  let maisRecente: Date | null = null;
  for (const f of files) {
    const d = dataValida(f.createdAt);
    if (d && (!maisRecente || d > maisRecente)) maisRecente = d;
  }
  if (!maisRecente) return null;
  const dia = String(maisRecente.getDate()).padStart(2, "0");
  const mes = String(maisRecente.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}`;
}

/** Os `RECENTES_MAX` arquivos mais novos, do mais novo pro mais antigo. */
export function recentes(
  files: readonly CofreFile[],
  max: number = RECENTES_MAX
): CofreFile[] {
  return [...files]
    .sort(
      (a, b) =>
        (dataValida(b.createdAt)?.getTime() ?? 0) -
        (dataValida(a.createdAt)?.getTime() ?? 0)
    )
    .slice(0, max);
}

/** "03 de out." — data da linha do arquivo, dia com 2 dígitos, como o mockup. */
export function formatDataArquivo(iso: string): string {
  const d = dataValida(iso);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
