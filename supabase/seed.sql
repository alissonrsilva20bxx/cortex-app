-- RD-17 local-test compatibility grant.
--
-- Migration 0001 predates the current Supabase default and does not grant
-- Data API access explicitly. Keep this local exception narrow: only the
-- existing table exercised by the harness is exposed to `authenticated`.
-- New Rede migrations must carry their own least-privilege grants.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.jobs to authenticated;

-- T17/#70 local-test compatibility grant — same root cause as the `jobs`
-- grant above (migration 0001 predates the current Supabase default), just
-- never hit until now because prior local/dev-preview testing went through
-- the mocked Supabase client, not a real session against `/` with a real
-- new account. `metas`/`configuracoes` are read/written directly by
-- app/page.tsx and OnboardingFlow.tsx (goal step, PIN setup) for any real
-- login — without this, both 42501 "permission denied" locally.
grant select, insert, update, delete on table public.metas to authenticated;
grant select, insert, update, delete on table public.configuracoes to authenticated;
