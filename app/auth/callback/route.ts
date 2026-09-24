import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function safeNextPath(rawNext: string | null, origin: string): string {
  // Resolve a URL primeiro e valida a origin resultante, em vez de tentar
  // listar padrões perigosos (protocol-relative "//host", barra invertida
  // "/\\host" que o parser de URL do Node trata como separador de host,
  // etc.) — fecha a classe inteira de bypass de open redirect de uma vez.
  if (!rawNext) return "/";
  try {
    const resolved = new URL(rawNext, origin);
    if (resolved.origin !== origin) return "/";
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return "/";
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"), origin);

  // Cria a resposta de redirect antes de setar cookies
  const response = NextResponse.redirect(new URL(next, origin));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", origin));
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Seta em request E response para garantir propagação
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Código genérico, nunca a mensagem crua do provedor (que iria parar na
    // URL -- histórico do navegador, referrer, logs) -- /login só verifica
    // a PRESENÇA de `error` e mostra uma mensagem própria (Fase 5, #128).
    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  return response;
}
