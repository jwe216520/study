// Public release notes describe shipped code. They do not claim that a deployment succeeded.
export const currentVersion='1.1.0';
export const releases=[
 {version:'1.1.0',date:'2026-10-07',title:'PDF 上傳修正與雲端監測',changes:[
  '修正 PDF.js 新版資源清理方式，正常 PDF 不再因清理錯誤被判定為無法讀取。',
  '區分加密檔案、無效 PDF 與讀取器錯誤，提供對應處理提示。',
  'ChatGPT 工作區下方新增監視器，再下方新增版本紀錄。',
  '監視器提供管理者限定的 Cloudflare 請求／錯誤與 Supabase 專案空間統計，加入額度提醒。',
  '監視器需要額外唯讀授權；Supabase 組織流量與 MAU 仍由官方 Usage 核對。',
 ]},
 {version:'1.0.0',date:'2026-10-07',title:'拾知 Study 第一版',changes:[
  '提供私人帳號登入、科目與章節、PDF 教材與授課範圍管理。',
  '提供 ChatGPT JSON 匯入、筆記核對、單字卡、小考與弱點複習。',
  '提供學習資料備份與 Cloudflare Workers 部署設定。',
 ]},
];
