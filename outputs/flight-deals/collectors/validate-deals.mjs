import { readFile, writeFile } from 'node:fs/promises';

const dealsFile = new URL('../data/deals.json', import.meta.url);

/**
 * 檢查單筆機票產品是否有效、未過期且可購買
 * 回傳 { active: boolean, reason?: string, normalizedUrl?: string }
 */
export async function isDealActive(deal, todayStr = new Date().toISOString().slice(0, 10)) {
  // 1. 出發日期過期檢查（出發日在今天以前者直接下架）
  if (deal.depart && deal.depart < todayStr) {
    return { active: false, reason: `出發日期已過期 (${deal.depart} < ${todayStr})` };
  }

  // 2. 無效或死連結 URL 檢查
  if (!deal.sourceUrl || deal.sourceUrl === '#' || deal.sourceUrl.includes('st_flight_inter_search.html')) {
    return { active: false, reason: '無效或死連結 URL' };
  }

  // 3. 標題與說明中的售罄 / 下架關鍵字檢查
  const text = `${deal.title || ''} ${deal.detail || ''} ${deal.availableDates || ''}`;
  if (
    text.includes('已售完') ||
    text.includes('已售罄') ||
    text.includes('已額滿') ||
    text.includes('此商品已下架') ||
    text.includes('此商品目前無法購買') ||
    text.includes('無團號資料') ||
    text.includes('商品已不存在') ||
    text.includes('此商品已完售')
  ) {
    return { active: false, reason: '標題或說明標註已售完或已下架' };
  }

  let normalizedUrl = deal.sourceUrl;

  // 4. 喜鴻假期 (Besttour) 即時庫存與團號檢查
  if ((deal.agency || '').includes('喜鴻') || (deal.sourceUrl || '').includes('besttour.com.tw')) {
    let travelNo = '';
    const itMatch = (deal.sourceUrl || '').match(/\/itinerary\/([A-Za-z0-9_-]+)/);
    const vMatch = (deal.sourceUrl || '').match(/[?&]v=([A-Za-z0-9_-]+)/);
    if (itMatch) travelNo = itMatch[1];
    else if (vMatch) travelNo = vMatch[1];
    else if (deal.id && deal.id.startsWith('besttour-')) travelNo = deal.id.split('-')[1];

    if (travelNo) {
      // 正規化為新版直達商品頁網址，避免舊版 e_web/travel 的 JS ReferenceError crash bug
      normalizedUrl = `https://www.besttour.com.tw/itinerary/${travelNo}`;

      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 4000);
        const resp = await fetch(`https://travelapi.besttour.com.tw/api/travel_detail_info.asp?travel_no=${travelNo}`, {
          signal: ctrl.signal
        });
        clearTimeout(timeout);

        if (resp.ok) {
          const json = await resp.json();
          const item = json?.data?.[0];
          if (!item || !item.title_1) {
            return { active: false, reason: `喜鴻官方查無此團號 (${travelNo})` };
          }
          if (Number(item.amount_2) <= 0) {
            return { active: false, reason: `喜鴻官方已無可售名額 (剩餘可售: ${item.amount_2})` };
          }
        }
      } catch (err) {
        // 請求逾時或連線問題不誤刪，保留當前機票
      }
    }
  }

  // 5. momo 購物網即時售罄與下架檢查
  if ((deal.agency || '').includes('momo') && (deal.sourceUrl || '').includes('momoshop.com.tw')) {
    const codeMatch = (deal.sourceUrl || '').match(/i_code=(\d+)/);
    if (codeMatch) {
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 4000);
        const resp = await fetch(deal.sourceUrl, {
          signal: ctrl.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        clearTimeout(timeout);

        if (resp.status === 404 || resp.status === 410) {
          return { active: false, reason: `momo 頁面回傳 HTTP ${resp.status}（商品已不存在）` };
        }
        if (resp.ok) {
          const html = await resp.text();
          if (html.includes('此商品已售完') || html.includes('商品已下架') || html.includes('很抱歉，此商品已完售') || html.includes('此商品不存在')) {
            return { active: false, reason: 'momo 商品頁面顯示已售完或已下架' };
          }
        }
      } catch (err) {
        // 請求逾時或連線問題不誤刪
      }
    }
  }

  return { active: true, normalizedUrl };
}

/**
 * 批次巡檢與清洗機票清單，自動下架失效商品
 */
export async function validateAndCleanDeals(deals) {
  console.log(`[全網機票即時巡檢] 正在執行每日商品頁存活與售罄檢查 (共 ${deals.length} 筆)...`);
  const activeDeals = [];
  const delisted = [];
  const todayStr = new Date().toISOString().slice(0, 10);

  // 限制同時檢查連線數，避免瞬間發出過多請求
  const BATCH_SIZE = 15;
  for (let i = 0; i < deals.length; i += BATCH_SIZE) {
    const batch = deals.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(d => isDealActive(d, todayStr)));

    for (let j = 0; j < batch.length; j++) {
      const deal = batch[j];
      const res = results[j];
      if (res.active) {
        if (res.normalizedUrl && res.normalizedUrl !== deal.sourceUrl) {
          activeDeals.push({ ...deal, sourceUrl: res.normalizedUrl });
        } else {
          activeDeals.push(deal);
        }
      } else {
        delisted.push({ id: deal.id, agency: deal.agency, reason: res.reason });
      }
    }
  }

  if (delisted.length > 0) {
    console.log(`[自動下架報告] 成功自動下架 ${delisted.length} 筆失效、售罄或過期商品：`);
    delisted.slice(0, 10).forEach(d => console.log(`  - [${d.agency}] ID: ${d.id} 原因: ${d.reason}`));
    if (delisted.length > 10) console.log(`  ... 其餘 ${delisted.length - 10} 筆已一併移除`);
  } else {
    console.log('[自動下架報告] 全數商品連結與庫存檢查完畢，無失效或售罄項目。');
  }

  return activeDeals;
}

// 支援直接獨立執行：node collectors/validate-deals.mjs
if (process.argv[1] && process.argv[1].endsWith('validate-deals.mjs')) {
  try {
    const raw = await readFile(dealsFile, 'utf8');
    const deals = JSON.parse(raw);
    const cleaned = await validateAndCleanDeals(deals);
    await writeFile(dealsFile, JSON.stringify(cleaned, null, 2), 'utf8');
    console.log(`[巡檢完成] deals.json 已更新，剩餘 ${cleaned.length} 筆在售可購機票。`);
  } catch (err) {
    console.error('執行巡檢時發生錯誤:', err);
    process.exit(1);
  }
}
