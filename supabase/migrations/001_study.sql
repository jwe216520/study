-- Apply once to a new Supabase project. No historical data is deleted.
begin;
create table public.subjects (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id),
 name text not null check(length(trim(name)) between 1 and 100), created_at timestamptz not null default now(), unique(id,owner_id)
);
create table public.chapters (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id),
 subject_id uuid not null, name text not null check(length(trim(name)) between 1 and 100), created_at timestamptz not null default now(), unique(id,owner_id),
 foreign key(subject_id,owner_id) references public.subjects(id,owner_id)
);
create table public.materials (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id), chapter_id uuid not null,
 name text not null check(length(name) between 1 and 250), storage_path text not null unique,
 bytes integer not null check(bytes between 1 and 20971520), page_count integer not null check(page_count > 0),
 status text not null default 'uploading' check(status in ('uploading','ready','delete_pending','deleted')),
 created_at timestamptz not null default now(), unique(id,owner_id),
 foreign key(chapter_id,owner_id) references public.chapters(id,owner_id),
 check(storage_path = owner_id::text || '/' || id::text || '.pdf')
);
create table public.scopes (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id), chapter_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 100), ranges jsonb not null,
 teacher_focus text not null default '' check(length(teacher_focus)<=20000), exclusions text not null default '' check(length(exclusions)<=20000),
 revision integer not null default 1, created_at timestamptz not null default now(), unique(id,owner_id),
 foreign key(chapter_id,owner_id) references public.chapters(id,owner_id)
);
create table public.import_batches (
 id uuid primary key, owner_id uuid not null default auth.uid() references auth.users(id), scope_id uuid not null,
 fingerprint text not null, scope_revision integer not null, created_at timestamptz not null default now(), unique(id,owner_id),
 unique(owner_id,scope_id,scope_revision,fingerprint), foreign key(scope_id,owner_id) references public.scopes(id,owner_id)
);
create table public.content_items (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id), scope_id uuid not null,
 kind text not null check(kind in ('note','flashcard','question')), payload jsonb not null,
 reviewed boolean not null default false, excluded boolean not null default false, reviewed_revision integer,
 batch_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,owner_id),
 foreign key(scope_id,owner_id) references public.scopes(id,owner_id), foreign key(batch_id,owner_id) references public.import_batches(id,owner_id)
);
create table public.card_progress (
 owner_id uuid not null default auth.uid() references auth.users(id), item_id uuid not null,
 familiarity text not null check(familiarity in ('unknown','unclear','familiar')), updated_at timestamptz not null default now(),
 primary key(owner_id,item_id), foreign key(item_id,owner_id) references public.content_items(id,owner_id) on delete cascade
);
create table public.quiz_attempts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id), scope_id uuid not null,
 scope_revision integer not null, snapshot jsonb not null, results jsonb, score integer,
 created_at timestamptz not null default now(), completed_at timestamptz,
 foreign key(scope_id,owner_id) references public.scopes(id,owner_id)
);
create index content_scope on public.content_items(scope_id,kind);
create index quiz_owner on public.quiz_attempts(owner_id,created_at desc);
create index materials_chapter on public.materials(chapter_id);

