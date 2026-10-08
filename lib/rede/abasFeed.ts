/**
 * As 3 abas do feed da Rede (proposta "Três abas", feed-rede.html), no
 * lugar da fileira de amigas estilo stories:
 *
 *  - Para você: tudo, todos os formatos misturados;
 *  - Amigas: as publicações das amigas (e as suas), separadas em "Novas
 *    desde a sua última visita" e "Já visto";
 *  - Descobrir: pessoas para conhecer e as dicas mais curtidas da semana.
 *
 * Lógica pura (sem DOM): testada em tests/lib/redeAbasFeed.test.ts. A última
 * visita à aba Amigas fica no aparelho (localStorage), por conta.
 */

import type { FeedPost } from "./feed";

export type AbaFeed = "paraVoce" | "amigas" | "descobrir";

export const ABAS_FEED: readonly { id: AbaFeed; rotulo: string }[] = [
  { id: "paraVoce", rotulo: "Para você" },
  { id: "amigas", rotulo: "Amigas" },
  { id: "descobrir", rotulo: "Descobrir" },
];

export function ehAbaFeed(x: unknown): x is AbaFeed {
  return x === "paraVoce" || x === "amigas" || x === "descobrir";
}

/** Publicações da aba Amigas: das amigas e as suas (o filtro de antes). */
export function postsDasAmigas(
  posts: readonly FeedPost[],
  amigas: readonly string[],
  usuarioId: string
): FeedPost[] {
  return posts.filter(
    (p) => p.autorId === usuarioId || amigas.includes(p.autorId)
  );
}

/** Separa em novas (depois de `corte`) e já vistas. Sem corte (1ª visita),
 * tudo fica em "novas" e não há divisão. */
export function separarNovas(
  posts: readonly FeedPost[],
  corte: string | null
): { novas: FeedPost[]; vistas: FeedPost[]; dividir: boolean } {
  if (!corte) return { novas: [...posts], vistas: [], dividir: false };
  const t = new Date(corte).getTime();
  const novas = posts.filter((p) => new Date(p.criadoEm).getTime() > t);
  const vistas = posts.filter((p) => new Date(p.criadoEm).getTime() <= t);
  return { novas, vistas, dividir: true };
}

/** O número na aba Amigas: publicações das amigas (não as suas) depois da
 * última visita. Sem visita registrada, nenhum número. */
export function contarNovasDasAmigas(
  posts: readonly FeedPost[],
  amigas: readonly string[],
  ultimaVisita: string | null
): number {
  if (!ultimaVisita) return 0;
  const t = new Date(ultimaVisita).getTime();
  return posts.filter(
    (p) => amigas.includes(p.autorId) && new Date(p.criadoEm).getTime() > t
  ).length;
}

const SEMANA_MS = 7 * 86_400_000;

/** Descobrir: as dicas dos últimos 7 dias, das mais curtidas para as
 * menos (empate: a mais nova primeiro). */
export function dicasDaSemana(
  posts: readonly FeedPost[],
  agora: Date = new Date()
): FeedPost[] {
  const desde = agora.getTime() - SEMANA_MS;
  return posts
    .filter(
      (p) => p.categoria === "dica" && new Date(p.criadoEm).getTime() >= desde
    )
    .sort(
      (a, b) =>
        b.curtidas - a.curtidas ||
        new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    );
}

const chaveVisita = (usuarioId: string) => `rede:amigas-visita:${usuarioId}`;

/** Última visita à aba Amigas neste aparelho (ISO), ou null. Nunca lança. */
export function lerUltimaVisitaAmigas(usuarioId: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const v = localStorage.getItem(chaveVisita(usuarioId));
    return v && !Number.isNaN(new Date(v).getTime()) ? v : null;
  } catch {
    return null;
  }
}

/** Grava a visita de agora. Silencioso em qualquer falha. */
export function gravarVisitaAmigas(
  usuarioId: string,
  quando: Date = new Date()
): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(chaveVisita(usuarioId), quando.toISOString());
  } catch {
    /* sem storage: a aba Amigas só não mostra o que é novo */
  }
}
