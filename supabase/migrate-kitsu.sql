-- Migração OTAKU LEVEL para Kitsu.
-- Execute uma vez no SQL Editor do Supabase, após a Fase 2 já existir.
-- Não apaga, recria nem atualiza linhas: somente substitui duas constraints.
-- IDs MAL existentes continuam positivos; novos IDs Kitsu são armazenados como negativos.

begin;

alter table public.library_entries
  drop constraint if exists library_entries_mal_id_check;
alter table public.library_entries
  add constraint library_entries_mal_id_check check (mal_id <> 0);

alter table public.library_entries
  drop constraint if exists library_entries_image_url_check;
alter table public.library_entries
  add constraint library_entries_image_url_check
  check (image_url is null or image_url ~ '^https://(cdn\.myanimelist\.net|media\.kitsu\.(app|io))/');

commit;
