# 雲端用量監測設定

導覽位置：ChatGPT 工作區下方的「雲端用量監測」。此功能不需要重跑 SQL migration。

資料流：瀏覽器傳送目前 Supabase 登入 token → `/api/usage` 用 Supabase 驗證身分 → 比對指定管理者 UUID → 伺服器使用唯讀憑證查詢官方 API → 回傳數字與時間。伺服器不接受瀏覽器指定 SQL、帳號、專案或管理 Token。

## 1. 指定可查看的帳號

Supabase → Authentication → Users → 自己的帳號，複製 **User UID**。

Cloudflare → Workers & Pages → study → Settings → Variables and Secrets，加入 `MONITOR_ADMIN_USER_ID`，值為該 UUID。所有監測設定都可使用 Secret；Token 必須使用 Secret。這裡是 Worker **執行時**設定，與部署前設定的 Build variables 不同。

## 2. Cloudflare 唯讀授權

API Tokens → Create Token → Custom token：

- 名稱：`study-usage-read`。
- 權限：**Account → Account Analytics → Read**。
- Account Resources：限制在網站所在帳號。
- 不需要 Workers Edit、Email Routing、帳務修改等權限。

建立後直接複製到 Worker Secret `MONITOR_CF_API_TOKEN`，不要貼到聊天或 Git。新增 `MONITOR_CF_ACCOUNT_ID`，值為該帳號 Account ID。

讀取 UTC 今日帳號所有 Workers 的請求與錯誤，以及 `study` 自己的請求與錯誤。Analytics 可能取樣、延遲，不是精確帳單。空資料集顯示未知，不假設為零。UTC 每日重設相當於台灣早上 08:00。

## 3. Supabase 唯讀授權

Supabase 帳號的 Access Tokens 頁建立 fine-grained token（如果後台提供此選項），限定 Study 專案及 **database_read** 權限。此端點對應 OAuth scope `database:read`。

將 Token 直接存入 Worker Secret `MONITOR_SUPABASE_TOKEN`。不要使用 publishable、anon、service_role 或資料庫密碼替代 Management API Token。

若你的 Access Tokens 畫面只能建立擁有整個帳號權限的舊式 PAT，**不要先建立廣泛授權 Token**；先確認可用的 fine-grained token／受限 OAuth 方式。本頁會保持未設定，其他學習功能仍可使用。

伺服器只呼叫官方 Beta `/v1/projects/{ref}/database/query/read-only`，使用固定查詢讀取：

- `pg_database_size(current_database())`：本專案資料庫實際大小，包含系統資料／索引，不只學習內容。
- `storage.objects` metadata 的 size 總和：本專案所有 bucket 的檔案大小估算，不讀取 PDF 內容。若唯讀角色無法讀取此 schema，該項顯示授權錯誤，不自動提升權限。

這不是組織完整帳務 API：未快取流量、快取流量及帳務週期 MAU 沒有在本功能中自動讀取，必須使用官方組織 Usage。其他專案的 Storage 不計入本專案讀數，不能直接把剩餘空間當成組織實際剩餘空間。

## 4. 部署及驗收

提交並推送此版本以觸發 Cloudflare 建置；上述 Secrets 放在執行時，不填 Build variables，不加 `NEXT_PUBLIC_` 前綴。`cloudflare.config.ts` 只宣告 Secret 名稱，沒有憑證值。Cloudflare nodejs_compat 讓 runtime Secrets 可由伺服器 process.env 讀取。

登入指定帳號 → 雲端用量監測 → 更新用量。確認兩個服務的連線狀態、數字與時間，再對照官方後台。用第二個帳號測試 `/api/usage` 應回 403，未登入應回 401。未指定管理者時拒絕查詢。

頁面開著時每五分鐘更新；背景分頁暫停。伺服器每個 isolate 共享五分鐘快取並合併並行查詢，UTC 換日不重用前日資料。這不是全域持久快取；大量流量仍需額外的全域 rate limit。API 回應 no-store；快取只在驗證管理者後可存取。

沒有背景排程、Email 通知、自動阻斷、付費升級或帳單上限保證。預覽不呼叫管理 API；70%／90%／100% 是介面提醒門檻。參考額度不能證明帳號確實處於 Free。

## 官方依據（2026-10-07 查閱）

- [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Supabase Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress)
- [Supabase read-only API](https://supabase.com/docs/reference/api/v1-read-only-query)
- [Supabase 官方 API 規格](https://github.com/supabase/supabase/blob/master/apps/docs/spec/api_v1_openapi.json)
- [Cloudflare Analytics Token](https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/)
- [Workers GraphQL](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/)
- [Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
