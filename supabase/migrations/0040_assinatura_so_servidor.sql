-- ============================================================
-- JobApp — Migration 0040: assinatura só pelo servidor (Pagamento/Stripe)
-- ============================================================
-- ESCRITA, NÃO APLICADA. Roda no Supabase SQL Editor quando o dono decidir.
--
-- Por quê: a policy "configuracoes: owner full access" (0001) é `for all`
-- e deixa a própria usuária, com a sessão dela no navegador:
--   - fazer `update configuracoes set assinatura_status = 'ativa'` e ter o
--     app pago sem pagar;
--   - apagar a própria linha e inserir de novo, recomeçando o teste
--     grátis quantas vezes quiser.
-- Com o Pagamento (Stripe) de verdade, quem muda `assinatura_status` é o
-- webhook do Stripe (service role). Para uma sessão de usuária (papel
-- `authenticated`/`anon`), esta migration faz:
--
--   - UPDATE: `assinatura_status` e `trial_started_at` ficam como estavam;
--     o resto da linha (tema, pin_hash…) continua livre como antes;
--   - INSERT (o upsert do PIN/tema quando ainda não há linha):
--     `assinatura_status` nasce 'trial' e o teste começa no cadastro da
--     conta (`auth.users.created_at`), nunca agora nem o que veio;
--   - DELETE da própria linha: recusado (nada no app apaga esta linha).
--
-- O service role (webhook do Stripe, crons) e o próprio banco
-- (handle_new_user, SQL Editor) não são afetados.
-- Sem esta migration o app continua funcionando igual; só fica a brecha.

create or replace function public.configuracoes_papel_da_sessao()
returns text
language sql
stable
set search_path = public
as $$
  -- Sem JWT (SQL Editor, migrations, handle_new_user) a configuração vem
  -- nula ou vazia: o nullif evita o erro de converter '' em jsonb.
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
$$;

-- security definer: lê auth.users (a sessão da usuária não lê esse schema).
create or replace function public.configuracoes_assinatura_so_servidor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.configuracoes_papel_da_sessao() in ('authenticated', 'anon') then
    if tg_op = 'UPDATE' then
      new.assinatura_status := old.assinatura_status;
      new.trial_started_at := old.trial_started_at;
    elsif tg_op = 'INSERT' then
      new.assinatura_status := 'trial';
      new.trial_started_at := coalesce(
        (select u.created_at from auth.users u where u.id = new.user_id),
        now()
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.configuracoes_sem_delete_pela_sessao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.configuracoes_papel_da_sessao() in ('authenticated', 'anon') then
    raise exception 'configuracoes: a própria conta não apaga esta linha'
      using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists configuracoes_assinatura_so_servidor on public.configuracoes;
create trigger configuracoes_assinatura_so_servidor
  before insert or update on public.configuracoes
  for each row execute function public.configuracoes_assinatura_so_servidor();

drop trigger if exists configuracoes_sem_delete_pela_sessao on public.configuracoes;
create trigger configuracoes_sem_delete_pela_sessao
  before delete on public.configuracoes
  for each row execute function public.configuracoes_sem_delete_pela_sessao();
