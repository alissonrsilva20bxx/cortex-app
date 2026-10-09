-- ============================================================
-- JobApp — Migration 0040: assinatura só pelo servidor (Pagamento/Stripe)
-- ============================================================
-- ESCRITA, NÃO APLICADA. Roda no Supabase SQL Editor quando o dono decidir.
--
-- Por quê: a policy "configuracoes: owner full access" (0001) deixa a
-- própria usuária, com a sessão dela no navegador, fazer
--   update configuracoes set assinatura_status = 'ativa'
-- e ter o app pago sem pagar. Com o Pagamento (Stripe) de verdade, quem
-- muda `assinatura_status` é o webhook do Stripe (service role). Esta
-- migration faz essas duas colunas pararem de obedecer a qualquer escrita
-- que venha de uma sessão de usuária (papel `authenticated`/`anon`):
--
--   - UPDATE: `assinatura_status` e `trial_started_at` ficam como estavam;
--     o resto da linha (tema, pin_hash…) continua livre como antes;
--   - INSERT (o upsert do PIN/tema quando ainda não há linha): os dois
--     campos nascem com os DEFAULTs ('trial' / now()), nunca o que veio.
--
-- O service role (webhook do Stripe, crons) e o próprio banco
-- (handle_new_user, que roda como dono da função) não são afetados.
-- Sem esta migration o app continua funcionando igual; só fica a brecha.

create or replace function public.configuracoes_assinatura_so_servidor()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  -- Sem JWT (SQL Editor, migrations, handle_new_user) a configuração vem
  -- nula ou vazia: o nullif evita o erro de converter '' em jsonb.
  papel text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
begin
  if papel in ('authenticated', 'anon') then
    if tg_op = 'UPDATE' then
      new.assinatura_status := old.assinatura_status;
      new.trial_started_at := old.trial_started_at;
    elsif tg_op = 'INSERT' then
      new.assinatura_status := 'trial';
      new.trial_started_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists configuracoes_assinatura_so_servidor on public.configuracoes;
create trigger configuracoes_assinatura_so_servidor
  before insert or update on public.configuracoes
  for each row execute function public.configuracoes_assinatura_so_servidor();
