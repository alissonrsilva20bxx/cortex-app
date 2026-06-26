-- ============================================================
-- JobApp — Migration 0001: Schema inicial
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

create type job_status   as enum ('agendado', 'confirmado', 'concluído', 'cancelado');
create type modalidade   as enum ('presencial', 'online');
create type periodo_meta as enum ('dia', 'mes', 'ano');
create type tema         as enum ('pink-neon', 'purple', 'crimson');

-- ── Função utilitária: atualiza atualizado_em ─────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- ── Tabela: jobs ─────────────────────────────────────────────

create table jobs (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  cliente_nome  text        not null,
  data          date        not null,
  hora          time        not null,
  valor         numeric(10,2) not null check (valor >= 0),
  modalidade    modalidade  not null,
  local         text,
  status        job_status  not null default 'agendado',
  observacoes   text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index jobs_user_data_idx on jobs (user_id, data);

create trigger jobs_updated_at
  before update on jobs
  for each row execute function set_updated_at();

alter table jobs enable row level security;

create policy "jobs: owner full access"
  on jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Tabela: metas ────────────────────────────────────────────

create table metas (
  id          uuid          primary key default gen_random_uuid(),
  user_id     uuid          not null references auth.users(id) on delete cascade,
  periodo     periodo_meta  not null,
  valor_alvo  numeric(10,2) not null check (valor_alvo >= 0),
  unique (user_id, periodo)
);

alter table metas enable row level security;

create policy "metas: owner full access"
  on metas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Tabela: notas ────────────────────────────────────────────

create table notas (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  conteudo      text        not null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger notas_updated_at
  before update on notas
  for each row execute function set_updated_at();

alter table notas enable row level security;

create policy "notas: owner full access"
  on notas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Tabela: configuracoes ────────────────────────────────────

create table configuracoes (
  user_id   uuid  primary key references auth.users(id) on delete cascade,
  tema      tema  not null default 'pink-neon',
  pin_hash  text
);

alter table configuracoes enable row level security;

create policy "configuracoes: owner full access"
  on configuracoes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Trigger: seed ao criar usuário ───────────────────────────

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into metas (user_id, periodo, valor_alvo) values
    (new.id, 'dia',  300),
    (new.id, 'mes',  3000),
    (new.id, 'ano',  36000);

  insert into configuracoes (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Storage: bucket cofre (privado) ──────────────────────────
-- Estrutura de paths: {user_id}/{categoria}/{filename}
-- Categorias: comprovantes | conversas | documentos | pessoal

insert into storage.buckets (id, name, public)
  values ('cofre', 'cofre', false)
  on conflict (id) do nothing;

create policy "cofre: owner full access"
  on storage.objects for all
  using (
    bucket_id = 'cofre'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  )
  with check (
    bucket_id = 'cofre'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );
