-- RD-17 local-test compatibility grant.
--
-- Migration 0001 predates the current Supabase default and does not grant
-- Data API access explicitly. Keep this local exception narrow: only the
-- existing table exercised by the harness is exposed to `authenticated`.
-- New Rede migrations must carry their own least-privilege grants.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.jobs to authenticated;
