# 拾知 Study｜護理個人學習網站

以老師授課範圍為核心的私人學習網站。使用 Next.js App Router、React、JavaScript、Tailwind CSS、Supabase；先在自己的 ChatGPT 整理教材，再匯入筆記、單字卡與單選題。

## 本機啟動

需要 Node.js 22.13 以上（建議目前仍受支援的 LTS）及 npm。

```powershell
cd 'D:\ZWH\html practice\study'
npm.cmd ci
Copy-Item .env.example .env.local
# 編輯 .env.local，填入下方兩個公開設定
npm.cmd run dev
```

開啟 http://localhost:3000。未填 Supabase 設定時會顯示設定說明，也可以進入**唯讀介面預覽**；預覽範例不是你的課程內容，不會保存或模擬雲端同步。

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://你的專案.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的publishable或anon公開金鑰
```

這兩個值用於公開的瀏覽器連線，安全性由資料庫／Storage RLS 保護。**不要填 service_role／secret key、ChatGPT 密碼或 API 金鑰。** `.env.local` 已排除於 Git。

## Supabase 初次設定

1. 建立自己的 Supabase 專案。使用全新專案；migration 是初始建表腳本，不是既有資料庫的升級腳本。
2. 在 SQL Editor 執行 `supabase/migrations/001_study.sql` **一次**。整份 migration 使用 transaction；失敗時應先處理錯誤，不要任意跳過權限段落。
3. 在 Authentication → Providers／Sign In 設定啟用 Email＋密碼、關閉公開註冊（Allow new users to sign up）。網站沒有註冊頁，但仍須在服務端關閉註冊。
4. 在 Authentication → Users → Add user 建立自己的帳號、設定強密碼並確認 Email。不要把密碼寫進 SQL、程式或 Git。
5. 在 Authentication 的密碼政策設定至少 12 字元；依專案可用選項啟用額外強度檢查。
6. URL Configuration：本機 Site URL 設為 `http://localhost:3000`；Redirect URLs 加入 `http://localhost:3000/`。部署後加入正式 HTTPS 網址並更新 Site URL。
7. 忘記密碼使用 Supabase recovery 郵件。確認郵件寄送設定、重設模板與重新導向網址；正式使用建議配置自己的 SMTP，避免開發郵件服務的限制。
8. 確認 Storage 中 `study-materials` bucket 是 **Private**，上限 20 MB、允許 `application/pdf`。migration 已建立這些設定。
9. 在 `.env.local` 填入公開設定並重新啟動。登入後新增「解剖學」科目及你的第一個章節。
10. 用另一個測試帳號及未登入瀏覽器檢查資料／檔案不可見。測試結束後可在後台移除測試帳號。

此網站不需要伺服器管理金鑰。所有 RPC 都以登入者身分驗證擁有權；`security definer` 函式固定 `search_path`，內部函式不可當作公開 RPC 呼叫。

## 日常使用

1. **教材與範圍：**上傳掃描 PDF（每份最多 20 MB）。瀏覽器 PDF.js 先確認可讀性，直接上傳私人 Storage，再經 Next.js API 用 PDF parser 驗證大小、頁數及加密狀態。失敗的教材會留在「上傳未完成」，可刪除後重試。
2. **指定授課：**建立範圍，選教材與 PDF 實際頁面序號（從 1 起算），填老師重點及排除內容。一章可以有多份教材與多個範圍。
3. **ChatGPT 工作區：**複製提示詞，在自己的 ChatGPT 另外上傳對應 PDF。網站不會自動傳檔、讀取 ChatGPT 對話、做 OCR 或呼叫 AI API。
4. **匯入：**貼上 JSON 或上傳檔案，驗證、預覽，再確認保存。一般 JSON 限 2 MB，每種內容最多 300 筆。全部以待核對狀態匯入。
5. **核對：**概念筆記頁、單字的「管理與核對」、小考的「題庫與核對」可編輯、開啟來源及發布。題目應依教材核對答案，也須人工確認老師的排除內容。網站只能驗證格式、教材代號、頁碼與範圍，不能判定醫學內容或語意正確性。
6. **複習：**單字翻面後標記熟悉程度；獨立發音按鈕可選英文語音與速度。語音依装置而定，不保證所有醫學專有名詞發音正確。
7. **小考：**預設 10 題、不限時；不足時採實際可用題數。未答視為答錯；答對但不確定也會進入弱點複習。弱點模式包含原錯題與共用弱點標籤的已核對題目。
8. **同步：**保存後重新讀取雲端資料；切回視窗及每分鐘也會同步。沒有離線寫入。遇到網路錯誤會提示，不會假裝已保存。

修改筆記／單字／題目會重設該筆核對狀態。修改範圍的頁碼、老師重點或排除內容會增加版本並重設此範圍的所有核對狀態。教材每次上傳取得新代號，舊來源不會自動換成新檔案。

小考建立時保存當時的題目快照，交卷時由資料庫計分並保存答案與解析；日後改題、改範圍或刪除教材不改變歷史結果。同一份已交卷的小考再次提交不會改分。未交卷選項只在目前畫面中暫存，重新進入會從空白答案開始。

## JSON 格式

工作區提供含目前教材代號的下載範例。三個陣列皆可省略，至少一種包含內容；`answerIndex` 從 0 開始。`materialId` 是網站教材 UUID，不能寫檔名。`printedPage` 僅為顯示註記，範圍驗證使用 `page`。

