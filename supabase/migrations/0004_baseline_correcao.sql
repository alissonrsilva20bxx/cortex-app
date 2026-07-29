-- ============================================================
-- JobApp - Migration 0004: reconciliacao idempotente do baseline
-- ============================================================
-- RD-00: cobre somente os objetos confirmados como ausentes por RD-000.
-- Esta migration e aditiva e pode ser executada novamente com seguranca.

-- Temas que o app atual ja oferece, mas que nao existem no schema remoto
-- capturado. A ordem existente do enum e preservada.
alter type public.tema add value if not exists 'grafite';
alter type public.tema add value if not exists 'ocean';
alter type public.tema add value if not exists 'gold';
alter type public.tema add value if not exists 'emerald';
alter type public.tema add value if not exists 'midnight';

-- Mantem o mesmo seed de novos usuarios, com todas as relacoes qualificadas.
-- O search_path vazio impede que objetos controlados pela sessao chamadora
-- sejam resolvidos dentro desta funcao SECURITY DEFINER.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.metas (user_id, periodo, valor_alvo) values
    (new.id, 'dia',  300),
    (new.id, 'mes',  3000),
    (new.id, 'ano',  36000);

  insert into public.configuracoes (user_id) values (new.id);
  return new;
end;
$$;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'push_subscriptions: owner full access'
  ) then
    create policy "push_subscriptions: owner full access"
      on public.push_subscriptions for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

create table if not exists public.despesas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  descricao text not null,
  valor numeric(10,2) not null check (valor > 0),
  categoria text not null default 'outros',
  data date not null default current_date,
  criado_em timestamptz not null default now()
);

alter table public.despesas enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'despesas'
      and policyname = 'user_despesas'
  ) then
    create policy "user_despesas"
      on public.despesas for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

create table if not exists public.receitas_avulsas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  descricao text not null,
  valor numeric(10,2) not null check (valor > 0),
  categoria text not null default 'outros',
  data date not null default current_date,
  criado_em timestamptz not null default now()
);

alter table public.receitas_avulsas enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'receitas_avulsas'
      and policyname = 'user_receitas_avulsas'
  ) then
    create policy "user_receitas_avulsas"
      on public.receitas_avulsas for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

create table if not exists public.objetivos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  descricao text,
  categoria text not null default 'afazeres',
  concluido boolean not null default false,
  criado_em timestamptz not null default now()
);

alter table public.objetivos enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'objetivos'
      and policyname = 'user_objetivos'
  ) then
    create policy "user_objetivos"
      on public.objetivos for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
