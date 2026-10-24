# 多平台計畫票 ＆ 0 元機票自動蒐集引擎架構

本專案採模組化資料管線（Pipeline），定期自動爬取各大旅行社的**計畫票／清艙湊票專區**，並同步監控**航空公司 0 元機票與限時大促情報**，經過標準化正規化、比價與去重後，匯總至前台比價資料庫。

---

## 模組結構

| 檔案 | 負責平台 / 功能 | 抓取方式 |
| :--- | :--- | :--- |
| `collect-liontravel.mjs` | **雄獅旅遊（Lion Travel）** 旅遊計畫票專區 | 官方搜尋 API 自動抓取日韓東南亞固定日期、天數、含稅直客價、航班與 20KG 行李 |
| `collect-plynet.mjs` | **飛遊網（Plynet）** 特價清艙機票 | Playwright 點擊清艙日曆，萃取固定出發日、航線、航班、含稅價與行李規定 |
| `collect-colatour.mjs` | **可樂旅遊（Colatour）** 計畫旅遊票／湊票 | 彙整熱門航線固定日期計畫票與團體湊票 |
| `collect-ezfly.mjs` | **易飛網（ezfly）** 神秘清艙機票與湊票 | 萃取晚鳥清艙與自由行湊團機票 |
| `collect-zero-promos.mjs`| **各大廉航 0 元機票與大促特報** | 監控越捷每週 0 元大促、AirAsia Free Seats、虎航 Payday、樂桃 Sale，計算兩地稅費與預估到手總價 |
| `merge-collected.mjs` | **正規化、去重與比價整合管線** | 統一欄位架構，依價格排序，輸出至 `data/deals.json` 與 `data/promos.json` |
| `run-all-collectors.mjs` | **一鍵執行所有採集器** | 依序執行全部爬蟲並自動觸發合併管線 |

---

## 快速執行

在 `outputs/flight-deals/` 目錄下執行：

```bash
# 一鍵執行全部採集與聚合
npm run collect

# 或單獨執行特定採集器
npm run collect:lion     # 爬取雄獅旅遊計畫票
npm run collect:plynet   # 爬取飛遊網清艙票
npm run collect:zero     # 整理航空公司 0 元機票特報
npm run merge            # 執行資料整合管線
```

---

## 自動排程與部署

本專案透過 GitHub Actions（`.github/workflows/deploy.yml`）定時執行 `npm run collect`，自動更新最新資料並重新發布至 GitHub Pages。
