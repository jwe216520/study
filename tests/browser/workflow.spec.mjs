import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs/promises';
import {validatePdfBytes} from '../../lib/pdf-validation.js';
const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sid='10000000-0000-4000-8000-000000000001',cid='10000000-0000-4000-8000-000000000002',mid='10000000-0000-4000-8000-000000000003',rid='10000000-0000-4000-8000-000000000004';
const nid='10000000-0000-4000-8000-000000000005',fid='10000000-0000-4000-8000-000000000006',qid='10000000-0000-4000-8000-000000000007';
const created_at='2026-10-07T00:00:00Z';
const sources=[{materialId:mid,page:2}];
test('usage monitor works without a scope and distinguishes quota alerts from missing data',async({page})=>{
 const {data}=await mockWorkspace(page);data.scopes=[];
 await page.route('**/api/usage',route=>route.fulfill({json:{checkedAt:new Date().toISOString(),supabase:{status:'ready',metrics:{database:{value:460},storage:{value:.75}},message:'本專案空間統計'},cloudflare:{status:'ready',requests:72000,studyRequests:100,studyErrors:2,errors:3,message:'UTC 今日'}}}));
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');
 await page.getByRole('button',{name:'監視器',exact:true}).click();
 await expect(page.getByRole('heading',{name:'有用量接近免費額度'})).toBeVisible();
 await expect(page.getByText('即將達到額度',{exact:true})).toBeVisible();
 await expect(page.getByText('尚未取得用量，不以 0 顯示。')).toHaveCount(3);
 await expect(page.getByLabel('選擇科目')).toHaveCount(0);
 await page.screenshot({path:'test-results/usage-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await expect(page.getByRole('heading',{name:'監視器',exact:true})).toBeVisible();
  await expect.poll(()=>page.locator('aside.sidebar').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/usage-mobile.png',fullPage:true});
 await page.route('**/api/usage',route=>route.fulfill({status:403,json:{error:'此頁僅供監測管理者查看'}}));
 await page.getByRole('button',{name:'更新用量'}).click();
 await expect(page.getByRole('alert')).toContainText('下方保留上次資料');
  const anonymous=await page.request.get('/api/usage');expect(anonymous.status()).toBe(401);
});
const question={prompt:'這是測試題，請選擇 A。',options:['測試答案 A','測試答案 B','測試答案 C','測試答案 D'],answerIndex:0,explanation:'測試解析：正解為 A。',concepts:['測試概念'],sources};
async function mockWorkspace(page,{loggedIn=true}={}){
 const pdf=await PDFDocument.create();for(let i=0;i<6;i++)pdf.addPage().drawText(`Test page ${i+1}`);const bytes=await pdf.save();
 const data={subjects:[{id:sid,name:'解剖學',created_at}],chapters:[{id:cid,subject_id:sid,name:'測試章節',created_at}],materials:[{id:mid,chapter_id:cid,name:'test-chapter.pdf',storage_path:`${uid}/${mid}.pdf`,bytes:bytes.length,page_count:6,status:'ready',created_at}],scopes:[{id:rid,chapter_id:cid,name:'測試授課範圍',ranges:[{materialId:mid,pageStart:1,pageEnd:4}],teacher_focus:'測試概念',exclusions:'第五頁',revision:1,created_at}],content_items:[{id:nid,scope_id:rid,kind:'note',payload:{title:'測試概念筆記',markdown:'## 概念關係\n測試文字。\n\n<script>window.studyXss = true</script>\n\n![圖片](https://example.com/tracker.png)',supplement:false,concepts:['測試概念'],sources},reviewed:true,reviewed_revision:1,excluded:false,created_at},{id:fid,scope_id:rid,kind:'flashcard',payload:{english:'anatomy',chinese:'解剖學',explanation:'測試單字說明',concepts:['測試概念'],sources},reviewed:true,reviewed_revision:1,excluded:false,created_at},{id:qid,scope_id:rid,kind:'question',payload:question,reviewed:true,reviewed_revision:1,excluded:false,created_at}],card_progress:[],quiz_attempts:[]};
 const calls=[];
 await page.route('https://study-test.supabase.co/**',async route=>{
  const req=route.request(),u=new URL(req.url()),path=u.pathname;let response;
  if(path.includes('/storage/v1/object/sign/')&&req.method()==='POST')return route.fulfill({json:{signedURL:`/object/sign/study-materials/${uid}/${mid}.pdf?token=test`}});
  if(path.includes('/storage/v1/object/sign/')&&req.method()==='GET')return route.fulfill({body:Buffer.from(bytes),contentType:'application/pdf'});
  if(path.includes('/auth/v1/'))return route.fulfill({json:{id:uid,email:'test@example.com',aud:'authenticated',created_at}});
  const table=path.split('/').at(-1);const body=req.postDataJSON();
  if(path.includes('/rpc/')){
   calls.push({name:table,body});
   if(table==='set_card_progress'){data.card_progress=[{item_id:body.p_id,familiarity:body.p_familiarity,updated_at:created_at}];response=null;}
   else if(table==='review_item'){const item=data.content_items.find(i=>i.id===body.p_id);Object.assign(item,{reviewed:!body.p_excluded,excluded:body.p_excluded,reviewed_revision:1});response=null;}
   else if(table==='import_content'){for(const [key,kind] of [['notes','note'],['flashcards','flashcard'],['questions','question']])for(const payload of body.p_payload[key])data.content_items.push({id:crypto.randomUUID(),scope_id:rid,kind,payload,reviewed:false,excluded:false,created_at});response=body.p_batch;}
   else if(table==='start_quiz'){response={id:crypto.randomUUID(),scope_id:rid,scope_revision:1,snapshot:[{questionId:qid,payload:question}],created_at,completed_at:null};data.quiz_attempts.push(response);}
   else if(table==='submit_quiz'){response=data.quiz_attempts.find(a=>a.id===body.p_attempt);const a=body.p_answers[0];Object.assign(response,{score:a.choice===0?1:0,completed_at:created_at,results:[{questionId:qid,payload:question,choice:a.choice,uncertain:a.uncertain,correct:a.choice===0}]});}
   else if(table==='save_item'){response=body.p_id||crypto.randomUUID();const existing=data.content_items.find(i=>i.id===response);if(existing){existing.payload=body.p_payload;existing.reviewed=false;}else data.content_items.push({id:response,kind:body.p_kind,payload:body.p_payload,scope_id:rid,reviewed:false,excluded:false,created_at});}
   else return route.fulfill({status:400,json:{message:`Unexpected RPC ${table}`}});
   return route.fulfill({body:JSON.stringify(response),contentType:'application/json'});
  }
  if(req.method()==='GET'&&data[table])return route.fulfill({json:data[table]});
  if(req.method()==='POST'&&table==='materials'){const row={...body,status:'uploading',created_at};data.materials.push(row);return route.fulfill({json:row});}
  if(req.method()==='PATCH'&&data[table]){const id=u.searchParams.get('id')?.replace('eq.','');const row=data[table].find(r=>r.id===id);Object.assign(row,body);if(table==='scopes'){row.revision++;data.content_items.forEach(i=>i.reviewed=false);}return route.fulfill({json:row});}
  return route.fulfill({status:400,json:{message:'Unexpected request'}});
 });
 if(loggedIn)await page.addInitScript(({uid,created_at})=>{
  const exp=Math.floor(Date.now()/1000)+3600;
  const token=`${btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))}.${btoa(JSON.stringify({sub:uid,exp,role:'authenticated'}))}.test-signature`;
  localStorage.setItem('sb-study-test-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',token_type:'bearer',expires_at:exp,expires_in:3600,user:{id:uid,email:'test@example.com',aud:'authenticated',created_at}}));
 },{uid,created_at});
 return {data,calls};
}
test('valid PDF uploads pass browser inspection and server validation; version navigation needs no scope',async({page})=>{
 const {data}=await mockWorkspace(page);data.scopes=[];
 const doc=await PDFDocument.create();for(let i=0;i<3;i++)doc.addPage();
 const bytes=process.env.STUDY_PDF_FIXTURE?await fs.readFile(process.env.STUDY_PDF_FIXTURE):Buffer.from(await doc.save());
 const expectedPages=(await PDFDocument.load(bytes)).getPageCount();let uploads=0,finalized=0;
 await page.route('**/storage/v1/object/study-materials/**',async route=>{if(route.request().method()==='POST'){uploads++;return route.fulfill({json:{Key:'test'}});}return route.fallback();});
 await page.route('**/api/materials/*/finalize',async route=>{const id=route.request().url().split('/').at(-2),row=data.materials.find(m=>m.id===id);expect(row.page_count).toBe(expectedPages);expect(row.bytes).toBe(bytes.length);await validatePdfBytes(bytes,row.bytes,row.page_count);row.status='ready';finalized++;return route.fulfill({json:{id,status:'ready'}});});
 await page.goto('/');await page.getByRole('button',{name:'教材與範圍',exact:true}).click();
 await page.getByLabel('上傳 PDF',{exact:true}).setInputFiles({name:'valid-chapter.pdf',mimeType:'application/pdf',buffer:bytes});
 await expect(page.getByText('教材已上傳並完成 PDF 驗證',{exact:true})).toBeVisible();
 expect(uploads).toBe(1);expect(finalized).toBe(1);await expect(page.getByRole('heading',{name:'valid-chapter.pdf'})).toBeVisible();
 await page.getByRole('button',{name:'版本紀錄',exact:true}).click();await expect(page.getByRole('heading',{name:'拾知 Study v1.1.0'})).toBeVisible();await expect(page.getByLabel('選擇科目')).toHaveCount(0);
 await page.getByRole('button',{name:'關閉提示',exact:true}).click();await page.screenshot({path:'test-results/versions-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.locator('aside.sidebar').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'test-results/versions-mobile.png',fullPage:true});
});
test('desktop: PDF, safe Markdown, import, flashcard and quiz workflow',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const {data,calls}=await mockWorkspace(page);await page.setViewportSize({width:1440,height:1000});await page.goto('/');
 await expect(page.getByRole('heading',{name:'學習總覽',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/desktop-overview.png',fullPage:true});
 await page.getByRole('button',{name:'概念筆記',exact:true}).click();await expect(page.getByRole('heading',{name:'測試概念筆記'})).toBeVisible();
 expect(await page.evaluate(()=>window.studyXss)).toBeUndefined();await expect(page.locator('.markdown img')).toHaveCount(0);
 await page.getByRole('button',{name:'test-chapter.pdf · PDF p.2'}).click();await expect(page.getByRole('dialog',{name:'教材閱讀器'})).toBeVisible();
 await expect(page.locator('canvas')).toHaveAttribute('width',/^[1-9]\d*$/);await expect(page.getByLabel('PDF 頁碼')).toHaveValue('2');
 await page.getByLabel('PDF 頁碼').fill('3');await expect(page.getByLabel('PDF 頁碼')).toHaveValue('3');await page.getByRole('button',{name:'關閉教材'}).click();
 await page.getByRole('button',{name:'單字卡',exact:true}).click();await expect(page.getByRole('button',{name:'翻轉單字卡'})).toContainText('anatomy');
 await page.getByRole('button',{name:'翻轉單字卡'}).click();await expect(page.getByRole('button',{name:'翻轉單字卡'})).toContainText('解剖學');
 await page.getByRole('button',{name:'已經熟悉'}).click();await expect.poll(()=>data.card_progress[0]?.familiarity).toBe('familiar');
 await page.getByRole('button',{name:'ChatGPT 工作區',exact:true}).click();
 await page.getByRole('button',{name:'檢視提示詞'}).click();await expect(page.getByLabel('ChatGPT 提示詞')).toContainText(mid);
 const raw=page.getByLabel('貼上 ChatGPT 回傳的 JSON');await raw.fill(JSON.stringify({schemaVersion:1,questions:[{...question,sources:[{materialId:mid,page:5}]}]}));
 await page.getByRole('button',{name:'驗證並預覽'}).click();await expect(page.locator('.import-error')).toContainText('不在授課範圍');
 await raw.fill(JSON.stringify({schemaVersion:1,questions:[{...question,prompt:'新匯入測試題'}]}));await page.getByRole('button',{name:'驗證並預覽'}).click();
 await expect(page.getByText('格式及來源範圍檢查通過')).toBeVisible();await page.getByRole('button',{name:'確認匯入 1 筆內容'}).click();
 await expect.poll(()=>data.content_items.length).toBe(4);expect(data.content_items.at(-1).reviewed).toBe(false);
 await page.getByRole('button',{name:'小考與複習',exact:true}).click();await page.getByRole('button',{name:'開始小考',exact:true}).click();
 const quiz=page.getByRole('dialog');await expect(quiz).toContainText('這是測試題');await quiz.getByRole('radio').first().check();
 await quiz.getByRole('button',{name:'交卷並查看解析'}).click();await expect(page.getByRole('dialog',{name:'小考結果與解析'})).toContainText('測試解析');
 expect(data.quiz_attempts[0].score).toBe(1);expect(data.quiz_attempts[0].results[0].uncertain).toBe(true);await page.getByRole('button',{name:'關閉',exact:true}).click();
 await expect(page.locator('.weak-concepts')).toContainText('測試概念');expect(calls.some(c=>c.name==='submit_quiz')).toBe(true);
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'匯出備份'}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toMatch(/學習備份.*\.json/);
 expect(errors).toEqual([]);
});
test('mobile: no horizontal overflow, navigation, manual editing and scope revision',async({page})=>{
 const {data}=await mockWorkspace(page);await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('heading',{name:'學習總覽',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'test-results/mobile-overview.png',fullPage:true});
 await page.getByRole('button',{name:'開啟選單'}).click();await page.getByRole('button',{name:'單字卡',exact:true}).click();
 await page.getByRole('button',{name:'新增單字'}).click();const editor=page.getByRole('dialog');await editor.getByLabel('英文',{exact:true}).fill('posterior');await editor.getByLabel('中文',{exact:true}).fill('後側');await editor.getByRole('button',{name:'保存為待核對'}).click();await expect.poll(()=>data.content_items.length).toBe(4);
 await page.getByRole('button',{name:'管理與核對'}).click();const added=page.locator('.management-card').filter({hasText:'posterior'});await added.getByRole('button',{name:'我已核對',exact:true}).click();await expect.poll(()=>data.content_items.at(-1).reviewed).toBe(true);
 await page.getByRole('button',{name:'開啟選單'}).click();await page.getByRole('button',{name:'教材與範圍',exact:true}).click();await page.getByRole('button',{name:'修改範圍'}).click();await page.getByLabel('老師強調的重點').fill('更新後重點');await page.getByRole('button',{name:'保存範圍'}).click();await expect.poll(()=>data.scopes[0].revision).toBe(2);expect(data.content_items.every(i=>!i.reviewed)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('logged-out welcome, preview and unauthenticated finalize are safe',async({page,request})=>{
 await mockWorkspace(page,{loggedIn:false});await page.goto('/');await expect(page.getByRole('heading',{name:'歡迎回到拾知'})).toBeVisible();await page.getByRole('button',{name:'忘記密碼？'}).click();await expect(page.getByRole('button',{name:'寄送重設連結'})).toBeVisible();
 await page.getByRole('button',{name:'預覽學習空間'}).click();await expect(page.locator('.preview-banner')).toContainText('操作不會保存');
 const response=await request.post(`/api/materials/${mid}/finalize`);expect(response.status()).toBe(401);
});
test('backup preview requires source mapping; invalid PDF uploads are rejected',async({page})=>{
 const {data}=await mockWorkspace(page);await page.goto('/');await expect(page.getByRole('heading',{name:'學習總覽',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'ChatGPT 工作區',exact:true}).click();
 const backup={backupVersion:1,materials:data.materials,learningBatches:[{scopeId:rid,scopeName:'備份範圍',payload:{schemaVersion:1,notes:[],flashcards:[],questions:[question]}}]};
 await page.getByLabel('讀取 JSON',{exact:true}).setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await expect(page.getByRole('dialog',{name:'從備份準備學習內容'})).toBeVisible();await page.getByRole('button',{name:'帶入 JSON，重新驗證'}).click();await page.getByRole('button',{name:'驗證並預覽'}).click();await expect(page.getByText('格式及來源範圍檢查通過')).toBeVisible();
 await page.getByRole('button',{name:'教材與範圍',exact:true}).click();
 await page.getByLabel('上傳 PDF',{exact:true}).setInputFiles({name:'large.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(20*1024*1024+1)});await expect(page.locator('.toast.error')).toContainText('上限為 20 MB');
 await page.getByLabel('上傳 PDF',{exact:true}).setInputFiles({name:'broken.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a pdf')});await expect(page.locator('.toast.error')).toContainText('PDF 結構無法讀取');
});
