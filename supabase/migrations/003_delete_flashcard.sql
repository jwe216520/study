begin;

-- Delete only the authenticated owner's flashcard. Progress cascades through
-- the existing foreign key; decks and quiz history are deliberately retained.
create function public.delete_flashcard(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare item public.content_items;
begin
 if auth.uid() is null then raise exception '請先登入'; end if;
 if p_id is null then raise exception '單字卡代號不可為空'; end if;
 select * into item from public.content_items where id=p_id for update;
 if not found then return; end if; -- Safe retry after a successful deletion.
 if item.owner_id <> auth.uid() or item.kind <> 'flashcard' then
  raise exception '無法刪除這張單字卡';
 end if;
 delete from public.content_items where id=p_id and owner_id=auth.uid() and kind='flashcard';
end $$;
revoke all on function public.delete_flashcard(uuid) from public,anon;
grant execute on function public.delete_flashcard(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