```json
{
  "schemaVersion": 1,
  "notes": [{
    "title": "概念名稱",
    "markdown": "## 核心概念\n依教材整理內容",
    "supplement": false,
    "concepts": ["概念名稱"],
    "sources": [{ "materialId": "換成網站產生的教材UUID", "page": 2, "printedPage": "15" }]
  }],
  "flashcards": [{
    "english": "English term",
    "chinese": "中文名稱",
    "explanation": "補充說明",
    "concepts": ["概念名稱"],
    "sources": []
  }],
  "questions": [{
    "prompt": "依教材建立題幹",
    "options": ["選項A", "選項B", "選項C", "選項D"],
    "answerIndex": 0,
    "explanation": "依教材解釋正解",
    "concepts": ["概念名稱"],
    "sources": [{ "materialId": "換成網站產生的教材UUID", "page": 2 }]
  }]
}
```

教材筆記與題目一定要有來源；單字可沒有來源。`supplement: true` 的筆記可引用同章教材的授課範圍外頁面，但不能超出原 PDF；補充筆記不加入題庫。Markdown 不執行原始 HTML、不顯示遠端圖片；外部連結不攜帶 referrer，避免把私人內容交給外部網站。

匯入使用資料庫 transaction，任何一筆錯誤都回滾。批次 UUID 及「擁有者＋範圍版本＋JSON 指紋」同時防止重複提交。不要為了重試任意修改批次；已成功保存的內容應直接編輯。

## 備份與刪除

- 「匯出備份」包含科目、範圍、來源 metadata、學習內容、熟悉程度及歷史小考，沒有登入 token 或簽署網址。備份為明文，請自行存放在私人位置。
- PDF 原檔要從教材頁**個別下載**，JSON 不包含 PDF。
- 在 ChatGPT 工作區讀取備份（上限 20 MB），選擇要帶回的學習範圍並明確對應已上傳教材。重新驗證後只匯入筆記、單字與題目，全部重新核對。
- 跨專案還原時，先建立科目、章節、教材及範圍；新教材 UUID 不同，必須手動對應。原頁碼會保留，掃描順序不同時請自行修正。
- 熟悉程度與历史小考保留在備份中供保存，不由匯入功能覆寫。完整資料庫災難復原需另外管理 Supabase 的資料庫備份／匯出。
- 已存在的相同學習批次會拒絕重複匯入，避免備份還原產生重複卡片。
- 刪除 PDF 前顯示受影響來源數量。先設 `delete_pending`、移除 Storage 檔案，成功後才設 `deleted`。失敗可按重試刪除；metadata 與歷史快照保留。

## 測試與部署

```powershell
npm.cmd test                 # Zod、來源、提示詞、備份對應及 PDF parser
npm.cmd run test:db          # 真實 migration 在記憶體 PostgreSQL 內驗證
npm.cmd run lint
npm.cmd exec playwright test # 桌面／手機 UI，使用本機已安裝的 Edge
npm.cmd run build
npm.cmd start
```

資料庫測試使用 PGlite，模擬 Supabase 的 auth/storage schema，不會連線或修改你的雲端專案。瀏覽器測試使用独立 3101 埠、`.next-ui` 建置目錄與模擬 Supabase API；驗證 UI、PDF.js、JSON 預覽、單字熟悉度、小考、手機寬度及 HTML 不執行。這些測試不能取代真實雲端 RLS、郵件、上傳失敗或多裝置驗收。

部署 Cloudflare Workers：

詳見 [CLOUDFLARE.md](CLOUDFLARE.md)。GitHub 儲存庫為 `jwe216520/study`；Cloudflare 使用 vinext 建置，原本 Next.js 本機開發保留。

```powershell
npm.cmd run test:cloudflare  # 真實 workerd 生產預覽，Supabase 請求以測試資料模擬
npm.cmd run build:cloudflare # 檢查公開設定並產生正式 Workers bundle
```

Workers Builds 的 Build command 為 `npm run build:cloudflare`，Deploy command 為 `npx cf deploy --prebuilt`；Worker 名稱必須為 `study`。
兩個 `NEXT_PUBLIC_…` 設定須填在 Cloudflare Build variables；不提交 `.env.local`、教材或備份。

部署後更新 Supabase Site URL／Redirect URLs，使用自己的帳號做一章完整驗收，再用第二個測試帳號確認資料隔離；檢查實際 PDF、手機發音、忘記密碼與跨裝置同步。
PDF 直接上傳私人 Supabase Storage，Finalize API 只收教材代號並下載驗證，無 service_role 金鑰；仍須驗收 Workers CPU／記憶體限制，不能保證所有 20 MB PDF 都能在免費額度內完成驗證。

Cloudflare／Supabase 的方案限制、郵件與額度需另行確認，不自動升級付費方案。本機建置通過不代表已正式上線。

## 官方參考

- [Next.js 安裝](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase 私人 bucket](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase 密碼與重設](https://supabase.com/docs/guides/auth/passwords)
- [瀏覽器可用語音](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices)
- [Cloudflare Next.js](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)

下一階段再加入完整間隔複習、解剖圖遮罩與直接 AI 串接；目前沒有同學分享、公開教材、臨床決策或自動 OCR 功能。
