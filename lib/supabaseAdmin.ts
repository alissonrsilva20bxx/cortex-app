import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Cliente com service role — só para rotas server-side (ex.: o cron de
 * notificações), que precisam ler dados de todas as usuárias, não só da
 * sessão autenticada. Nunca importar isto de um Client Component.
 *
 * Criado sob demanda (não no topo do módulo): o Next avalia este módulo
 * durante a coleta de páginas do build, antes de qualquer requisição —
 * um construtor eager quebraria `next build` sempre que a service role
 * key ainda não estivesse configurada no ambiente.
 */
export function getSupabaseAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