-- Composite foreign keys prevent attaching one's own records to another owner's parent.
do $$ declare t text; begin
 foreach t in array array['subjects','chapters','materials','scopes','import_batches','content_items','card_progress','quiz_attempts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy own_rows on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
grant insert on public.subjects,public.chapters,public.materials,public.scopes to authenticated;
grant update(name) on public.subjects,public.chapters to authenticated;
grant update(name,ranges,teacher_focus,exclusions) on public.scopes to authenticated;
grant update(status) on public.materials to authenticated;

create function public.validate_scope() returns trigger language plpgsql set search_path = '' as $$
declare r jsonb; m public.materials;
begin
 if jsonb_typeof(new.ranges) is distinct from 'array' or jsonb_array_length(new.ranges) not between 1 and 50 then raise exception '至少設定一段教材頁碼，最多 50 段'; end if;
 for r in select value from jsonb_array_elements(new.ranges) loop
  if jsonb_typeof(r->'materialId') is distinct from 'string' or jsonb_typeof(r->'pageStart') is distinct from 'number' or jsonb_typeof(r->'pageEnd') is distinct from 'number'
   or (r->>'pageStart') !~ '^[0-9]+$' or (r->>'pageEnd') !~ '^[0-9]+$' then raise exception '教材與頁碼格式錯誤'; end if;
  select * into m from public.materials where id=(r->>'materialId')::uuid and owner_id=new.owner_id and chapter_id=new.chapter_id and status='ready';
  if not found or (r->>'pageStart')::int<1 or (r->>'pageEnd')::int<(r->>'pageStart')::int or (r->>'pageEnd')::int>m.page_count then raise exception '教材頁碼範圍無效'; end if;
 end loop;
 if tg_op='UPDATE' then
  if new.ranges is distinct from old.ranges or new.teacher_focus is distinct from old.teacher_focus or new.exclusions is distinct from old.exclusions then new.revision=old.revision+1;
  else new.revision=old.revision; end if;
 else new.revision=1; end if;
 return new;
end $$;
create trigger validate_scope before insert or update on public.scopes for each row execute function public.validate_scope();
create function public.invalidate_reviews() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.revision<>old.revision then update public.content_items set reviewed=false,reviewed_revision=null where scope_id=new.id; end if;
 return new;
end $$;
create trigger invalidate_reviews after update on public.scopes for each row execute function public.invalidate_reviews();

create function public.invalidate_material_reviews() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.status<>old.status and new.status<>'ready' then
  update public.content_items set reviewed=false,reviewed_revision=null
  where owner_id=new.owner_id and exists(select 1 from jsonb_array_elements(payload->'sources') s where s->>'materialId'=new.id::text);
 end if;
 return new;
end $$;
create trigger invalidate_material_reviews after update on public.materials for each row execute function public.invalidate_material_reviews();

-- Server-side validation mirrors the Zod import contract. Browser validation is only UX.
create function public.assert_payload(p_kind text,p_payload jsonb,p_scope uuid,p_owner uuid) returns void language plpgsql set search_path = '' as $$
declare s public.scopes; src jsonb; m public.materials; entry jsonb; supplement boolean; k text;
begin
 select * into s from public.scopes where id=p_scope and owner_id=p_owner;
 if not found then raise exception '找不到可存取的學習範圍'; end if;
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
  select * into m from public.materials where id=(src->>'materialId')::uuid and owner_id=p_owner and chapter_id=s.chapter_id and status='ready';
  if not found or (src->>'page')::int not between 1 and m.page_count then raise exception '來源教材不存在、已刪除或頁碼越界'; end if;
  if not supplement and not exists(select 1 from jsonb_array_elements(s.ranges) r where r->>'materialId'=src->>'materialId' and (src->>'page')::int between (r->>'pageStart')::int and (r->>'pageEnd')::int) then raise exception '來源不在授課範圍'; end if;
 end loop;
end $$;

create function public.import_content(p_scope uuid,p_revision integer,p_batch uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.scopes; k text; kind text; entry jsonb; total integer:=0;
begin
 select * into s from public.scopes where id=p_scope and owner_id=auth.uid() for update;
 if not found then raise exception '無權匯入'; end if;
 if s.revision is distinct from p_revision then raise exception '範圍已變更，請重新預覽'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or p_payload->'schemaVersion' is distinct from '1'::jsonb or length(p_payload::text)>2097152 then raise exception 'JSON 版本或大小無效'; end if;
 for k in select jsonb_object_keys(p_payload) loop
  if k not in ('schemaVersion','notes','flashcards','questions') then raise exception '未知匯入欄位：%',k; end if;
 end loop;
 foreach k in array array['notes','flashcards','questions'] loop
  if jsonb_typeof(coalesce(p_payload->k,'[]'::jsonb)) is distinct from 'array' then raise exception '匯入欄位須為陣列'; end if;
  if jsonb_array_length(coalesce(p_payload->k,'[]'::jsonb))>300 then raise exception '每種內容最多 300 筆'; end if;
  total=total+jsonb_array_length(coalesce(p_payload->k,'[]'::jsonb));
 end loop;
 if total=0 then raise exception '沒有可匯入的內容'; end if;
 -- Uniqueness prevents both replaying a batch ID and replaying identical content.
 insert into public.import_batches(id,owner_id,scope_id,scope_revision,fingerprint) values(p_batch,auth.uid(),p_scope,s.revision,md5(p_payload::text));
 foreach k in array array['notes','flashcards','questions'] loop
  kind=case k when 'notes' then 'note' when 'flashcards' then 'flashcard' else 'question' end;
  for entry in select value from jsonb_array_elements(coalesce(p_payload->k,'[]'::jsonb)) loop
   perform public.assert_payload(kind,entry,p_scope,auth.uid());
   insert into public.content_items(owner_id,scope_id,kind,payload,batch_id) values(auth.uid(),p_scope,kind,entry,p_batch);
  end loop;
 end loop;
 return p_batch;
end $$;

create function public.save_item(p_scope uuid,p_kind text,p_payload jsonb,p_id uuid default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare out_id uuid; existing public.content_items;
begin
 perform 1 from public.scopes where id=p_scope and owner_id=auth.uid() for update;
 if not found then raise exception '無權修改'; end if;
 perform public.assert_payload(p_kind,p_payload,p_scope,auth.uid());
 if p_id is null then
  insert into public.content_items(owner_id,scope_id,kind,payload) values(auth.uid(),p_scope,p_kind,p_payload) returning id into out_id;
 else
  select * into existing from public.content_items where id=p_id and owner_id=auth.uid() and scope_id=p_scope and kind=p_kind for update;
  if not found then raise exception '無權修改內容'; end if;
  update public.content_items set payload=p_payload,reviewed=false,reviewed_revision=null,updated_at=now() where id=p_id returning id into out_id;
 end if;
 return out_id;
end $$;

create function public.review_item(p_id uuid,p_revision integer,p_payload jsonb,p_excluded boolean default false) returns void language plpgsql security definer set search_path = '' as $$
declare i public.content_items; s public.scopes;
begin
 select * into i from public.content_items where id=p_id and owner_id=auth.uid();
 if not found then raise exception '無權核對'; end if;
 select * into s from public.scopes where id=i.scope_id and owner_id=auth.uid() for update;
 select * into i from public.content_items where id=p_id and owner_id=auth.uid() for update;
 if s.revision is distinct from p_revision or i.payload is distinct from p_payload then raise exception '內容或範圍已變更，請重新核對'; end if;
 if not p_excluded then perform public.assert_payload(i.kind,i.payload,i.scope_id,auth.uid()); end if;
 update public.content_items set reviewed=not p_excluded,excluded=p_excluded,reviewed_revision=case when p_excluded then null else s.revision end where id=p_id;
end $$;

create function public.set_card_progress(p_id uuid,p_familiarity text) returns void language plpgsql security definer set search_path = '' as $$
begin
 if p_familiarity not in ('unknown','unclear','familiar') or p_familiarity is null then raise exception '熟悉程度無效'; end if;
 if not exists(select 1 from public.content_items where id=p_id and owner_id=auth.uid() and kind='flashcard' and reviewed and not excluded) then raise exception '單字尚未核對或無權存取'; end if;
 insert into public.card_progress(owner_id,item_id,familiarity) values(auth.uid(),p_id,p_familiarity)
 on conflict(owner_id,item_id) do update set familiarity=excluded.familiarity,updated_at=now();
end $$;

create function public.start_quiz(p_scope uuid,p_count integer default 10,p_weak boolean default false) returns public.quiz_attempts language plpgsql security definer set search_path = '' as $$
declare s public.scopes; snap jsonb; q record; out_attempt public.quiz_attempts;
begin
 if p_count not between 1 and 100 or p_count is null then raise exception '題數須為 1 到 100'; end if;
 select * into s from public.scopes where id=p_scope and owner_id=auth.uid() for update;
 if not found then raise exception '無權測驗'; end if;
 snap='[]'::jsonb;
 for q in select i.id,i.payload from public.content_items i
  where i.scope_id=p_scope and i.owner_id=auth.uid() and i.kind='question' and i.reviewed and not i.excluded and i.reviewed_revision=s.revision
  and (not p_weak or exists(select 1 from public.quiz_attempts a, lateral jsonb_array_elements(a.results) r
    where a.owner_id=auth.uid() and a.scope_id=p_scope and a.completed_at is not null
    and ((r->>'questionId')::uuid=i.id or exists(select 1 from jsonb_array_elements_text(i.payload->'concepts') c where r->'payload'->'concepts' ? c.value))
    and (not (r->>'correct')::boolean or (r->>'uncertain')::boolean)))
  order by random() limit p_count loop
  -- Revalidate source availability when starting: a previously reviewed PDF may be deleted.
  begin
   perform public.assert_payload('question',q.payload,p_scope,auth.uid());
   snap=snap || jsonb_build_array(jsonb_build_object('questionId',q.id,'payload',q.payload));
  exception when others then continue; end;
 end loop;
 if jsonb_array_length(snap)=0 then raise exception '此範圍沒有可用的已核對題目'; end if;
 insert into public.quiz_attempts(owner_id,scope_id,scope_revision,snapshot) values(auth.uid(),p_scope,s.revision,snap) returning * into out_attempt;
 return out_attempt;
end $$;

create function public.submit_quiz(p_attempt uuid,p_answers jsonb) returns public.quiz_attempts language plpgsql security definer set search_path = '' as $$
declare a public.quiz_attempts; q jsonb; ans jsonb; result jsonb:='[]'; n integer; idx integer; correct boolean; points integer:=0;
begin
 select * into a from public.quiz_attempts where id=p_attempt and owner_id=auth.uid() for update;
 if not found then raise exception '無權交卷'; end if;
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

-- Internal validation and triggers must never be callable as public RPCs.
revoke all on function public.assert_payload(text,jsonb,uuid,uuid),public.validate_scope(),public.invalidate_reviews(),public.invalidate_material_reviews() from public,anon,authenticated;
revoke all on function public.import_content(uuid,integer,uuid,jsonb),public.save_item(uuid,text,jsonb,uuid),public.review_item(uuid,integer,jsonb,boolean),public.set_card_progress(uuid,text),public.start_quiz(uuid,integer,boolean),public.submit_quiz(uuid,jsonb) from public,anon;
grant execute on function public.import_content(uuid,integer,uuid,jsonb),public.save_item(uuid,text,jsonb,uuid),public.review_item(uuid,integer,jsonb,boolean),public.set_card_progress(uuid,text),public.start_quiz(uuid,integer,boolean),public.submit_quiz(uuid,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('study-materials','study-materials',false,20971520,array['application/pdf']);
create policy study_pdf_read on storage.objects for select to authenticated using (
 bucket_id='study-materials' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.materials m where m.storage_path=storage.objects.name and m.owner_id=auth.uid() and m.status in ('ready','uploading','delete_pending'))
);
create policy study_pdf_upload on storage.objects for insert to authenticated with check (
 bucket_id='study-materials' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.materials m where m.storage_path=storage.objects.name and m.owner_id=auth.uid() and m.status='uploading')
);
create policy study_pdf_delete on storage.objects for delete to authenticated using (
 bucket_id='study-materials' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.materials m where m.storage_path=storage.objects.name and m.owner_id=auth.uid() and m.status='delete_pending')
);
commit;
