# 第一版驗證紀錄

## v1.1.0 PDF 上傳修正與版本紀錄（2026-10-07）

- 使用使用者提供的 10,752,768 bytes／63 頁未加密 PDF 重現正式網站上傳前錯誤；PDF.js 成功解析後，舊程式呼叫不存在的 `PDFDocumentProxy.destroy()`，將 TypeError 誤報為檔案無法讀取。
- 改為清理 `PDFDocumentLoadingTask`，清理失敗不覆蓋成功結果；另區分加密、損壞与讀取器錯誤，Worker URL 帶 PDF.js 版本號。
- 導覽順序：ChatGPT 工作區 → 監視器 → 版本紀錄；版本頁不依賴章節／範圍。
- 18 項程式測試、lint 與 Workers 建置通過；6 組 Workers／Edge 瀏覽器測試通過，包含實際 63 頁 PDF 的瀏覽器解析、模擬 Storage 上傳及真正 server validator。
- 教材沒有提交 Git 或傳送到私人雲端。正式 Supabase 上傳與 Workers finalize API 的 CPU 限制仍需部署後驗收；本機模擬流程不代表正式上傳已完成。

## 雲端用量監測（2026-10-07）

- 新增 ChatGPT 工作區下方的監測頁與 `/api/usage`，不需 migration。
- 17 項程式測試通過，包含管理者隔離、憑證不回傳、五分鐘快取與 UTC 換日、部分查詢失敗。
- lint 通過；Cloudflare 正式建置通過。
- Workers 本機生產環境 5 組瀏覽器測試通過，使用模擬統計；監測頁在無學習範圍時仍可開啟，驗證額度提醒、未知資料與查詢失敗狀態，以及桌面／390px 手機。
- 真實 Cloudflare Analytics、Supabase 唯讀查詢及正式部署尚未驗收，需要使用者設定 runtime Secrets。Supabase 組織 Egress／MAU 未自動串接，請使用官方 Usage 核對。

驗證日期：2026-10-07（Asia/Taipei）。

| 檢查 | 結果 | 範圍 |
| --- | --- | --- |
| `npm.cmd test` | 13 項通過 | JSON contract、來源範圍、提示詞、弱點概念、備份映射、PDF 大小／損壞／加密檢查 |
| `npm.cmd run test:db` | 40 項通過 | 在 PGlite 執行真實 migration；兩個帳號與匿名身分、RLS、原子匯入、重複批次、核對版本、伺服器計分、歷史快照、實際 Storage row 刪除 |
| `npm.cmd exec playwright test` | 4 組通過 | Edge 桌面與 390px 手機、真實 PDF.js 頁碼閱讀、Markdown HTML 不執行、翻卡、熟悉度、JSON 預覽／匯入、小考、來源對應、無效上傳 |
| `npm.cmd run lint` | 通過，0 warnings | JavaScript／React／hooks 靜態檢查 |
| `npm.cmd run build` | 通過 | Next.js production build，包含 PDF finalize API |
| 套件安裝時 npm audit | 0 vulnerabilities | PDF.js 升級修正版並移除帶入未修補間接套件的 lint config 後 |

桌面與手機截圖已檢視，位於 `test-results/desktop-overview.png` 及 `test-results/mobile-overview.png`，均使用測試資料。測試產物不提交 Git。

本機正式模式已啟動於 http://localhost:3000。尚無 `.env.local` 雲端設定；登入頁顯示設定說明，可進入唯讀介面預覽。

尚待真實環境驗收：

- 使用者自己的 Supabase migration、帳號、Storage 與 RLS。
- 真實 Email 重設連結及郵件寄送。
- 實際掃描章節（使用者尚未提供章節 PDF）、圖像清晰度及教材內容正確性。
- 真實手機英文語音、兩裝置同步、連線中斷及雲端刪除失敗重試。
- Vercel 正式部署與目前方案額度。

PGlite 使用本機模擬的 auth/storage schema；瀏覽器以模擬 Supabase API 測試。上述自動檢查不表示已連線真實雲端、已上線或已核對課程醫學內容。

## Cloudflare 部署準備（2026-10-07）

- vinext check：10 項支援、0 partial／issues；這是靜態相容性檢查，不是正式環境保證。
- vinext 1.0.1＋Vite 8.3.0＋Cloudflare Vite plugin beta：正式 Workers 生產建置成功。
- Workers 生產預覽登入表單正常，PDF worker 回傳 200，未登入 finalize 回傳 401；瀏覽器無 pageerror。
- `npm.cmd run test:cloudflare`：4 組桌面／手機操作測試全數通過，使用真實 workerd 與模擬 Supabase API，包括 PDF.js 閱讀、匯入、小考、來源與備份。
- `npm.cmd test`：13 項通過；`npm.cmd run test:db`：40 項通過；`npm.cmd run lint`：0 warnings。
- `.env.local`、建置產物、測試產物均由 git check-ignore 確認排除；`.env.example` 已恢復不含實際值的範例。
- sharp／fflate 的間接相依已覆寫到修補版本。npm audit 尚有 7 high，來自同一個 braces pattern 拒絕服務警示及其相依鏈；registry 沒有更高的 braces 修補版本。尚未確認此建置工具警示可從網站遠端觸發，不能將此紀錄描述成 0 vulnerabilities。
- 尚待 Cloudflare 真實部署與 Supabase 登入、重設郵件、兩帳號隔離、多裝置同步、真實 PDF 上傳驗收；免費方案的 CPU／記憶體／bundle 限制尚待確認。
