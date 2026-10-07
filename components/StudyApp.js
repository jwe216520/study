'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { BookOpen, LayoutDashboard, Files, NotebookPen, Layers, ClipboardCheck, Sparkles, Download, LogOut, Menu, X, ArrowUpRight, ChevronRight, Leaf, ShieldCheck, CircleHelp, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { configured, getSupabase } from '@/lib/supabase';
import { loadWorkspace, insertRow, downloadJson, exportStudy } from '@/lib/repository';
import { previewData } from '@/lib/preview';
import { weakConcepts } from '@/lib/content';
import { Modal, Field, Empty } from './ui';
import { MaterialsPanel, NotesPanel, ImportPanel } from './WorkspacePanels';
import { CardsPanel, QuizPanel } from './PracticePanels';
const PdfViewer = dynamic(() => import('./PdfViewer'), { ssr: false });
const nav = [{ id:'overview',label:'學習總覽',icon:LayoutDashboard },{id:'materials',label:'教材與範圍',icon:Files},{id:'notes',label:'概念筆記',icon:NotebookPen},{id:'cards',label:'單字卡',icon:Layers},{id:'quiz',label:'小考與複習',icon:ClipboardCheck},{id:'import',label:'ChatGPT 工作區',icon:Sparkles}];
const blank = {subjects:[],chapters:[],materials:[],scopes:[],content_items:[],card_progress:[],quiz_attempts:[]};

