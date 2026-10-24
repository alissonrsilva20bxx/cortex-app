-- ============================================================
-- JobApp Jornada — Migration 0047: curtida em dica conta "Sua dica ajudou"
-- ============================================================
-- ESCRITA, NÃO APLICADA. Roda no Supabase SQL Editor quando o dono decidir.
-- Precisa da 0035 (private.jornada_creditar_dica) e da 0009
-- (rede_curtidas). Não depende das outras migrations novas.
--
-- Por quê (item 6 da auditoria de 23/10): a missão de dezembro, março,
-- junho e setembro "Sua dica ajudar 3 vezes" (0036, trinca 3) e o selo
-- "Mão amiga" leem o contador `dica_ajudou`, mas ninguém o escreve. A
-- função private.jornada_creditar_dica (0035) ficou pronta "para o gatilho
-- da futura reação 'Isso me ajudou'", que nunca existiu (e a reação por
-- emoji foi descartada pelo capitão em 20/10). Resultado: a missão fica
-- parada em 0 de 3 o mês inteiro e o capítulo do mês nunca fecha.
--
-- O que faz: a curtida, que já existe na Rede, passa a valer como "Sua
-- dica ajudou alguém" quando o post é da categoria Dica. Um gatilho AFTER
-- INSERT em rede_curtidas chama private.jornada_creditar_dica, que dá o
-- crédito à AUTORA da dica (+5 Glow no Conectar, até 5 por dia, a regra da
-- 0036), sem guardar nada de quem curtiu no contador dela.
--
-- Regras do crédito:
--   - Só post da categoria 'dica'. Outras categorias não mudam nada.
--   - Curtir a própria dica não conta.
--   - Cada pessoa conta UMA vez por dica, para sempre: descurtir e curtir de
--     novo não dá crédito outra vez. Para isso a tabela
--     private.jornada_dica_creditos guarda o par (post, pessoa), sem data;
--     ela some junto com o post ou com a conta (on delete cascade) e
--     nenhum cliente lê (schema private, sem grant, RLS ligada).
--   - Curtidas que já existiam antes de aplicar não contam (sem retroativo:
--     nada de chuva de Glow e comemorações de uma vez).
--   - Se o crédito falhar por qualquer motivo, a curtida grava igual (o
--     erro vira WARNING no log do banco). A Rede nunca quebra por causa da
--     Jornada.
--
-- "Sua dica protegeu" (dica_protegeu) continua sem escritor: não existe
-- nenhuma ação no app que signifique isso, e nenhuma missão ativa (0036) o
-- usa. Fica para o capitão decidir (relatório da tarefa 04 da noite 24/10).
--
-- Sem esta migration o app funciona igual a hoje: curtir grava a curtida e
-- a missão da dica fica parada, como já está. Nenhum código do app muda.
--
-- Como desfazer:
--   drop trigger if exists rede_curtidas_credita_dica on public.rede_curtidas;
--   drop function if exists private.jornada_dica_curtida();
--   drop table if exists private.jornada_dica_creditos;
-- (O Glow já creditado fica com as autoras; o motor não tem "descreditar".)
--
-- Conferência (depois de aplicar), deve voltar 1 linha em cada:
--   select tgname from pg_trigger
--   where tgrelid = 'public.rede_curtidas'::regclass
--     and tgname = 'rede_curtidas_credita_dica';
--   select to_regclass('private.jornada_dica_creditos');
-- Teste: tests/jornada/dica-curtida-0047-pglite.mjs (Postgres em memória).

create table if not exists private.jornada_dica_creditos (
  post_id uuid not null references public.rede_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (post_id, user_id)
);

alter table private.jornada_dica_creditos enable row level security;
revoke all on table private.jornada_dica_creditos
  from public, anon, authenticated, service_role;

-- SECURITY DEFINER: quem curte é outra pessoa (sessão authenticated), e o
-- crédito escreve na Jornada da autora. A função só confia em NEW (a linha
-- que a RLS de rede_curtidas já deixou gravar: post visível, user_id = a
-- própria sessão).
create or replace function private.jornada_dica_curtida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autora uuid;
begin
  select p.autor_id into v_autora
  from public.rede_posts p
  where p.id = new.post_id and p.categoria = 'dica';

  if v_autora is null or v_autora = new.user_id then
    return null;
  end if;

  -- Bloco com exceção: se o crédito falhar, desfaz só o crédito (e o par
  -- em jornada_dica_creditos, para tentar de novo numa próxima curtida) e
  -- a curtida segue.
  begin
    insert into private.jornada_dica_creditos (post_id, user_id)
    values (new.post_id, new.user_id)
    on conflict do nothing;
    if found then
      perform private.jornada_creditar_dica(new.post_id, 'dica_ajudou');
    end if;
  exception when others then
    raise warning 'jornada: crédito da dica % falhou: %', new.post_id, sqlerrm;
  end;

  return null;
end;
$$;

revoke all on function private.jornada_dica_curtida()
  from public, anon, authenticated, service_role;

drop trigger if exists rede_curtidas_credita_dica on public.rede_curtidas;
create trigger rede_curtidas_credita_dica
  after insert on public.rede_curtidas
  for each row execute function private.jornada_dica_curtida();
