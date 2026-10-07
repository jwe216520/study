'use client';
import { useEffect, useState } from 'react';
import { Activity, ExternalLink, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';
import { usageMetrics, usageLevel, materialUsage } from '@/lib/usage';
import { getSupabase } from '@/lib/supabase';
import { connectionMessage } from '@/lib/connection-errors';
const labels={unknown:'尚無資料',normal:'低於提醒門檻',warning:'接近額度',critical:'即將達到額度',danger:'已達參考額度'};
const time=value=>value?new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'尚未查詢';
export default function UsagePanel({data,preview}) {
 const [report,setReport]=useState(null),[pending,setPending]=useState(false),[error,setError]=useState(''),[tick,setTick]=useState(0);
 useEffect(()=>{
  if(preview)return;
  let alive=true;const controller=new AbortController();
  async function load(){setPending(true);setError('');try{
   const {data:auth,error:authError}=await getSupabase().auth.getSession().catch(e=>{throw new Error(connectionMessage(e));});if(authError)throw new Error(connectionMessage(authError));if(!auth.session)throw new Error('請重新登入');
   const res=await fetch('/api/usage',{headers:{Authorization:`Bearer ${auth.session.access_token}`},cache:'no-store',signal:controller.signal});
   const body=await res.json();if(!res.ok)throw new Error(body.error||'監測資料讀取失敗');if(alive)setReport(body);
  }catch(e){if(alive&&e.name!=='AbortError')setError(connectionMessage(e,'網站統計 API（/api/usage）'));}finally{if(alive)setPending(false);}}
  load();const timer=setInterval(()=>{if(document.visibilityState==='visible')load();},300000);
  return()=>{alive=false;controller.abort();clearInterval(timer);};
 },[preview,tick]);
 const materials=materialUsage(data.materials),sb=report?.supabase,cf=report?.cloudflare;
 const stale=Boolean(error||report&&Date.now()-Date.parse(report.checkedAt)>600000);
 const values={database:sb?.metrics?.database?.value,storage:sb?.metrics?.storage?.value,requests:cf?.requests};
 const risky=usageMetrics.filter(m=>['warning','critical','danger'].includes(usageLevel(values[m.id],m.limit)));
 return <div className="usage-page">
  <section className="panel usage-summary"><div><span className="badge"><Activity size={14}/>雲端用量監測</span><h2>{preview?'預覽模式・尚未連接統計':stale?'資料需要更新':risky.length?'有用量接近免費額度':'查看免費額度與服務狀態'}</h2><p>以 Free 方案作比較，不代表已確認你的訂閱方案。尚無資料的項目無法判斷剩餘額度。</p><small>最近查詢：{time(report?.checkedAt)}{report?.cached?' · 使用五分鐘內快取':''} · 開啟此頁時每五分鐘更新</small></div><button className="button secondary" disabled={pending||preview} onClick={()=>setTick(t=>t+1)}><RefreshCw size={16} className={pending?'spin':''}/>{pending?'查詢中…':'更新用量'}</button></section>
  {error&&<div className="usage-alert" role="alert"><AlertTriangle size={18}/><span>{error}{report?'。下方保留上次資料，請勿視為最新用量。':''}</span></div>}
  <div className="usage-services">{[['Supabase',sb],['Cloudflare',cf]].map(([name,service])=><section className="panel" key={name}><h3><span className={`usage-light ${service?.status==='ready'?'ready':''}`}/>{name} 統計連線</h3><p>{preview?'預覽不呼叫管理 API。':error?(service?'本次更新失敗，下方保留上次統計。':'統計查詢失敗，尚未取得服務狀態。請查看上方錯誤並按「更新用量」重試。'):pending?'正在查詢統計…':service?.message||'等待設定與首次查詢。'}</p><small>{error?(service?'上次統計 · 本次更新失敗':'查詢失敗'):pending?'查詢中':service?.status==='ready'?'已取得統計':service?.status==='error'?'查詢失敗':'尚未連接'} · {time(service?.checkedAt)}</small></section>)}</div>
  <div className="usage-grid">{usageMetrics.map(m=>{const value=values[m.id]??null,level=usageLevel(value,m.limit),percent=value===null?null:value/m.limit*100;return <section className={`panel usage-card ${level}`} key={m.id}><div className="usage-card-top"><span>{m.provider}</span><span className="usage-status">{stale&&value!==null?'舊資料':labels[level]}</span></div><h3>{m.label}</h3><strong>{value===null?'—':value.toLocaleString('zh-TW',{maximumFractionDigits:3})}<small> / {m.limit.toLocaleString()} {m.unit}</small></strong><div className="usage-meter" role="meter" aria-label={m.label} aria-valuemin={0} aria-valuemax={m.limit} {...(value===null?{'aria-valuetext':'尚無資料'}:{'aria-valuenow':Math.min(value,m.limit),'aria-valuetext':`${value} / ${m.limit} ${m.unit}`})}><i style={{width:`${percent===null?0:Math.min(percent,100)}%`}}/></div><p>{percent===null?'尚未取得用量，不以 0 顯示。':`參考額度 ${percent.toFixed(1)}% · 剩餘 ${Math.max(m.limit-value,0).toLocaleString('zh-TW',{maximumFractionDigits:3})} ${m.unit}`}</p><small>{m.period}</small>{m.id==='storage'&&<small>目前自動讀取本專案；其他專案請到官方 Usage 合併核對。</small>}{sb?.metrics?.[m.id]?.message&&<small className="usage-error">{sb.metrics[m.id].message}</small>}{['egress','cachedEgress','mau'].includes(m.id)&&<small>官方公開 API 未提供本頁可用的完整帳務總量，請查看 Supabase Usage。</small>}</section>;})}</div>
  <div className="usage-services"><section className="panel"><h3>Study 今日運作</h3><div className="usage-facts"><span>本站請求<strong>{cf?.studyRequests??'—'}</strong></span><span>本站錯誤<strong>{cf?.studyErrors??'—'}</strong></span><span>帳號總錯誤<strong>{cf?.errors??'—'}</strong></span></div><p>UTC 每日重設，台灣時間早上 08:00 開始新一天。CPU 為每次請求限制（Free 參考值 10 ms），不是每日剩餘時間；請到官方 Metrics 查看 CPU 與資源超限錯誤。</p></section><section className="panel"><h3>我的教材與學習資料</h3><div className="usage-facts"><span>教材登錄大小<strong>{(materials.bytes/1e6).toFixed(2)} MB</strong></span><span>教材份數<strong>{materials.count}</strong></span><span>未完成／待刪除<strong>{materials.pending}</strong></span></div><p>依目前登入帳號的教材記錄估算；不是 Storage 官方總量。已刪除教材不計入，未完成上傳仍保守計入。</p></section></div>
  <section className="panel usage-guidance"><h3><ShieldCheck size={18}/>額度提醒與設定</h3><p>70% 提醒、90% 優先處理、100% 標示已達參考額度。提醒只在此頁顯示，不會自動停止服務、發送通知或阻擋帳單。</p><p>Supabase 的流量、Storage 與 MAU 可能由組織多個專案共用；Cloudflare 每日 Workers 請求由帳號共用。Free 配額參考核對日期：2026-10-07。升級方案或新增服務後，需重新確認官方限制。</p><div className="usage-links"><a className="button secondary" href="https://supabase.com/dashboard/org/_/usage" target="_blank" rel="noopener noreferrer">Supabase 官方用量<ExternalLink size={14}/></a><a className="button secondary" href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer">Cloudflare 官方後台<ExternalLink size={14}/></a></div><details><summary>如何啟用自動監測</summary><p>先指定 MONITOR_ADMIN_USER_ID 為自己的 Supabase 帳號 UUID，再於 Cloudflare Worker 的 Variables and Secrets 加入 MONITOR_CF_ACCOUNT_ID、MONITOR_CF_API_TOKEN、MONITOR_SUPABASE_TOKEN。Token 使用 Secret，不加 NEXT_PUBLIC_。詳細權限與步驟見專案 USAGE-MONITOR.md。</p></details><p className="muted"><a href="https://supabase.com/docs/guides/platform/billing-on-supabase" target="_blank" rel="noopener noreferrer">Supabase 免費額度</a> · <a href="https://developers.cloudflare.com/workers/platform/limits/" target="_blank" rel="noopener noreferrer">Cloudflare Workers 限制</a></p></section>
 </div>;
}
