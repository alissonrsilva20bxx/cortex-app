# JobApp — Master Context (cole no início de cada sessão)

**App**: PWA para profissionais autônomos gerenciarem jobs, finanças e documentos.  
**Stack**: Next.js 14 App Router · TypeScript · Tailwind CSS · Supabase · PWA  
**Prod**: https://jobapp-bxx-project.vercel.app | **Supabase**: https://seciereacfestemdhzhp.supabase.co  
**Dev**: `npm run dev` → localhost:3000 | **Deploy**: `vercel --prod --yes`

## Arquivos-chave

- `app/page.tsx` — orquestrador principal (estado global, tabs, modais)
- `app/layout.tsx` — ThemeProvider + ToastProvider
- `app/login/page.tsx` — Google OAuth login
- `lib/supabase.ts` — createBrowserClient
- `lib/types.ts` — Job, Meta, Despesa, Usuario, TabId, HomeCardConfig, ChartPrefConfig
- `lib/theme.ts` — THEMES, THEME_LABELS, THEME_ACCENTS, MODE_STORAGE_KEY
- `lib/pin.ts` — verifyPin, hashPin
- `styles/globals.css` — design system (CSS vars, glass-card, progress-track/fill, animate-fade-up)
- `components/Toast.tsx` — useToast() → { success(msg), error(msg) }
- `components/ThemeProvider.tsx` — useTheme() → { theme, setTheme, mode, setMode }
- `components/charts/` — MiniBarChart, AreaSparkline, DonutChart, ProgressRing (SVG puro)

## Design System

Dark luxury glassmorphism. Temas via `data-theme` em `<html>`. Modo claro via `data-mode="light"`.

**Temas**: pink-neon (#FF2D78) · purple (#9B5CF6) · crimson (#DC143C) · ocean (#00CED1) · gold (#F59E0B) · emerald (#10B981) · midnight (#6366F1)

**CSS vars**: `--accent` `--accent-rgb` `--glow` `--glow-sm` `--surface` `--surface-2` `--border-color` `--body-bg` `--text` `--text-2` `--text-muted` `--bg-rgb`

**Classes**: `glass-card` `section-label` `progress-track` `progress-fill` `animate-fade-up` `no-scrollbar`

## Banco de dados

- `jobs`: id, user_id, cliente_nome, data(DATE), hora, valor, modalidade(presencial|online), local, status(agendado|confirmado|concluído|cancelado), observacoes, criado_em
- `metas`: id, user_id, periodo(dia|mes|ano), valor_alvo
- `configuracoes`: user_id(PK), tema, pin_hash
- `notas`: id, user_id, conteudo, criado_em
- `despesas`: id, user_id, descricao, valor, categoria(equipamentos|transporte|marketing|ferramentas|alimentacao|outros), data(DATE), criado_em

**SQL para criar despesas** (Supabase SQL Editor):

```sql
CREATE TABLE IF NOT EXISTS public.despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  categoria TEXT NOT NULL DEFAULT 'outros',
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_despesas" ON public.despesas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

Mapeamento DB→App: cliente_nome→clienteNome, criado_em→criadoEm, valor_alvo→valorAlvo, pin_hash→pinHash

## Storage

Bucket `cofre`, paths: `{userId}/{categoria}/{filename}`  
Categorias: comprovantes · conversas · documentos · pessoal

## Autenticação

Google OAuth: `supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: window.location.origin+'/auth/callback' } })`

## Estado global (page.tsx)

activeTab, usuario, jobs[], metas[], jobsRefreshKey, financeiroRefreshKey, cofreRefreshKey, pinHash, locked, jobFormOpen, metaFormOpen, uploadOpen, editingJob

## Preferências (localStorage)

- `jobapp-theme` — tema ativo
- `jobapp-mode` — "dark" | "light"
- `jobapp-chart-prefs` — `{ financeiro: 'bar'|'area', jobs: 'bar'|'donut' }`
- `jobapp-home-cards` — `{ nextJob: bool, financeSummary: bool }`
- `jobapp-card-styles` — `{ nextJob: 'compact'|'standard', financeSummary: 'compact'|'standard' }`

## Estrutura de componentes por tab

**Home**: GreetingHeader + NextJobCard (expandível) + FinanceSummaryCard (sparkline + progress ring, clicável→financeiro)

**Jobs (JobsTab)**: filter chips + chart togglável (bar de receitas / donut de status) + lista JobCard (faixa lateral colorida por status)

**Financeiro (FinanceiroTab)**: abas internas Visão|Receitas|Despesas|Metas

- Visão: stats (dia/mes/ano) + MiniBarChart de receitas por semana
- Receitas: lista jobs concluídos
- Despesas: form de nova despesa + lista categorizada
- Metas: progress bars com neon glow + badge ✓

**Cofre (CofreTab)**: filter chips + lista glass-card com category badge colorido

**Ajustes (AjustesTab)**: abas internas Geral|Temas|Tela Inicial|Gráficos

- Geral: PIN + Sign out
- Temas: grid 3 cols de swatches + toggle Claro/Escuro
- Tela Inicial: toggles de cards + seletor de estilo (compact/standard)
- Gráficos: tipo por tab (Financeiro: bar/area; Jobs: bar/donut)

## Env vars (já configuradas Vercel + .env.local)

NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
