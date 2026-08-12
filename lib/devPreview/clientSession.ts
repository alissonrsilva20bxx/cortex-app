"use client";

import { DEV_PREVIEW_GATE_PATHS, DEV_PREVIEW_SESSION_HEADER } from "./session";

export type DevPreviewSessionStatus =
  | { kind: "loading" }
  | { kind: "unavailable"; message: string }
  | { kind: "ready" };

let originalFetch: typeof window.fetch | null = null;

/**
 * Calls the bootstrap route (app/api/dev-preview/session/route.ts) to get
 * a real local-Supabase bearer token, then transparently attaches it —
 * only to the Gate's two real endpoints — via a scoped window.fetch patch.
 * RedeTeaserGate.tsx/SerialKeySheet.tsx never know this exists: they keep
 * calling fetch("/api/rede/...") exactly as in production (T6 follow-up
 * requirement: preserve the Gate's real contracts untouched). Mirrors how
 * this same page already swaps the Supabase client for a mock one
 * (__setMockSupabaseClient) without RedeGatedTab knowing about it.
 */
export async function enableDevPreviewGateSession(): Promise<DevPreviewSessionStatus> {
  try {
    const res = await fetch("/api/dev-preview/session", { method: "POST" });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.accessToken) {
      return {
        kind: "unavailable",
        message:
          data?.error ??
          "Sessão de teste local indisponível — não foi possível contatar o Supabase local.",
      };
    }

    patchFetch(data.accessToken as string);
    return { kind: "ready" };
  } catch {
    return {
      kind: "unavailable",
      message:
        "Sessão de teste local indisponível — não foi possível contatar o Supabase local.",
    };
  }
}

/** Restores the original window.fetch — call from the effect's cleanup. */
export function disableDevPreviewGateSession() {
  if (originalFetch) {
    window.fetch = originalFetch;
    originalFetch = null;
  }
}

function patchFetch(token: string) {
  if (originalFetch) return;
  const base = window.fetch.bind(window);
  originalFetch = base;

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (isDevPreviewGateRequest(input)) {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined)
      );
      headers.set(DEV_PREVIEW_SESSION_HEADER, token);
      return base(input, { ...init, headers });
    }
    return base(input, init);
  };
}

function isDevPreviewGateRequest(input: RequestInfo | URL): boolean {
  const raw = input instanceof Request ? input.url : input.toString();
  let pathname: string;
  try {
    pathname = new URL(raw, window.location.origin).pathname;
  } catch {
    pathname = raw;
  }
  return (DEV_PREVIEW_GATE_PATHS as readonly string[]).includes(pathname);
}
