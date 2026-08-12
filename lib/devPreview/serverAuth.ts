import "server-only";

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

import { createClient as createCookieClient } from "../supabase-server";
import type { Database } from "../database.types";
import { DEV_PREVIEW_SESSION_HEADER, isDevPreviewEnvironment } from "./session";

type RedeClient = SupabaseClient<Database>;

export type GateAuthResult =
  | { kind: "unavailable"; message: string }
  | { kind: "unauthenticated" }
  | { kind: "authenticated"; supabase: RedeClient; userId: string };

const SERVICO_INDISPONIVEL =
  "Serviço indisponível — não foi possível contatar o Supabase.";

/**
 * Single entry point the Gate routes (solicitar-beta, convites) use to
 * resolve "who is calling, and can we even reach the backend". Folds the
 * real cookie-based session (production, any real login) and the
 * /dev-preview/** bearer-token session (see ./session.ts — T6 follow-up:
 * dev-preview had no real Auth cookie, so both routes always hit
 * middleware's redirect-to-/login and choked parsing the login page as
 * JSON) into one discriminated result, so route handlers never
 * special-case dev-preview and never confuse "no session" with "backend
 * unreachable" — messages differ on purpose (requirement: differentiate
 * "sessão ausente" from "serviço indisponível").
 */
export async function resolveGateAuth(
  request: NextRequest
): Promise<GateAuthResult> {
  const devPreviewToken = isDevPreviewEnvironment()
    ? request.headers.get(DEV_PREVIEW_SESSION_HEADER)
    : null;

  if (devPreviewToken) {
    return resolveDevPreviewAuth(devPreviewToken);
  }

  return resolveCookieAuth();
}

async function resolveCookieAuth(): Promise<GateAuthResult> {
  const supabase = createCookieClient();
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return { kind: "unauthenticated" };
    return { kind: "authenticated", supabase, userId: data.user.id };
  } catch {
    return { kind: "unavailable", message: SERVICO_INDISPONIVEL };
  }
}

async function resolveDevPreviewAuth(token: string): Promise<GateAuthResult> {
  const url = process.env.SUPABASE_TEST_URL;
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
  if (!url || !anonKey) {
    return {
      kind: "unavailable",
      message:
        'Ambiente de teste local não configurado — rode "supabase start" e preencha .env.test.local (ver docs/rede/TEST_HARNESS.md).',
    };
  }

  let userId: string;
  try {
    const probe = createSupabaseJsClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await probe.auth.getUser(token);
    if (error || !data.user) return { kind: "unauthenticated" };
    userId = data.user.id;
  } catch {
    return {
      kind: "unavailable",
      message:
        "Serviço indisponível — não foi possível contatar o Supabase local de teste.",
    };
  }

  // Re-created (not reused) so every call after this one carries the
  // caller's own JWT — RPCs and table access run under RLS exactly as
  // they would for a real cookie session, never with elevated privilege.
  const supabase = createSupabaseJsClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  return { kind: "authenticated", supabase, userId };
}
