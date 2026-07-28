"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

const realClient = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

let activeClient: unknown = realClient;

/**
 * Troca o client real por um mock em memória — só chamado pelo shell
 * mockado em /dev-preview/app, nunca no app de produção. Real client
 * continua existindo (inerte) mesmo depois da troca.
 */
export function __setMockSupabaseClient(mock: unknown) {
  activeClient = mock;
}

/** Volta pro client real do Supabase — usado só em testes/cleanup. */
export function __resetSupabaseClient() {
  activeClient = realClient;
}

export const supabase = new Proxy({} as typeof realClient, {
  get(_target, prop, receiver) {
    return Reflect.get(activeClient as object, prop, receiver);
  },
});
