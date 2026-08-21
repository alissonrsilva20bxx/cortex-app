-- RD-17 local-test compatibility grant.
--
-- Migration 0001/0004 predate the current Supabase default and do not grant
-- Data API access explicitly. Keep this local exception narrow: only the
-- tables exercised by the harness are exposed to `authenticated`.
-- New Rede migrations must carry their own least-privilege grants.
--
-- Confirmed via #98 (2026-08-21): production already has full
-- select/insert/update/delete for `authenticated` on all of these —
-- checked directly against information_schema.role_table_grants there.
-- This gap is local-only (outdated Supabase CLI default), not a real bug.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.jobs to authenticated;
grant select, insert, update, delete on table public.metas to authenticated;
grant select, insert, update, delete on table public.configuracoes to authenticated;
grant select, insert, update, delete on table public.objetivos to authenticated;
grant select, insert, update, delete on table public.despesas to authenticated;
grant select, insert, update, delete on table public.receitas_avulsas to authenticated;
grant select, insert, update, delete on table public.notas to authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
