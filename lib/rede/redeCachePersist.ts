/**
 * Camada persistida do cache da Rede -- `localStorage`, uma chave por
 * usuário (`jobapp-rede-cache:<userId>`). Cobre todo caso em que o
 * documento foi descartado e o cache em memória (`redeCache.ts`) nasce
 * vazio: reload de verdade (cold start) E o iOS matar a aba do PWA em 2º
 * plano (ao reabrir, o documento recarrega). A Rede abre já com a 1ª
 * página do feed + o perfil, sem skeleton, enquanto revalida contra o
 * Supabase.
 *
 * O que NÃO é persistido, de propósito:
 *  - **URLs assinadas das fotos** (5min de validade -- não faz sentido
 *    guardar por 24h). Só `path`/`thumbPath` + `largura`/`altura` viajam;
 *    no hydrate a `<img>` monta com `url=""`/`thumbUrl=""` e o `PhotoStage`
 *    (`FeedFotos.tsx`) re-assina sob demanda (req 5). O `avatar_url` do
 *    perfil/autor É persistido -- é URL PÚBLICA do bucket `avatares`
 *    (migration 0026, `public read`), durável, não expira.
 *  - **Conversas, mensagens, notificações** (req 7) -- conteúdo sensível e
 *    volátil; ficam só no cache em memória.
 *  - Nada de credenciais/tokens.
 *
 * Defensivo em TODO acesso: SSR (sem `localStorage`), aba anônima, storage
 * desabilitado, cota estourada, JSON corrompido e mudança de versão do
 * schema -- qualquer um deles degrada pra "sem cache persistido" (a Rede
 * volta a mostrar skeleton no cold start), nunca lança.
 *
 * ── Carimbo de acesso confirmado (`salvarAcesso`/`carregarAcesso`) ──
 * Chave separada (`jobapp-rede-acesso:<userId>`), guarda só
 * `{ unlocked, confirmadoEm }`. Existe pra sobreviver ao MESMO descarte de
 * documento que zera o cache em memória (`redeCache.ts`): sem isto, todo
 * cold start pagava o round-trip inteiro de `verificarAcessoConvite` antes
 * de mostrar qualquer coisa, mesmo com uma confirmação de poucos segundos
 * atrás -- a aba inteira esperava, não só o feed.
 *
 * Este módulo NÃO decide validade -- só guarda o carimbo. Quem aplica a
 * janela de 90s (`ACESSO_CONFIRMADO_TTL_MS`) é sempre
 * `redeCache.acessoConfirmadoValido`, recalculada a partir do `confirmadoEm`
 * aqui lido; persistir o carimbo não estende essa janela em um milissegundo
 * -- só deixa ela sobreviver ao documento, igual ao cache do feed já
 * sobrevive. `RedeGatedTab` é o único chamador (hidrata a memória no mount,
 * grava só quando `verificarAcessoConvite` confirma `200`).
 */

import type { Database } from "../database.types";
import { FEED_PAGE_SIZE, type FeedPost, type FotoPost } from "./feed";

type RedePerfil = Database["public"]["Tables"]["rede_perfis"]["Row"];

const PREFIXO = "jobapp-rede-cache:";
const PREFIXO_ACESSO = "jobapp-rede-acesso:";
const VERSAO = 1;
const TTL_MS = 24 * 60 * 60 * 1000;
/** No máximo a 1ª página -- páginas mais profundas só voltam do servidor. */
const MAX_POSTS = FEED_PAGE_SIZE;
/** Teto de tamanho do payload serializado; acima disto, corta posts até
 * caber, e se ainda não couber desiste (sem persistir). */
const MAX_BYTES = 512 * 1024;

/** Foto sem as URLs assinadas -- só o que sobrevive 24h. */
type FotoPersistida = Pick<
  FotoPost,
  "ordem" | "thumbPath" | "path" | "largura" | "altura"
>;

type PostPersistido = Omit<FeedPost, "fotos"> & { fotos: FotoPersistida[] };

interface Payload {
  v: number;
  userId: string;
  ts: number;
  feed: PostPersistido[];
  perfil: RedePerfil | null;
}

function temStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function chave(userId: string): string {
  return PREFIXO + userId;
}

function remover(userId: string): void {
  try {
    localStorage.removeItem(chave(userId));
  } catch {
    /* nada a fazer */
  }
}

function despirFoto(f: FotoPost): FotoPersistida {
  return {
    ordem: f.ordem,
    thumbPath: f.thumbPath,
    path: f.path,
    largura: f.largura,
    altura: f.altura,
  };
}

function vestirFoto(f: FotoPersistida): FotoPost {
  // URLs vazias: o PhotoStage re-assina sob demanda quando a <img> monta.
  return { ...f, thumbUrl: "", url: "" };
}

function ehPostPersistido(x: unknown): x is PostPersistido {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.autorId === "string" &&
    typeof p.texto === "string" &&
    typeof p.criadoEm === "string" &&
    Array.isArray(p.fotos)
  );
}

/**
 * Lê e valida o cache persistido desse usuário. Devolve `null` (e limpa a
 * chave) em versão diferente, userId diferente, TTL vencido, JSON inválido
 * ou storage indisponível.
 */
