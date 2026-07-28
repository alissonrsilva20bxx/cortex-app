-- ============================================================
-- JobApp Rede - Migration 0015: convites via RPC (gerar/resgatar)
-- ============================================================
-- RD-15. O client nunca escreve direto em rede_convites (0005 ja nega
-- INSERT/UPDATE pra "authenticated") -- as duas unicas formas de mexer na
-- tabela sao estas duas funcoes SECURITY DEFINER, cada uma com sua propria
-- checagem de autorizacao.
--
-- rede_gerar_convite: so admin. Recebe o hash ja calculado -- o codigo em
-- texto puro nunca chega ao banco, so ao chamador via HTTP (ver
-- app/api/rede/convites/route.ts, que gera com crypto.randomBytes(32) e
-- hasheia com SHA-256 antes de qualquer coisa) -- e grava com validade de
-- 7 dias.
--
-- rede_resgatar_convite: qualquer autenticado, mas com rate limit
-- persistido nesta tabela (nao em memoria -- um Map em processo nao
-- sobrevive a reinicio nem funciona entre instancias serverless
-- separadas), por usuario E por IP, 5 tentativas / 15 min cada, e resgate
-- atomico via UPDATE ... WHERE usado_por IS NULL AND expira_em > now()
-- RETURNING -- fecha a corrida de duas tentativas simultaneas resgatando
-- o mesmo codigo (RD-19 cobre o teste de concorrencia correspondente).

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table if not exists private.rede_convite_rate_limits (
  chave_hash text primary key,
  janela_inicio timestamptz not null,
  tentativas integer not null default 0
);

revoke all on table private.rede_convite_rate_limits
  from public, anon, authenticated;
grant select, insert, update on table private.rede_convite_rate_limits
  to service_role;
-- Sem grant pra "authenticated" de proposito: as duas funcoes abaixo sao
-- SECURITY DEFINER e leem/escrevem esta tabela com o privilegio de quem as
-- criou, nao do chamador -- o client nunca deveria tocar aqui direto.

create or replace function public.rede_gerar_convite(codigo_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_hash text := codigo_hash;
  convite_id uuid;
  convite_expira_em timestamptz;
begin
  if auth.uid() is null or not public.rede_is_admin() then
    raise exception 'acesso negado'
      using errcode = '42501';
  end if;

  if invite_hash is null or invite_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash de convite invalido'
      using errcode = '22023';
  end if;

  convite_expira_em := pg_catalog.clock_timestamp() + interval '7 days';

  insert into public.rede_convites (codigo_hash, expira_em)
  values (invite_hash, convite_expira_em)
  returning id into convite_id;

  return pg_catalog.jsonb_build_object(
    'id', convite_id,
    'expira_em', convite_expira_em
  );
end;
$$;

revoke all on function public.rede_gerar_convite(text) from public;
grant execute on function public.rede_gerar_convite(text)
  to authenticated, service_role;

create or replace function public.rede_resgatar_convite(codigo_hash text, ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  invite_hash text := codigo_hash;
  request_ip_hash text := ip_hash;
  agora timestamptz := pg_catalog.clock_timestamp();
  janela interval := interval '15 minutes';
  limite integer := 5;
  chaves text[];
  chave text;
  inicio_atual timestamptz;
  tentativas_atuais integer;
  retry_after integer := 0;
  convite_id uuid;
begin
  if caller_id is null then
    raise exception 'nao autenticado'
      using errcode = '42501';
  end if;

  if invite_hash is null
    or invite_hash !~ '^[0-9a-f]{64}$'
    or request_ip_hash is null
    or request_ip_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'parametros invalidos'
      using errcode = '22023';
  end if;

  chaves := array[
    'usuario:' || caller_id::text,
    'ip:' || request_ip_hash
  ];

  -- A chave do usuario e sempre travada primeiro: uma vez limitada, trocar
  -- de IP nao cria linha nova ilimitadamente. Usuarios diferentes nunca
  -- precisam da chave um do outro, entao o lock compartilhado por IP
  -- depois nao pode ciclar.
  foreach chave in array chaves loop
    insert into private.rede_convite_rate_limits (chave_hash, janela_inicio, tentativas)
    values (chave, agora, 0)
    on conflict (chave_hash) do nothing;

    select rate.janela_inicio, rate.tentativas
    into inicio_atual, tentativas_atuais
    from private.rede_convite_rate_limits rate
    where rate.chave_hash = chave
    for update;

    if agora >= inicio_atual + janela then
      update private.rede_convite_rate_limits
      set janela_inicio = agora, tentativas = 0
      where chave_hash = chave;
      inicio_atual := agora;
      tentativas_atuais := 0;
    end if;

    if tentativas_atuais >= limite then
      retry_after := greatest(
        retry_after,
        pg_catalog.ceil(
          extract(epoch from (inicio_atual + janela - agora))
        )::integer
      );
      return pg_catalog.jsonb_build_object(
        'status', 'limitado',
        'retry_after', retry_after
      );
    end if;
  end loop;

  update private.rede_convite_rate_limits
  set tentativas = tentativas + 1
  where chave_hash = any(chaves);

  update public.rede_convites convite
  set usado_por = caller_id,
      usado_em = agora
  where convite.codigo_hash = invite_hash
    and convite.usado_por is null
    and convite.expira_em > agora
  returning convite.id into convite_id;

  if convite_id is null then
    return pg_catalog.jsonb_build_object('status', 'invalido');
  end if;

  return pg_catalog.jsonb_build_object('status', 'resgatado');
end;
$$;

revoke all on function public.rede_resgatar_convite(text, text) from public;
grant execute on function public.rede_resgatar_convite(text, text)
  to authenticated, service_role;
