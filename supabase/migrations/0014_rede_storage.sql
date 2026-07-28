-- ============================================================
-- JobApp Rede - Migration 0014: Storage (bucket rede-midia)
-- ============================================================
-- Executado a pedido explicito do produto (fora do fluxo normal de espera
-- por aprovacao registrado em BACKEND_TICKETS.md -- RD-08 estava marcado
-- "fora do MVP -- proposta").
--
-- Diferente do bucket "cofre" (0001_jobapp_schema.sql), que e 100% privado
-- por dono e so serve via signed URL, "rede-midia" existe pra imagem de
-- post/perfil que outros membros da Rede precisam ver -- entao a leitura e
-- aberta a qualquer membro autenticado, nao so ao dono. Ver
-- docs/rede/SUPABASE_MIGRATION_PLAN.md secao 5.
--
-- Convencao de path (mesmo padrao do cofre, primeiro segmento = dono):
--   {user_id}/posts/{post_id}/{filename}
--   {user_id}/perfil/{filename}
-- A policy so olha o primeiro segmento -- nao precisa hardcodar "posts" ou
-- "perfil", os dois casos de uso compartilham a mesma regra de dono.
--
-- Limite de tamanho/formato: SUPABASE_MIGRATION_PLAN.md secao 5 deixava
-- isso como "a decidir (produto)", com sugestao de 10 MB por analogia ao
-- cofre. Aplicado aqui como default explicito (nao "sem limite nenhum"),
-- porque bucket sem file_size_limit e sem allowed_mime_types e risco de
-- custo/abuso desde o primeiro upload -- se o produto quiser outro valor,
-- e um UPDATE em storage.buckets, nao uma migration nova.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'rede-midia',
    'rede-midia',
    false,
    10485760, -- 10 MB, mesmo teto sugerido para o cofre (docs/adr/0002)
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
  on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'rede-midia: owner insert'
  ) then
    create policy "rede-midia: owner insert"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'rede-midia'
        and public.rede_is_member()
        and auth.uid()::text = (string_to_array(name, '/'))[1]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'rede-midia: member select'
  ) then
    create policy "rede-midia: member select"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'rede-midia'
        and public.rede_is_member()
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'rede-midia: owner update'
  ) then
    create policy "rede-midia: owner update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'rede-midia'
        and auth.uid()::text = (string_to_array(name, '/'))[1]
      )
      with check (
        bucket_id = 'rede-midia'
        and auth.uid()::text = (string_to_array(name, '/'))[1]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'rede-midia: owner delete'
  ) then
    create policy "rede-midia: owner delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'rede-midia'
        and auth.uid()::text = (string_to_array(name, '/'))[1]
      );
  end if;
end
$$;