export function carregar(
  userId: string
): { feed: FeedPost[]; perfil: RedePerfil | null } | null {
  if (!temStorage()) return null;
  let cru: string | null;
  try {
    cru = localStorage.getItem(chave(userId));
  } catch {
    return null;
  }
  if (!cru) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cru);
  } catch {
    remover(userId);
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    remover(userId);
    return null;
  }
  const p = parsed as Partial<Payload>;

  if (p.v !== VERSAO || p.userId !== userId) {
    remover(userId);
    return null;
  }
  if (typeof p.ts !== "number" || Date.now() - p.ts > TTL_MS) {
    remover(userId);
    return null;
  }

  const feedCru = Array.isArray(p.feed) ? p.feed : [];
  const feed: FeedPost[] = feedCru.filter(ehPostPersistido).map((post) => ({
    ...(post as PostPersistido),
    fotos: (post.fotos ?? [])
      .filter(
        (f): f is FotoPersistida =>
          !!f &&
          typeof f === "object" &&
          typeof (f as FotoPersistida).path === "string"
      )
      .map(vestirFoto),
  }));

  const perfil =
    p.perfil && typeof p.perfil === "object" ? (p.perfil as RedePerfil) : null;

  if (feed.length === 0 && !perfil) return null;
  return { feed, perfil };
}

/**
 * Persiste a 1ª página do feed + o perfil. Silencioso em qualquer falha
 * (cota, storage indisponível). Só chame com dados JÁ vindos do servidor
 * (não com o estado otimista puro), pra não gravar algo que o servidor
 * ainda não confirmou.
 */
export function salvar(
  userId: string,
  dados: { feed: FeedPost[]; perfil: RedePerfil | null }
): void {
  if (!temStorage()) return;

  let posts: PostPersistido[] = dados.feed.slice(0, MAX_POSTS).map((post) => ({
    ...post,
    fotos: post.fotos.map(despirFoto),
  }));

  const montar = (): string =>
    JSON.stringify({
      v: VERSAO,
      userId,
      ts: Date.now(),
      feed: posts,
      perfil: dados.perfil,
    } satisfies Payload);

  let raw = montar();
  while (raw.length > MAX_BYTES && posts.length > 1) {
    posts = posts.slice(0, Math.ceil(posts.length / 2));
    raw = montar();
  }
  if (raw.length > MAX_BYTES) {
    // Nem 1 post cabe (foto-monstro no texto? improvável) -- não persiste.
    remover(userId);
    return;
  }

  try {
    localStorage.setItem(chave(userId), raw);
  } catch {
    // Cota estourada / storage bloqueado: descarta o que houver e desiste.
    remover(userId);
  }
}

function chaveAcesso(userId: string): string {
  return PREFIXO_ACESSO + userId;
}

interface AcessoPayload {
  v: number;
  userId: string;
  unlocked: boolean;
  confirmadoEm: number;
}

/** Grava o carimbo de acesso confirmado. Só chame com um resultado
 * CONCLUSIVO (`200`) de `verificarAcessoConvite` -- ver o cabeçalho do
 * arquivo. Silencioso em qualquer falha (cota, storage indisponível): sem
 * carimbo persistido, o próximo cold start volta a esperar o round-trip. */
export function salvarAcesso(
  userId: string,
  unlocked: boolean,
  confirmadoEm: number
): void {
  if (!temStorage()) return;
  try {
    localStorage.setItem(
      chaveAcesso(userId),
      JSON.stringify({
        v: VERSAO,
        userId,
        unlocked,
        confirmadoEm,
      } satisfies AcessoPayload)
    );
  } catch {
    /* cota estourada / storage bloqueado -- sem cache persistido de acesso */
  }
}

/** Lê o carimbo persistido. Devolve `null` (sem apagar -- ao contrário de
 * `carregar`, um carimbo não hidratado não é erro) em versão diferente,
 * userId diferente, JSON inválido ou storage indisponível. NÃO aplica o TTL
 * de 90s -- isso é responsabilidade de `redeCache.acessoConfirmadoValido`,
 * a única fonte de verdade sobre validade. */
export function carregarAcesso(
  userId: string
): { unlocked: boolean; confirmadoEm: number } | null {
  if (!temStorage()) return null;
  let cru: string | null;
  try {
    cru = localStorage.getItem(chaveAcesso(userId));
  } catch {
    return null;
  }
  if (!cru) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cru);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Partial<AcessoPayload>;
  if (
    p.v !== VERSAO ||
    p.userId !== userId ||
    typeof p.unlocked !== "boolean" ||
    typeof p.confirmadoEm !== "number"
  ) {
    return null;
  }
  return { unlocked: p.unlocked, confirmadoEm: p.confirmadoEm };
}

/** Limpa o cache persistido (feed + carimbo de acesso) de um usuário, ou de
 * TODOS (logout, quando nem sempre se sabe o id -- varre as chaves com os
 * dois prefixos). */
export function limpar(userId?: string): void {
  if (!temStorage()) return;
  if (userId) {
    remover(userId);
    try {
      localStorage.removeItem(chaveAcesso(userId));
    } catch {
      /* nada a fazer */
    }
    return;
  }
  try {
    const aRemover: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(PREFIXO) || k.startsWith(PREFIXO_ACESSO))) {
        aRemover.push(k);
      }
    }
    for (const k of aRemover) localStorage.removeItem(k);
  } catch {
    /* nada a fazer */
  }
}

export const _internos = {
  PREFIXO,
  PREFIXO_ACESSO,
  VERSAO,
  TTL_MS,
  MAX_POSTS,
  MAX_BYTES,
};
