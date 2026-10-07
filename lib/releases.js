// Public release notes describe shipped code. They do not claim that a deployment succeeded.
export const currentVersion='1.2.0';
export const releases=[
 {version:'1.2.0',date:'2026-10-07',title:'獨立單字庫與逐題練習',changes:[
  '單字卡不再需要科目、章節或範圍，新增單字集管理與新舊備份還原。',
  'ChatGPT 只產生筆記與題目，預設 50 題並可調整數量；小考預設提高為 20 題。',
  '新增逐題練習、即時解析、保存續答及錯題重練，與正式小考紀錄分開。',
  '移除逐筆核對流程，保存及匯入後即可使用，由系統自動檢查格式與來源。',
  '保留既有單字熟悉程度、排除設定及歷史小考快照。',
 ]},
 {version:'1.1.1',date:'2026-10-07',title:'Supabase 統計連線與保存提示修正',changes:[
  '修正 Cloudflare 建置時 Supabase 公開網址的讀取方式，解決統計功能未取得網址而顯示格式錯誤。',
  '統計查詢失敗時顯示失敗狀態，並區分未設定授權、網站 API 連線與 Supabase 驗證服務錯誤。',
  '保存連線失敗時保留編輯內容，提醒確認資料是否已寫入，避免重複新增。',
  '區分操作已保存但同步失敗的情況，範圍編輯視窗開啟時暫停背景同步。',
 ]},
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