export default function StudyApp() {
 const [session,setSession]=useState(null); const [authReady,setAuthReady]=useState(!configured);
 const [preview,setPreview]=useState(false); const [data,setData]=useState(blank); const [tab,setTab]=useState('overview');
 const [subjectId,setSubjectId]=useState(''); const [chapterId,setChapterId]=useState(''); const [scopeId,setScopeId]=useState('');
 const [busy,setBusy]=useState(false); const [loading,setLoading]=useState(false); const [notice,setNotice]=useState(null);
 const [menu,setMenu]=useState(false); const [newEntity,setNewEntity]=useState(null); const [pdf,setPdf]=useState(null);
 const [recovery,setRecovery]=useState(false);
 const latestUser=useRef(null);
 const notify=useCallback((message,error=false)=>setNotice({message,error}),[]);
 useEffect(()=>{
  if (!configured) return;
  const db=getSupabase(); let alive=true;
  const acceptSession=s=>{if(latestUser.current!==s?.user.id){setData(blank);setPdf(null);setNewEntity(null);setSubjectId('');setChapterId('');setScopeId('');}latestUser.current=s?.user.id||null;setSession(s);setAuthReady(true);};
  db.auth.getSession().then(({data,error})=>{if(alive){acceptSession(data.session);if(error)notify(error.message,true);}});
  const {data:listener}=db.auth.onAuthStateChange((event,s)=>{acceptSession(s);if(event==='PASSWORD_RECOVERY')setRecovery(true);if(event==='SIGNED_OUT')setRecovery(false);});
  return ()=>{alive=false;listener.subscription.unsubscribe();};
 },[notify]);
 const refresh=useCallback(async()=>{
  if(!session)return;
  const requestedUser=session.user.id;
  const workspace=await loadWorkspace();if(latestUser.current===requestedUser)setData(workspace);
 },[session]);
 useEffect(()=>{
  if(!session)return;
  let alive=true;setLoading(true);
  loadWorkspace().then(v=>{if(alive)setData(v);}).catch(e=>{if(alive)notify(`讀取資料失敗：${e.message}`,true);}).finally(()=>{if(alive)setLoading(false);});
  return ()=>{alive=false;};
 },[session,notify]);
 useEffect(()=>{
  if(!session||busy)return;
  const sync=()=>{if(document.visibilityState==='visible')refresh().catch(e=>notify(`同步失敗：${e.message}`,true));};
  window.addEventListener('focus',sync);const timer=setInterval(sync,60000);
  return ()=>{window.removeEventListener('focus',sync);clearInterval(timer);};
 },[session,busy,refresh,notify]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(null),notice.error?18000:7000);return ()=>clearTimeout(t);},[notice]);
 async function action(fn,message='已保存') {
  if(preview){notify('目前是唯讀介面預覽。完成 Supabase 設定並登入後即可保存。',true);return undefined;}
  setBusy(true);
  try {const result=await fn();notify(message);try{await refresh();}catch(e){notify(`操作已保存，但重新讀取失敗：${e.message}。請重新整理。`,true);}return {result};}
  catch(e){notify(e.message,true);return undefined;}finally{setBusy(false);}
 }
 function enterPreview(){setPreview(true);setData(previewData);setNotice(null);}
 const subjects=data.subjects;
 const subject=subjects.find(s=>s.id===subjectId)||subjects[0];
 const chapters=data.chapters.filter(c=>c.subject_id===subject?.id);
 const chapter=chapters.find(c=>c.id===chapterId)||chapters[0];
 const scopes=data.scopes.filter(s=>s.chapter_id===chapter?.id);
 const scope=scopes.find(s=>s.id===scopeId)||scopes[0];
 const materials=data.materials.filter(m=>m.chapter_id===chapter?.id);
 const items=data.content_items.filter(i=>i.scope_id===scope?.id);
 const attempts=data.quiz_attempts.filter(a=>a.scope_id===scope?.id);
 const shared={data,scope,chapter,materials,items,attempts,busy,preview,action,notify,onOpen:(material,page=1)=>setPdf({material,page}),refresh};

 if(!authReady)return <div className="boot">正在開啟你的學習空間…</div>;
 if(!session&&!preview)return <Welcome configured={configured} onPreview={enterPreview} notify={notify}/>;
 return <div className="app-shell">
  <aside className={`sidebar ${menu?'open':''}`}><a className="brand" href="#" onClick={e=>{e.preventDefault();setTab('overview');}}><span className="brand-mark"><BookOpen size={23}/></span><span>拾知<span className="brand-en">STUDY SPACE</span></span></a><button className="mobile-close icon-button" aria-label="關閉選單" onClick={()=>setMenu(false)}><X size={20}/></button>
   <div className="sidebar-label">我的學習空間</div><nav>{nav.map(n=><button key={n.id} className={`nav-item ${tab===n.id?'active':''}`} onClick={()=>{setTab(n.id);setMenu(false);}}><n.icon size={19}/>{n.label}{n.id==='import'&&<span className="nav-dot"/>}</button>)}</nav>
   <div className="sidebar-tip"><Leaf size={23}/><strong>一點一滴，理解更深。</strong><p>不急著記住所有答案，<br/>先讓每個概念連起來。</p></div>
   <div className="sidebar-bottom"><span className="avatar">{preview?'示':'我'}</span><div><strong>{preview?'介面預覽':'我的私人帳號'}</strong><small>{preview?'範例內容 · 不會保存':session.user.email}</small></div><button className="icon-button" title={preview?'離開預覽':'登出'} aria-label={preview?'離開預覽':'登出'} onClick={async()=>{if(preview){setPreview(false);setData(blank);}else{const {error}=await getSupabase().auth.signOut();if(error)notify(error.message,true);}}}><LogOut size={17}/></button></div>
  </aside>{menu&&<div className="sidebar-overlay" onClick={()=>setMenu(false)}/>}
  <div className="main-shell"><header className="topbar"><button className="mobile-menu icon-button" aria-label="開啟選單" onClick={()=>setMenu(true)}><Menu size={22}/></button><div className="breadcrumb">我的學習空間 <ChevronRight size={13}/><strong>{nav.find(n=>n.id===tab)?.label}</strong></div><div className="topbar-actions"><span className="private-label"><ShieldCheck size={15}/>私人空間</span><button className="icon-button" title="重新同步" aria-label="重新同步" disabled={busy||preview} onClick={()=>action(async()=>{},'已重新同步')}><RefreshCw size={17} className={busy?'spin':''}/></button><button className="button ghost" onClick={()=>{downloadJson(`拾知-學習備份-${new Date().toISOString().slice(0,10)}.json`,exportStudy(data));notify('已匯出學習資料。PDF 原檔請到教材頁個別下載。');}}><Download size={16}/><span>匯出備份</span></button></div></header>
   {preview&&<div className="preview-banner"><CircleHelp size={16}/>介面預覽：範例內容不代表授課範圍，操作不會保存。<button onClick={()=>{setPreview(false);setData(blank);}}>返回登入與設定</button></div>}
   <main><div className="page-heading"><div><span className="eyebrow">LEARN WITH INTENTION</span><h1>{nav.find(n=>n.id===tab)?.label}</h1><p>{({overview:'從理解開始，讓每一次複習都有方向。',materials:'保留教材來源，清楚界定老師正在教的範圍。',notes:'把位置、功能與構造關係，整理成自己的理解。',cards:'先試著回想，再翻面確認。',quiz:'用小考找出需要再理解一次的地方。',import:'在自己的 ChatGPT 整理教材，再把成果帶回來。'})[tab]}</p></div><span className="heading-icon"><BookOpen size={29}/></span></div>
    <div className="context-bar"><Field label="科目"><select aria-label="選擇科目" value={subject?.id||''} onChange={e=>{setSubjectId(e.target.value);setChapterId('');setScopeId('');}}><option value="" disabled>先建立科目</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><button className="small-add" onClick={()=>setNewEntity('subject')}>＋科目</button><Field label="章節"><select aria-label="選擇章節" value={chapter?.id||''} onChange={e=>{setChapterId(e.target.value);setScopeId('');}}><option value="" disabled>先建立章節</option>{chapters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><button className="small-add" disabled={!subject} onClick={()=>setNewEntity('chapter')}>＋章節</button><Field label="學習範圍"><select aria-label="選擇學習範圍" value={scope?.id||''} onChange={e=>setScopeId(e.target.value)}><option value="" disabled>到教材頁建立範圍</option>{scopes.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field></div>
    {loading?<div className="panel empty">正在同步學習資料…</div>:tab==='overview'?<Overview {...shared} setTab={setTab} subjects={subjects} setNewEntity={setNewEntity}/>:tab==='materials'?<MaterialsPanel {...shared} userId={session?.user.id}/>:!scope?<div className="panel"><Empty title="先設定這次的學習範圍">上傳章節 PDF 並指定老師教到的頁碼，就可以開始整理筆記與題目。</Empty><div className="center"><button className="button primary" onClick={()=>setTab('materials')}>前往教材與範圍<ArrowUpRight size={16}/></button></div></div>:tab==='notes'?<NotesPanel key={scope.id} {...shared}/>:tab==='cards'?<CardsPanel key={scope.id} {...shared}/>:tab==='quiz'?<QuizPanel key={scope.id} {...shared}/>:<ImportPanel key={`${scope.id}-${scope.revision}`} {...shared}/>}
    <footer className="page-footer"><span>拾知 Study · 為每一個理解留下足跡</span><span>學習內容請以教材及老師說明核對</span></footer>
   </main>
  </div>
  {notice&&<div className={`toast ${notice.error?'error':''}`} role={notice.error?'alert':'status'}>{notice.error?<AlertCircle size={18}/>:<Check size={18}/>}<span>{notice.message}</span><button className="icon-button" aria-label="關閉提示" onClick={()=>setNotice(null)}><X size={15}/></button></div>}
  {newEntity&&<EntityModal kind={newEntity} busy={busy} onClose={()=>setNewEntity(null)} onSave={async name=>{const result=await action(()=>insertRow(newEntity==='subject'?'subjects':'chapters',newEntity==='subject'?{name}:{name,subject_id:subject.id}));if(result){if(newEntity==='subject')setSubjectId(result.result.id);else setChapterId(result.result.id);setScopeId('');setNewEntity(null);}}}/>}
  {pdf&&<PdfViewer material={pdf.material} initialPage={pdf.page} onClose={()=>setPdf(null)}/>}
  {recovery&&<RecoveryModal notify={notify} onClose={()=>setRecovery(false)}/>}
 </div>;
}

function Welcome({configured,onPreview}) {
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [pending,setPending]=useState(false);const [forgot,setForgot]=useState(false);const [message,setMessage]=useState('');
 async function submit(e){e.preventDefault();setPending(true);setMessage('');try{const db=getSupabase();if(forgot){const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/`});if(error)throw error;setMessage('若帳號存在，將寄送密碼重設連結，請查看信箱。');}else{const {error}=await db.auth.signInWithPassword({email,password});if(error)throw error;}}catch(e){setMessage(e.message==='Invalid login credentials'?'Email 或密碼不正確。':e.message);}finally{setPending(false);}}
 return <div className="welcome"><section className="welcome-story"><div className="brand"><span className="brand-mark"><BookOpen size={24}/></span><span>拾知<span className="brand-en">STUDY SPACE</span></span></div><span className="eyebrow">YOUR PERSONAL LEARNING COMPANION</span><h1>把知識拾起，<br/>讓理解<span>慢慢成形。</span></h1><p>為你的護理學習，留一個專屬空間。<br/>從章節筆記到單字與小考，<br/>讓每一次複習都更有方向。</p><div className="welcome-steps"><span><Files size={18}/>教材與範圍</span><ChevronRight size={14}/><span><NotebookPen size={18}/>概念理解</span><ChevronRight size={14}/><span><ClipboardCheck size={18}/>主動複習</span></div><div className="welcome-art"><div className="art-orbit"/><div className="art-card"><span className="art-label">TODAYS SMALL STEP</span><BookOpen size={42}/><h3>理解一個概念，<br/>就是一次進步。</h3><div className="art-lines"><i/><i/><i/></div></div><span className="art-leaf"><Leaf size={36}/></span></div></section><section className="welcome-login"><span className="badge"><ShieldCheck size={14}/>僅供自己使用的私人空間</span><h2>{configured?'歡迎回到拾知':'準備你的學習空間'}</h2><p className="muted">{configured?'登入後接續你的章節、單字與複習紀錄。':'網站已準備好。連接 Supabase 後，就能保存教材並在手機與電腦同步。'}</p>{configured?<form onSubmit={submit}><Field label="Email"><input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="你的 Email"/></Field>{!forgot&&<Field label="密碼"><input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="輸入密碼"/></Field>}<button className="button primary full" disabled={pending}>{pending?'處理中…':forgot?'寄送重設連結':'登入學習空間'}<ArrowUpRight size={17}/></button><button type="button" className="text-button" onClick={()=>{setForgot(!forgot);setMessage('');}}>{forgot?'返回登入':'忘記密碼？'}</button>{message&&<p className="form-message" role="status">{message}</p>}</form>:<div className="setup-steps"><p><span>01</span>建立 Supabase 專案並執行資料庫 migration</p><p><span>02</span>在後台建立帳號、關閉公開註冊</p><p><span>03</span>填入 .env.local 並重新啟動網站</p><small>完整步驟請參閱專案 README.md。<br/>網站不會要求你的 ChatGPT 密碼或 API 金鑰。</small></div>}<div className="welcome-divider"><span>先看看學習方式</span></div><button className="button secondary full" onClick={onPreview}>預覽學習空間<ArrowUpRight size={17}/></button><p className="login-foot">範例預覽不會讀取或保存私人教材。<br/>登入帳號由你在 Supabase 後台建立。</p></section></div>;
}

function EntityModal({kind,onSave,onClose,busy}){const [name,setName]=useState(kind==='subject'?'解剖學':'');return <Modal title={kind==='subject'?'新增科目':'新增章節'} onClose={onClose}><form onSubmit={e=>{e.preventDefault();onSave(name.trim());}}><Field label="名稱"><input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder={kind==='subject'?'例如：解剖學':'例如：骨骼系統'}/></Field><div className="form-actions"><button className="button secondary" type="button" onClick={onClose}>取消</button><button className="button primary" disabled={busy}>建立</button></div></form></Modal>;}
function RecoveryModal({onClose,notify}){const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [pending,setPending]=useState(false);return <Modal title="重設密碼" onClose={onClose}><form onSubmit={async e=>{e.preventDefault();if(password!==confirm){notify('兩次密碼不同',true);return;}setPending(true);const {error}=await getSupabase().auth.updateUser({password});setPending(false);if(error)notify(error.message,true);else{notify('密碼已更新');onClose();}}}><Field label="新密碼（至少 12 字元）"><input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)}/></Field><Field label="再次輸入新密碼"><input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></Field><button className="button primary full" disabled={pending}>更新密碼</button></form></Modal>;}

function Overview({scope,items,attempts,materials,setTab,subjects,setNewEntity,preview}){
 const notes=items.filter(i=>i.kind==='note'&&i.reviewed&&!i.excluded);const cards=items.filter(i=>i.kind==='flashcard'&&i.reviewed&&!i.excluded);const questions=items.filter(i=>i.kind==='question'&&i.reviewed&&!i.excluded);const drafts=items.filter(i=>!i.reviewed&&!i.excluded);const weak=weakConcepts(attempts);const completed=attempts.filter(a=>a.completed_at);const latest=completed.at(-1);
 return <><section className="hero-panel"><div className="hero-copy"><span className="badge light"><Leaf size={13}/>今天，也往前一小步</span><h2>{scope?'讓學過的內容，\n成為真正的理解。':'從一個章節，\n開始你的學習旅程。'}</h2><p>{scope?`目前範圍：${scope.name}。先整理概念，再用回想與小考確認理解。`:'建立解剖學科目，上傳老師正在教的教材，再設定本次的頁碼範圍。'}</p><button className="button cream" onClick={()=>subjects.length?setTab(scope?'notes':'materials'):setNewEntity('subject')}>{scope?'開始閱讀筆記':'建立我的第一個科目'}<ArrowUpRight size={17}/></button></div><div className="hero-illustration" aria-hidden="true"><div className="hero-circle"/><div className="paper paper-back"/><div className="paper paper-front"><span className="paper-tab"/><BookOpen size={31}/><strong>理解 · 連結 · 回想</strong><i/><i/><i/><div className="paper-check"><Check size={16}/>每一步都算數</div></div><Leaf className="hero-leaf" size={56}/></div></section>
 <div className="stats-grid">{[{label:'概念筆記',value:notes.length,unit:'篇已核對',icon:NotebookPen,color:'sage'},{label:'單字卡',value:cards.length,unit:'張可複習',icon:Layers,color:'peach'},{label:'小考題庫',value:questions.length,unit:'題可練習',icon:ClipboardCheck,color:'blue'},{label:'待核對內容',value:drafts.length,unit:'筆待確認',icon:Sparkles,color:'sand'}].map(s=><div className="stat-card" key={s.label}><span className={`stat-icon ${s.color}`}><s.icon size={20}/></span><span className="stat-label">{s.label}</span><strong>{s.value}<small>{s.unit}</small></strong></div>)}</div>
 <div className="overview-grid"><section className="panel"><div className="section-heading"><div><span className="eyebrow">YOUR NEXT STEP</span><h2>接下來，學什麼？</h2></div></div>{[{n:'01',title:'確認教材與授課範圍',description:materials.some(m=>m.status==='ready')?'教材已保存，可檢查頁碼與老師重點。':'從一份 PDF 開始，標記老師現在教到哪裡。',tab:'materials',icon:Files},{n:'02',title:'整理自己的概念筆記',description:drafts.length?`${drafts.length} 筆內容等待核對，確認後再加入學習。`:'使用 ChatGPT 提示詞，整理構造之間的關係。',tab:drafts.length?'notes':'import',icon:NotebookPen},{n:'03',title:'用回想確認理解',description:questions.length?`有 ${questions.length} 道已核對題目，試試一場小考。`:'筆記核對後，用單字與小考找到還不熟悉的地方。',tab:'quiz',icon:ClipboardCheck}].map(s=><button className="step-row" key={s.n} onClick={()=>setTab(s.tab)}><span className="step-number">{s.n}</span><div><h3>{s.title}</h3><p>{s.description}</p></div><ChevronRight size={18}/></button>)}</section><section className="panel review-panel"><span className="eyebrow">REFLECT & REVISIT</span><h2>留意需要再理解的地方</h2><div className="review-art"><Leaf size={31}/></div>{weak.length?<><div className="tags">{weak.map(c=><span key={c}>{c}</span>)}</div><p>這些概念出現在答錯或不確定的題目中。</p><button className="button secondary full" onClick={()=>setTab('quiz')}>前往弱點複習<ArrowUpRight size={16}/></button></>:<><p>完成第一場小考後，<br/>這裡會整理值得再複習的概念。</p><button className="button secondary full" onClick={()=>setTab('quiz')}>開始一場小考<ArrowUpRight size={16}/></button></>}{latest&&<div className="last-score">最近小考<strong>{latest.score} / {latest.snapshot.length}</strong></div>}</section></div>
 <div className="gentle-note"><ShieldCheck size={20}/><div><strong>學習有來源，複習有範圍。</strong><p>{preview?'這是介面示範；你的正式內容會由自己核對後加入。':'筆記與題目可回查教材。AI 整理後，記得核對內容、頁碼與老師的排除範圍。'}</p></div></div></>;
}

