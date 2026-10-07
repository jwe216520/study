# Cloudflare Workers 部署

網站程式由 Cloudflare Workers 執行；帳號、學習資料與私人 PDF 繼續存放在現有 Supabase。
原本 `npm run dev` 的 Next.js 本機開發方式保留。Cloudflare 使用 vinext 1.0.1 與 Cloudflare Vite plugin；目前工具鏈包含 beta 套件，版本由 package-lock.json 鎖定。

## 首次部署（GitHub → Workers Builds）

1. 登入 Cloudflare，進入 **Workers & Pages → Create application → Import a repository**。
2. 連接 GitHub，只授權所需儲存庫，選擇 `jwe216520/study`。
3. 使用 Workers，名稱填 **study**（須與 cloudflare.config.ts 相同）。不要使用 Pages 靜態上傳。
4. 使用以下設定：

| 設定 | 值 |
| --- | --- |
| Production branch | `main` |
| Root directory | 儲存庫根目錄，留空或 `/` |
| Build command | `npm run build:cloudflare` |
| Deploy command | `npx cf deploy --prebuilt` |

5. 在 **Build variables and secrets** 加入：

| 名稱 | 值 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 本機 .env.local 裡的 Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 本機 .env.local 裡的 Publishable key |
| `NODE_VERSION` | `24` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 的 Account ID，若建置環境未自動提供則需要設定 |

Account ID 可在 Cloudflare 帳號首頁取得，或查看 `dash.cloudflare.com/<account-id>` 的帳號網址。
Workers Builds 自動產生的部署授權應交給 Cloudflare 管理；若 `cf` 回報沒有憑證，確認建置服務提供 `CLOUDFLARE_API_TOKEN`，必要時在 Build secrets 設定具 Workers 部署權限的 token。不要把 token 寫入 repository 或聊天。

**公開設定必須在 Build variables 提供。** NEXT_PUBLIC 值於建置時嵌入瀏覽器與伺服器 bundle；只填 runtime Variables & Secrets 不會更新已建置的前端。
變數名稱沿用此專案的 `ANON_KEY`；不要改成 `PUBLISHABLE_KEY`。可填 `sb_publishable_...`；不可填 Secret／service_role key。

6. Save and Deploy，等待成功後取得實際 `https://study.<你的子網域>.workers.dev` 網址。此文件的網址只是格式示例。
7. Supabase → Authentication → URL Configuration：把正式 Site URL 設為上述 HTTPS 網址，Redirect URLs 加入該網址加上 `/`。保留本機網址作開發用途。
8. 用手機行動網路登入，建立科目／章節、上傳實際 PDF、檢查忘記密碼與另一台裝置同步。電腦可關機。

如果出現 `Worker name mismatch`，確認 Cloudflare Worker 名稱為 `study`。
若缺少 Supabase 變數，build:cloudflare 會停止而不是部署設定頁。
首次先關閉非 main 分支的自動 Preview build；若要啟用，需另外設定符合 `cf` 的預覽部署流程與測試用 Supabase 環境，不能直接保留 Wrangler 預設命令。

## 更新程式碼

在 VS Code 修改後先驗證：

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run test:cloudflare
```

確認變更，再提交並推送：

```powershell
git status
git add .
git commit -m "Describe the change"
git push origin main
```

Cloudflare 接收到 main 的 push 後會重新建置與部署。等待成功再重新整理手機；不要把部署失敗當成已更新。
資料庫結構改動須另外執行新的 migration。Git push 不會替你修改 Supabase，**不要重跑 001_study.sql**。

## 本機 Workers 預覽／手動部署

```powershell
npm.cmd run build:cloudflare
npm.cmd run start:vinext -- --host 127.0.0.1 --port 3102
```

開啟 http://127.0.0.1:3102。`test:cloudflare` 會使用模擬公開設定重建產物，測試結束後若要預覽實際帳號，必須重跑 `build:cloudflare`。

若不用 GitHub 自動部署，本機設定 CLOUDFLARE_ACCOUNT_ID、使用 `npx cf auth login` 登入後執行：

```powershell
npm.cmd run deploy:cloudflare
```

此指令會先用目前設定重新建置，避免誤部署測試產物。首次線上部署仍須真實帳號驗收。

## 檔案與限制

- 提交 app、components、lib、scripts、tests、public 原始素材、supabase migration、package.json／lock、設定檔與文件。
- 不提交 .env.local、node_modules、.next、.cloudflare、.vinext、.wrangler、測試產物與日誌；.gitignore 已排除。
- public/pdf.worker.min.mjs 在 npm 安裝後自動產生，不需要提交。
- 不把私人教材、備份或密碼放進 repository；教材透過網站存到 Private Supabase Storage。
- 未建立 R2／D1／KV 或付費 Images 服務；目前不使用 CDN／資料快取儲存私人學習頁面。
- Workers 的 CPU／記憶體／bundle 限制仍要在正式方案驗收。PDF 上限 20 MB，不代表任何 PDF 都能在免費方案的 CPU 預算內完成解析；maxDuration=60 不能增加 Cloudflare 的 CPU 額度。
- 已修補 sharp 與 fflate 間接相依。npm audit 尚有 7 項 high，均源自建置工具鏈的 braces 巢狀 pattern 拒絕服務警示；registry 目前沒有更新的 braces 修補版本。這不是已確認的網站遠端漏洞，亦不代表沒有風險；不要對陌生來源的專案／pattern 執行建置。待上游修補後重新驗證，不使用 audit fix --force 強制降版破壞工具鏈。

## 官方文件

- [Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [vinext](https://github.com/cloudflare/vinext)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
