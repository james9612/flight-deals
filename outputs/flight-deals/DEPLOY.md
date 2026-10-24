# 部署指南：自動蒐集 + 網站發布

此專案使用 GitHub Pages 發布前台，GitHub Actions 每天自動執行飛遊網清艙票蒐集器，完成後直接部署當次的網站資料。

## 1. 建立 GitHub 儲存庫

1. 登入 GitHub，建立一個新的 **Public repository**，例如 `flight-deals`。
2. 將 `new-chat` 資料夾內的檔案推送到該儲存庫的 `main` 分支。
3. 確認 `.github/workflows/deploy.yml`、`outputs/flight-deals/` 都已推送。

## 2. 開啟 GitHub Pages

1. 在儲存庫點 **Settings**。
2. 點左側 **Pages**。
3. 在 **Build and deployment** 的 **Source** 選擇 **GitHub Actions**。
4. 回到 **Actions** 頁面，選擇 `Collect deals and deploy site`，按 **Run workflow** 執行第一次。

完成後，Actions 的部署步驟會顯示網站網址。每次推送到 `main` 都會更新網站；排程每天台灣時間約 09:15 執行一次。

## 3. 本機先測試蒐集器

在 `outputs/flight-deals` 資料夾執行：

```powershell
npm install
npx playwright install chromium
npm run collect
```

蒐集結果會寫入 `data/collected/plynet-clearance.json`，再合併到 `data/deals.json`。用本機 HTTP 伺服器開啟網站，例如：

```powershell
npx serve .
```

瀏覽器進入終端機顯示的網址後，前台會讀取最新的 `data/deals.json`。

## 4. 新增其他來源

每個新來源新增一個 `collectors/collect-來源.mjs`，輸出相同欄位格式。再將其加入 `package.json` 的 `collect` 指令與 `collectors/merge-collected.mjs`。來源需要能公開讀取，且前台要保留原始連結與擷取時間。

