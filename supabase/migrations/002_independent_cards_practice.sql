-- Apply once after 001_study.sql. Keep existing IDs, exclusions, progress and snapshots.
begin;
create table public.flashcard_decks (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id),
 name text not null check(length(trim(name)) between 1 and 100), legacy_scope_id uuid,
 created_at timestamptz not null default now(), unique(id,owner_id), unique(owner_id,legacy_scope_id)
);
create unique index flashcard_default_deck on public.flashcard_decks(owner_id) where legacy_scope_id is null and name='我的單字';
alter table public.flashcard_decks enable row level security;
create policy own_rows on public.flashcard_decks for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
revoke all on public.flashcard_decks from public,anon,authenticated;
grant select,insert on public.flashcard_decks to authenticated;
grant update(name) on public.flashcard_decks to authenticated;
alter table public.content_items alter column scope_id drop not null;
alter table public.content_items add column deck_id uuid;
alter table public.content_items add foreign key(deck_id,owner_id) references public.flashcard_decks(id,owner_id);
insert into public.flashcard_decks(owner_id,name,legacy_scope_id) select distinct s.owner_id,s.name,s.id from public.scopes s join public.content_items i on i.scope_id=s.id where i.kind='flashcard';
update public.content_items i set deck_id=d.id from public.flashcard_decks d where i.kind='flashcard' and i.scope_id=d.legacy_scope_id and i.owner_id=d.owner_id;
alter table public.content_items add constraint content_parent check((kind='flashcard' and deck_id is not null) or (kind<>'flashcard' and scope_id is not null and deck_id is null));
create index content_deck on public.content_items(deck_id) where kind='flashcard';
alter table public.quiz_attempts add column mode text not null default 'exam' check(mode in ('exam','practice'));
alter table public.quiz_attempts add column practice_filter text check(practice_filter in ('all','mistakes'));
drop trigger invalidate_reviews on public.scopes;
drop trigger invalidate_material_reviews on public.materials;
update public.content_items i set reviewed=true,reviewed_revision=s.revision from public.scopes s where s.id=i.scope_id;

