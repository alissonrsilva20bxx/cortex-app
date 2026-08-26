-- ============================================================
-- JobApp Rede - Migration 0026: foto de perfil (avatar)
-- ============================================================
-- Bucket público (diferente do "cofre", que é privado): o avatar precisa
-- ser visível por qualquer membra que veja o perfil/feed/chat de outra
-- pessoa, não só pelo dono. Escrita continua restrita ao dono, mesmo
-- padrão de path {user_id}/{filename} do cofre (0001).

alter table public.rede_perfis
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
  values ('avatares', 'avatares', true)
  on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatares: public read'
  ) then
    create policy "avatares: public read"
      on storage.objects for select
      using (bucket_id = 'avatares');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatares: owner write'
  ) then
    create policy "avatares: owner write"
      on storage.objects for insert
      with check (
        bucket_id = 'avatares'
        and auth.uid()::text = (string_to_array(name, '/'))[1]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatares: owner update'
  ) then
    create policy "avatares: owner update"
      on storage.objects for update
      using (
        bucket_id = 'avatares'
        and auth.uid()::text = (string_to_array(name, '/'))[1]
      )
      with check (
        bucket_id = 'avatares'
        and auth.uid()::text = (string_to_array(name, '/'))[1]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatares: owner delete'
  ) then
    create policy "avatares: owner delete"
      on storage.objects for delete
      using (
        bucket_id = 'avatares'
        and auth.uid()::text = (string_to_array(name, '/'))[1]
      );
  end if;
end
$$;
