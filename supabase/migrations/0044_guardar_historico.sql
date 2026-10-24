-- ============================================================
-- JobApp Rede — Migration 0044: histórico de depósitos (guardar dinheiro)
-- ============================================================
-- ESCRITA, NÃO APLICADA. Roda no Supabase SQL Editor quando o dono decidir.
-- Pedido do capitão em 2026-10-20.
--
-- O que faz: cria `guardar_historico`, um registro por vez que a pessoa
-- guarda dinheiro (em euro) num Desejo da Wishlist.
--
-- Por quê: hoje `rede_wishlist_items.valor_atual` só guarda o total; não dá
-- para mostrar "quando e quanto" foi guardado.
--
-- Sem trigger: esta tabela não mexe em `valor_atual`. Quem soma é o app
-- (e o `guardar_meta` da Jornada, 0035, segue como está).
--
-- Só o dono lê e cria. Não há update nem delete para a usuária: depósito é
-- histórico. Apagar o Desejo apaga os depósitos dele (on delete cascade).
-- A policy de insert também confere que o Desejo é da própria pessoa: sem
-- isso daria para gravar depósito no Desejo de outra.

create table if not exists public.guardar_historico (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  desejo_id uuid not null references public.rede_wishlist_items(id) on delete cascade,
  valor numeric(10, 2) not null check (valor > 0),
  data date not null default current_date,
  criado_em timestamptz not null default now()
);

comment on table public.guardar_historico is
  'Depósitos (em euro) guardados em cada Desejo. A soma em valor_atual vem do app. Pedido do capitão em 2026-10-20.';

alter table public.guardar_historico enable row level security;

revoke all on table public.guardar_historico from anon, authenticated, service_role;
grant select, insert on table public.guardar_historico to authenticated;
grant select, insert, update, delete on table public.guardar_historico to service_role;

drop policy if exists "guardar_historico: dono lê" on public.guardar_historico;
create policy "guardar_historico: dono lê"
  on public.guardar_historico
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "guardar_historico: dono cria no próprio desejo" on public.guardar_historico;
create policy "guardar_historico: dono cria no próprio desejo"
  on public.guardar_historico
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.rede_wishlist_items w
      where w.id = desejo_id
        and w.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- TESTE (rodar à parte, depois da migration). Transação com ROLLBACK.
-- Cria um Desejo de 500 €, grava um depósito de 50 €, faz a soma que o app
-- faz e grava em valor_atual. Esperado: valor_atual = 50.00.
-- ------------------------------------------------------------
-- begin;
--   select set_config('request.jwt.claims', json_build_object(
--     'sub', (select usado_por from public.rede_convites where usado_por is not null limit 1),
--     'role', 'authenticated')::text, true);
--   set local role authenticated;
--
--   insert into public.rede_wishlist_items (user_id, nome, cor, valor_alvo)
--   values (auth.uid(), 'teste 0044', '#C9A227', 500.00);
--
--   insert into public.guardar_historico (user_id, desejo_id, valor)
--   select auth.uid(), id, 50.00 from public.rede_wishlist_items
--   where user_id = auth.uid() and nome = 'teste 0044';
--
--   update public.rede_wishlist_items w
--   set valor_atual = (select coalesce(sum(g.valor), 0)
--                      from public.guardar_historico g where g.desejo_id = w.id)
--   where w.user_id = auth.uid() and w.nome = 'teste 0044';
--
--   select nome, valor_alvo, valor_atual from public.rede_wishlist_items
--   where user_id = auth.uid() and nome = 'teste 0044';
-- rollback;