create function public.ensure_flashcard_deck(p_scope uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare out_id uuid; deck_name text;
begin
 if auth.uid() is null then raise exception '請先登入'; end if;
 if p_scope is not null then
 select name into deck_name from public.scopes where id=p_scope and owner_id=auth.uid() for update;
 if not found then raise exception '無權存取範圍'; end if;
 else
 perform 1 from auth.users where id=auth.uid() for update; deck_name='我的單字';
 end if;
 select id into out_id from public.flashcard_decks where owner_id=auth.uid() and ((p_scope is not null and legacy_scope_id=p_scope) or (p_scope is null and legacy_scope_id is null and name='我的單字'));
 if out_id is null then insert into public.flashcard_decks(owner_id,name,legacy_scope_id) values(auth.uid(),deck_name,p_scope) returning id into out_id; end if;
 return out_id;
end $$;

create or replace function public.assert_payload(p_kind text,p_payload jsonb,p_scope uuid,p_owner uuid) returns void language plpgsql set search_path = '' as $$
declare s public.scopes; src jsonb; m public.materials; entry jsonb; supplement boolean; k text;
begin
 if p_kind<>'flashcard' then
 select * into s from public.scopes where id=p_scope and owner_id=p_owner;
 if not found then raise exception '找不到可存取的學習範圍'; end if;
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text)>200000 then raise exception '內容格式或大小無效'; end if;
 if p_kind not in ('note','flashcard','question') then raise exception '內容種類無效'; end if;
 for k in select jsonb_object_keys(p_payload) loop
  if not (k=any(case p_kind when 'note' then array['title','markdown','supplement','concepts','sources'] when 'flashcard' then array['english','chinese','explanation','concepts','sources'] else array['prompt','options','answerIndex','explanation','concepts','sources'] end)) then raise exception '未知內容欄位：%',k; end if;
 end loop;
 for k in select unnest(case p_kind when 'note' then array['title','markdown'] when 'flashcard' then array['english','chinese'] else array['prompt','explanation'] end) loop
  if jsonb_typeof(p_payload->k) is distinct from 'string' or length(trim(p_payload->>k)) not between 1 and 20000 then raise exception '文字欄位無效：%',k; end if;
 end loop;
 if p_kind='flashcard' and (length(p_payload->>'english')>300 or jsonb_typeof(p_payload->'explanation') is distinct from 'string' or length(p_payload->>'explanation')>20000) then raise exception '單字格式無效'; end if;
 if jsonb_typeof(p_payload->'concepts') is distinct from 'array' or jsonb_array_length(p_payload->'concepts')>30 then raise exception '概念標籤格式無效'; end if;
 for entry in select value from jsonb_array_elements(p_payload->'concepts') loop
  if jsonb_typeof(entry) is distinct from 'string' or length(trim(entry#>>'{}')) not between 1 and 100 then raise exception '概念標籤格式無效'; end if;
 end loop;
 if p_kind='note' and jsonb_typeof(p_payload->'supplement') is distinct from 'boolean' then raise exception '請指定是否為補充筆記'; end if;
 supplement := p_kind='note' and coalesce((p_payload->>'supplement')::boolean,false);
 if jsonb_typeof(p_payload->'sources') is distinct from 'array' or jsonb_array_length(p_payload->'sources')>100 then raise exception '來源格式無效'; end if;
 if (p_kind='question' or (p_kind='note' and not supplement)) and jsonb_array_length(p_payload->'sources')=0 then raise exception '教材筆記與題目必須附來源'; end if;
 if p_kind='question' then
  if jsonb_typeof(p_payload->'options') is distinct from 'array' or jsonb_array_length(p_payload->'options')<>4 then raise exception '單選題需要四個選項'; end if;
  for entry in select value from jsonb_array_elements(p_payload->'options') loop
   if jsonb_typeof(entry) is distinct from 'string' or length(trim(entry#>>'{}')) not between 1 and 2000 then raise exception '選項不可空白'; end if;
  end loop;
  if (select count(distinct trim(value)) from jsonb_array_elements_text(p_payload->'options'))<>4 then raise exception '選項不可重複'; end if;
  if jsonb_typeof(p_payload->'answerIndex') is distinct from 'number' or (p_payload->>'answerIndex') !~ '^[0-3]$' then raise exception '正解序號須為 0 到 3'; end if;
 end if;
 for src in select value from jsonb_array_elements(p_payload->'sources') loop
  if jsonb_typeof(src) is distinct from 'object' or jsonb_typeof(src->'materialId') is distinct from 'string' or jsonb_typeof(src->'page') is distinct from 'number' or (src->>'page') !~ '^[0-9]+$' then raise exception '來源欄位格式無效'; end if;
  if src ? 'printedPage' and (jsonb_typeof(src->'printedPage') is distinct from 'string' or length(src->>'printedPage')>40) then raise exception '印刷頁碼格式無效'; end if;
  if p_kind='flashcard' then continue; end if;
  select * into m from public.materials where id=(src->>'materialId')::uuid and owner_id=p_owner and chapter_id=s.chapter_id and status='ready';
  if not found or (src->>'page')::int not between 1 and m.page_count then raise exception '來源教材不存在、已刪除或頁碼越界'; end if;
  if not supplement and not exists(select 1 from jsonb_array_elements(s.ranges) r where r->>'materialId'=src->>'materialId' and (src->>'page')::int between (r->>'pageStart')::int and (r->>'pageEnd')::int) then raise exception '來源不在授課範圍'; end if;
 end loop;
end $$;

create or replace function public.import_content(p_scope uuid,p_revision integer,p_batch uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.scopes; k text; kind text; entry jsonb; total integer:=0;
begin
 select * into s from public.scopes where id=p_scope and owner_id=auth.uid() for update;
 if not found then raise exception '無權匯入'; end if;
 if s.revision is distinct from p_revision then raise exception '範圍已變更，請重新預覽'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or (p_payload->'schemaVersion' is distinct from '1'::jsonb and p_payload->'schemaVersion' is distinct from '2'::jsonb) or length(p_payload::text)>2097152 then raise exception 'JSON 版本或大小無效'; end if;
 for k in select jsonb_object_keys(p_payload) loop
  if k not in ('schemaVersion','notes','flashcards','questions') then raise exception '未知匯入欄位：%',k; end if;
 end loop;
 foreach k in array array['notes','flashcards','questions'] loop
  if jsonb_typeof(coalesce(p_payload->k,'[]'::jsonb)) is distinct from 'array' then raise exception '匯入欄位須為陣列'; end if;
  if jsonb_array_length(coalesce(p_payload->k,'[]'::jsonb))>300 then raise exception '每種內容最多 300 筆'; end if;
  total=total+jsonb_array_length(coalesce(p_payload->k,'[]'::jsonb));
 end loop;
 if p_payload->'schemaVersion'='2'::jsonb and jsonb_array_length(coalesce(p_payload->'flashcards','[]'::jsonb))>0 then raise exception '單字請在獨立單字庫新增'; end if;
 if total=0 then raise exception '沒有可匯入的內容'; end if;
 -- Uniqueness prevents both replaying a batch ID and replaying identical content.
 insert into public.import_batches(id,owner_id,scope_id,scope_revision,fingerprint) values(p_batch,auth.uid(),p_scope,s.revision,md5(p_payload::text));
 foreach k in array array['notes','flashcards','questions'] loop
  kind=case k when 'notes' then 'note' when 'flashcards' then 'flashcard' else 'question' end;
  for entry in select value from jsonb_array_elements(coalesce(p_payload->k,'[]'::jsonb)) loop
   perform public.assert_payload(kind,entry,p_scope,auth.uid());
   insert into public.content_items(owner_id,scope_id,deck_id,kind,payload,batch_id,reviewed,reviewed_revision) values(auth.uid(),p_scope,case when kind='flashcard' then public.ensure_flashcard_deck(p_scope) else null end,kind,entry,p_batch,true,s.revision);
  end loop;
 end loop;
 return p_batch;
end $$;

create or replace function public.save_item(p_scope uuid,p_kind text,p_payload jsonb,p_id uuid default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare out_id uuid; existing public.content_items;
begin
 perform 1 from public.scopes where id=p_scope and owner_id=auth.uid() for update;
 if not found then raise exception '無權修改'; end if;
 perform public.assert_payload(p_kind,p_payload,p_scope,auth.uid());
 if p_id is null then
  insert into public.content_items(owner_id,scope_id,deck_id,kind,payload,reviewed,reviewed_revision) values(auth.uid(),p_scope,case when p_kind='flashcard' then public.ensure_flashcard_deck(p_scope) else null end,p_kind,p_payload,true,(select revision from public.scopes where id=p_scope)) returning id into out_id;
 else
  select * into existing from public.content_items where id=p_id and owner_id=auth.uid() and scope_id=p_scope and kind=p_kind for update;
  if not found then raise exception '無權修改內容'; end if;
  update public.content_items set payload=p_payload,reviewed=true,reviewed_revision=(select revision from public.scopes where id=p_scope),updated_at=now() where id=p_id returning id into out_id;
 end if;
 return out_id;
end $$;

create or replace function public.set_card_progress(p_id uuid,p_familiarity text) returns void language plpgsql security definer set search_path = '' as $$
begin
 if p_familiarity not in ('unknown','unclear','familiar') or p_familiarity is null then raise exception '熟悉程度無效'; end if;
 if not exists(select 1 from public.content_items where id=p_id and owner_id=auth.uid() and kind='flashcard' and not excluded) then raise exception '單字已排除或無權存取'; end if;
 insert into public.card_progress(owner_id,item_id,familiarity) values(auth.uid(),p_id,p_familiarity)
 on conflict(owner_id,item_id) do update set familiarity=excluded.familiarity,updated_at=now();
end $$;

create or replace function public.submit_quiz(p_attempt uuid,p_answers jsonb) returns public.quiz_attempts language plpgsql security definer set search_path = '' as $$
declare a public.quiz_attempts; q jsonb; ans jsonb; result jsonb:='[]'; n integer; idx integer; correct boolean; points integer:=0;
begin
 select * into a from public.quiz_attempts where id=p_attempt and owner_id=auth.uid() for update;
 if not found then raise exception '無權交卷'; end if;
 if a.mode<>'exam' then raise exception '逐題練習請逐題保存答案'; end if;
 if a.completed_at is not null then return a; end if;
 if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers)<>jsonb_array_length(a.snapshot) then raise exception '答案數量不符'; end if;
 for n in 0..jsonb_array_length(a.snapshot)-1 loop
  q=a.snapshot->n; ans=p_answers->n;
  if jsonb_typeof(ans) is distinct from 'object' or jsonb_typeof(ans->'uncertain') is distinct from 'boolean' or not (ans ? 'choice') then raise exception '作答格式無效'; end if;
  if ans->'choice'='null'::jsonb then idx=null;
  elsif jsonb_typeof(ans->'choice')='number' and (ans->>'choice')~'^[0-3]$' then idx=(ans->>'choice')::int;
  else raise exception '答案序號無效'; end if;
  correct=coalesce(idx=(q->'payload'->>'answerIndex')::int,false);
  if correct then points=points+1; end if;
  result=result||jsonb_build_array(jsonb_build_object('questionId',q->>'questionId','payload',q->'payload','choice',idx,'uncertain',(ans->>'uncertain')::boolean,'correct',correct));
 end loop;
 update public.quiz_attempts set results=result,score=points,completed_at=now() where id=a.id returning * into a;
 return a;
end $$;
create function public.save_flashcard(p_deck uuid,p_payload jsonb,p_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare out_id uuid; deck uuid;
begin
 deck=coalesce(p_deck,public.ensure_flashcard_deck());
 perform 1 from public.flashcard_decks where id=deck and owner_id=auth.uid() for update;
 if not found then raise exception '無權使用單字集'; end if;
 perform public.assert_payload('flashcard',p_payload,null,auth.uid());
 if p_id is null then
 insert into public.content_items(owner_id,deck_id,kind,payload,reviewed) values(auth.uid(),deck,'flashcard',p_payload,true) returning id into out_id;
 else
 update public.content_items set deck_id=deck,payload=p_payload,reviewed=true,updated_at=now() where id=p_id and owner_id=auth.uid() and kind='flashcard' returning id into out_id;
 if not found then raise exception '無權修改單字'; end if;
 end if;
 return out_id;
end $$;

create function public.set_item_excluded(p_id uuid,p_excluded boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_excluded is null then raise exception '排除狀態無效'; end if;
 update public.content_items set excluded=p_excluded,reviewed=true,updated_at=now() where id=p_id and owner_id=auth.uid();
 if not found then raise exception '無權修改內容'; end if;
end $$;
-- Keep the old client exclusion endpoint compatible after migration.
create or replace function public.review_item(p_id uuid,p_revision integer,p_payload jsonb,p_excluded boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.content_items where id=p_id and owner_id=auth.uid() and payload=p_payload;
 if not found then raise exception '內容已變更或無權存取，請重新整理'; end if;
 perform public.set_item_excluded(p_id,p_excluded);
end $$;

create function public.create_practice_attempt(p_scope uuid,p_count integer,p_mode text,p_filter text) returns public.quiz_attempts language plpgsql security definer set search_path='' as $$
declare s public.scopes; snap jsonb:='[]'; q record; out_attempt public.quiz_attempts;
begin
 if p_count is null or p_count not between 1 and 100 or p_mode not in ('exam','practice') or p_filter not in ('all','mistakes','weak') then raise exception '練習設定無效'; end if;
 select * into s from public.scopes where id=p_scope and owner_id=auth.uid() for update;
 if not found then raise exception '無權測驗'; end if;
 for q in select i.id,i.payload from public.content_items i where i.scope_id=p_scope and i.owner_id=auth.uid() and i.kind='question' and not i.excluded
 and (p_filter='all' or exists(select 1 from public.quiz_attempts a,lateral jsonb_array_elements(a.results) r
 where a.owner_id=auth.uid() and a.scope_id=p_scope and (not (r->>'correct')::boolean or (r->>'uncertain')::boolean)
 and (r->>'questionId'=i.id::text or (p_filter='weak' and exists(select 1 from jsonb_array_elements_text(i.payload->'concepts') c where r->'payload'->'concepts' ? c.value)))))
 order by random() loop
 begin
 perform public.assert_payload('question',q.payload,p_scope,auth.uid());
 snap=snap||jsonb_build_array(jsonb_build_object('questionId',q.id,'payload',q.payload));
 exception when others then continue; end;
 exit when jsonb_array_length(snap)>=p_count;
 end loop;
 if jsonb_array_length(snap)=0 then raise exception '此範圍沒有符合條件的可用題目'; end if;
 insert into public.quiz_attempts(owner_id,scope_id,scope_revision,snapshot,mode,practice_filter,results,score)
 values(auth.uid(),p_scope,s.revision,snap,p_mode,case when p_mode='practice' then p_filter end,case when p_mode='practice' then '[]'::jsonb end,case when p_mode='practice' then 0 end) returning * into out_attempt;
 return out_attempt;
end $$;
create or replace function public.start_quiz(p_scope uuid,p_count integer default 20,p_weak boolean default false) returns public.quiz_attempts language plpgsql security definer set search_path='' as $$
begin return public.create_practice_attempt(p_scope,p_count,'exam',case when p_weak then 'weak' else 'all' end); end $$;
create function public.start_practice(p_scope uuid,p_count integer default 20,p_filter text default 'all') returns public.quiz_attempts language plpgsql security definer set search_path='' as $$
begin
 if p_filter is null or p_filter not in ('all','mistakes') then raise exception '練習模式無效'; end if;
 return public.create_practice_attempt(p_scope,p_count,'practice',p_filter);
end $$;
create function public.submit_practice_answer(p_attempt uuid,p_index integer,p_choice integer,p_uncertain boolean) returns public.quiz_attempts language plpgsql security definer set search_path='' as $$
declare a public.quiz_attempts; q jsonb; r jsonb; n integer; correct boolean;
begin
 select * into a from public.quiz_attempts where id=p_attempt and owner_id=auth.uid() for update;
 if not found or a.mode<>'practice' then raise exception '無權提交練習'; end if;
 n=jsonb_array_length(a.results);
 if p_index is null or p_index<0 or p_index>=jsonb_array_length(a.snapshot) then raise exception '題目序號無效'; end if;
 if p_index<n then return a; end if; -- Idempotent retry never overwrites a confirmed answer.
 if p_index<>n or p_choice is null or p_choice not between 0 and 3 or p_uncertain is null then raise exception '請依序提交有效答案'; end if;
 q=a.snapshot->p_index; correct=p_choice=(q->'payload'->>'answerIndex')::int;
 r=jsonb_build_object('questionId',q->>'questionId','payload',q->'payload','choice',p_choice,'uncertain',p_uncertain,'correct',correct);
 update public.quiz_attempts set results=results||jsonb_build_array(r),score=score+case when correct then 1 else 0 end,completed_at=case when n+1=jsonb_array_length(snapshot) then now() end where id=a.id returning * into a;
 return a;
end $$;

-- Restore a deck transactionally. Original IDs make repeated restores idempotent.
create function public.restore_flashcards(p_name text,p_cards jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare deck uuid; entry jsonb; cid uuid; existing public.content_items; payload jsonb; familiarity text;
begin
 if p_name is null or length(trim(p_name)) not between 1 and 100 or jsonb_typeof(p_cards) is distinct from 'array' or jsonb_array_length(p_cards) not between 1 and 300 or length(p_cards::text)>2097152 then raise exception '備份格式或大小無效'; end if;
 perform 1 from auth.users where id=auth.uid() for update;
 if not found then raise exception '請先登入'; end if;
 select id into deck from public.flashcard_decks where owner_id=auth.uid() and name=p_name order by created_at limit 1;
 if deck is null then insert into public.flashcard_decks(owner_id,name) values(auth.uid(),p_name) returning id into deck; end if;
 for entry in select value from jsonb_array_elements(p_cards) loop
 cid=(entry->>'id')::uuid; if cid is null then raise exception '備份缺少單字代號'; end if;
 payload=entry->'payload'; perform public.assert_payload('flashcard',payload,null,auth.uid());
 select * into existing from public.content_items where id=cid;
 if found then
 if existing.owner_id<>auth.uid() or existing.kind<>'flashcard' then raise exception '單字代號已被使用'; end if;
 continue; -- Never overwrite existing user edits or familiarity.
 end if;
 insert into public.content_items(id,owner_id,deck_id,kind,payload,excluded,reviewed) values(cid,auth.uid(),deck,'flashcard',payload,coalesce((entry->>'excluded')::boolean,false),true);
 familiarity=entry->>'familiarity';
 if familiarity is not null then
 if familiarity not in ('unknown','unclear','familiar') then raise exception '熟悉程度無效'; end if;
 insert into public.card_progress(owner_id,item_id,familiarity) values(auth.uid(),cid,familiarity);
 end if;
 end loop;
 return deck;
end $$;
revoke all on function public.ensure_flashcard_deck(uuid),public.create_practice_attempt(uuid,integer,text,text) from public,anon,authenticated;
revoke all on function public.save_flashcard(uuid,jsonb,uuid),public.set_item_excluded(uuid,boolean),public.start_practice(uuid,integer,text),public.submit_practice_answer(uuid,integer,integer,boolean),public.restore_flashcards(text,jsonb) from public,anon;
grant execute on function public.save_flashcard(uuid,jsonb,uuid),public.set_item_excluded(uuid,boolean),public.start_practice(uuid,integer,text),public.submit_practice_answer(uuid,integer,integer,boolean),public.restore_flashcards(text,jsonb) to authenticated;
-- Existing RPC privileges are retained by CREATE OR REPLACE; validation stays internal.
notify pgrst, 'reload schema';
commit;
