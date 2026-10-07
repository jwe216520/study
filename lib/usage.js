// Reference quotas, checked against official Free plan documentation on 2026-10-07.
// These are comparison values, not evidence of the account's actual subscription.
export const usageMetrics = [
 {id:'database',provider:'Supabase',label:'資料庫大小',unit:'MB',limit:500,period:'目前用量・每個專案'},
 {id:'storage',provider:'Supabase',label:'檔案儲存空間',unit:'GB',limit:1,period:'目前用量・組織總量'},
 {id:'egress',provider:'Supabase',label:'未快取流量',unit:'GB',limit:5,period:'帳務週期・組織總量'},
 {id:'cachedEgress',provider:'Supabase',label:'快取流量',unit:'GB',limit:5,period:'帳務週期・組織總量'},
 {id:'mau',provider:'Supabase',label:'每月活躍使用者',unit:'人',limit:50000,period:'帳務週期・組織總量'},
 {id:'requests',provider:'Cloudflare',label:'Workers 請求',unit:'次',limit:100000,period:'UTC 今日・帳號所有 Workers'},
];
export function usageLevel(value,limit) {
 if(value===null||value===undefined||!Number.isFinite(value)||value<0)return 'unknown';
 return value>=limit?'danger':value>=limit*.9?'critical':value>=limit*.7?'warning':'normal';
}
export function materialUsage(materials=[]) {
 const active=materials.filter(m=>m.status!=='deleted');
 return {bytes:active.reduce((sum,m)=>sum+(Number.isFinite(m.bytes)&&m.bytes>0?m.bytes:0),0),count:active.length,pending:active.filter(m=>m.status!=='ready').length};
}
