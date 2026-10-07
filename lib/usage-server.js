// Imported only by the server route. Never accept a query, project or token from the browser.
export function monitorConfig(env=process.env) {
 return {admin:env['MONITOR_ADMIN_USER_ID'],account:env['MONITOR_CF_ACCOUNT_ID'],cfToken:env['MONITOR_CF_API_TOKEN'],sbToken:env['MONITOR_SUPABASE_TOKEN'],project:new URL(env['NEXT_PUBLIC_SUPABASE_URL']||'https://invalid.local').hostname.split('.')[0]};
}
async function readJson(fetcher,url,token,body) {
 const response=await fetcher(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000),cache:'no-store'});
 if(!response.ok)throw new Error(response.status===401||response.status===403?'授權失敗，請檢查唯讀 Token 權限與範圍':response.status===429?'官方 API 暫時限流，請稍後更新':`官方 API 回應 ${response.status}`);
 return response.json();
}
const numeric=value=>{if(value===null||value===undefined||value==='')throw new Error('官方 API 尚未提供有效統計');const n=Number(value);if(!Number.isFinite(n)||n<0)throw new Error('官方 API 統計格式不符合預期');return n;};
export async function readCloudflare(config,fetcher=fetch,now=new Date()) {
 if(!config.cfToken||!config.account)return {status:'unconfigured',message:'尚未設定 Cloudflare 唯讀 Analytics Token 與 Account ID'};
 const start=new Date(now);start.setUTCHours(0,0,0,0);
 try {
  const result=await readJson(fetcher,'https://api.cloudflare.com/client/v4/graphql',config.cfToken,{
   query:`query Usage($account: string, $start: string, $end: string) { viewer { accounts(filter: {accountTag: $account}) {
    total: workersInvocationsAdaptive(limit: 1, filter: {datetime_geq: $start, datetime_leq: $end}) { sum { requests errors } }
    study: workersInvocationsAdaptive(limit: 1, filter: {scriptName: "study", datetime_geq: $start, datetime_leq: $end}) { sum { requests errors } }
   } } }`,variables:{account:config.account,start:start.toISOString(),end:now.toISOString()}});
  if(result.errors?.length)throw new Error('Analytics 查詢失敗，請確認 Account Analytics Read 權限與資料集可用性');
  const account=result.data?.viewer?.accounts?.[0];
  if(!account)throw new Error('無法取得此帳號統計，請檢查 Account ID 與授權範圍');
  // An empty dataset is unknown, not proof of zero usage.
  const total=account.total?.[0]?.sum,study=account.study?.[0]?.sum;
  return {status:'ready',checkedAt:now.toISOString(),periodStart:start.toISOString(),requests:total?numeric(total.requests):null,errors:total?numeric(total.errors):null,studyRequests:study?numeric(study.requests):null,studyErrors:study?numeric(study.errors):null,message:'Cloudflare Analytics 可能延遲或取樣；帳號總量包含其他 Workers，並非精確帳單。'};
 }catch(e){return {status:'error',message:e.name==='TimeoutError'?'Cloudflare 查詢逾時，請稍後更新':e.message};}
}
export async function readSupabase(config,fetcher=fetch,now=new Date()) {
 if(!config.sbToken)return {status:'unconfigured',message:'尚未設定 Supabase Management API 的 database_read 唯讀 Token'};
 if(!/^[a-z]{20}$/.test(config.project))return {status:'error',message:'Supabase 專案網址格式不符合預期'};
 const endpoint=`https://api.supabase.com/v1/projects/${config.project}/database/query/read-only`;
 const queries={database:'select pg_catalog.pg_database_size(pg_catalog.current_database())::text as bytes',storage:"select coalesce(sum((metadata->>'size')::numeric),0)::text as bytes from storage.objects"};
 const results=await Promise.all(Object.entries(queries).map(async([id,query])=>{
  try{const rows=await readJson(fetcher,endpoint,config.sbToken,{query});return [id,{value:numeric(rows?.[0]?.bytes)/(id==='database'?1e6:1e9),checkedAt:now.toISOString()}];}
  catch(e){return [id,{value:null,message:e.name==='TimeoutError'?'Supabase 查詢逾時，請稍後更新':e.message}];}
 }));
 return {status:results.every(([,r])=>r.value===null)?'error':'ready',checkedAt:now.toISOString(),metrics:Object.fromEntries(results),message:'本專案資料庫及所有 bucket 檔案 metadata 統計；Storage 為專案用量，未包含組織其他專案。流量與 MAU 需到官方組織 Usage 核對。'};
}
export function createMonitorHandler({getConfig=monitorConfig,authenticate,fetcher=fetch,clock=()=>new Date()}) {
 let cached=null,inflight=null;
 return async function GET(request) {
  const headers={'Cache-Control':'private, no-store','Vary':'Authorization'};
  const reply=(body,status=200)=>Response.json(body,{status,headers});
  const bearer=request.headers.get('authorization');
  if(!bearer?.startsWith('Bearer '))return reply({error:'請先登入'},401);
  const config=getConfig();
  if(!config.admin)return reply({error:'尚未指定監測管理者。請設定 MONITOR_ADMIN_USER_ID。'},503);
  let user;
  try{user=await authenticate(bearer);}catch{return reply({error:'登入驗證失敗，請重新登入或稍後再試'},401);}
  if(!user)return reply({error:'登入已過期，請重新登入'},401);
  if(user.id!==config.admin)return reply({error:'此頁僅供監測管理者查看'},403);
  const now=clock();
  if(cached&&now-new Date(cached.checkedAt)<300000&&cached.checkedAt.slice(0,10)===now.toISOString().slice(0,10))return reply({...cached,cached:true});
  inflight ||= Promise.all([readCloudflare(config,fetcher,now),readSupabase(config,fetcher,now)]).then(([cloudflare,supabase])=>({checkedAt:now.toISOString(),cloudflare,supabase}));
  try{cached=await inflight;return reply({...cached,cached:false});}finally{inflight=null;}
 };
}
