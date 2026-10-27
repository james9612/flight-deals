import { readFile, writeFile } from 'node:fs/promises';

const dealsFile = new URL('../data/deals.json', import.meta.url);
const promosFile = new URL('../data/promos.json', import.meta.url);

const lionFile = new URL('../data/collected/liontravel-plan.json', import.meta.url);
const flytourFile = new URL('../data/collected/plynet-clearance.json', import.meta.url);
const ezflyFile = new URL('../data/collected/ezfly-plan.json', import.meta.url);
const kkdayFile = new URL('../data/collected/kkday-plan.json', import.meta.url);
const ehsFile = new URL('../data/collected/ehs-plan.json', import.meta.url);
const funtimeFile = new URL('../data/collected/funtime-plan.json', import.meta.url);
const goflytripFile = new URL('../data/collected/goflytrip-deals.json', import.meta.url);
const extendedFile = new URL('../data/collected/extended-deals.json', import.meta.url);
const momoFile = new URL('../data/collected/momo-deals.json', import.meta.url);
const zeroPromosFile = new URL('../data/collected/zero-promos.json', import.meta.url);

async function safeReadJson(fileUrl, fallback = []) {
  try {
    const raw = await readFile(fileUrl, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.deals)) {
      const topCollectedAt = parsed.collectedAt || (parsed.checked ? `${parsed.checked}T00:00:00.000Z` : null);
      return parsed.deals.map(d => ({
        ...d,
        collectedAt: d.collectedAt || topCollectedAt
      }));
    }
    if (Array.isArray(parsed.promos)) return parsed.promos;
    return fallback;
  } catch {
    return fallback;
  }
}

const countryByDestination = {
  東京: 'japan', 成田: 'japan', 羽田: 'japan', 大阪: 'japan', 關西: 'japan',
  沖繩: 'japan', 名古屋: 'japan', 福岡: 'japan', 石垣島: 'japan', 函館: 'japan', 札幌: 'japan', 北海道: 'japan',
  高松: 'japan', 小松: 'japan', 高知: 'japan', 福島: 'japan', 廣島: 'japan', 岡山: 'japan', 大分: 'japan', 佐賀: 'japan',
  秋田: 'japan', 花卷: 'japan', 仙台: 'japan',
  首爾: 'korea', 釜山: 'korea', 仁川: 'korea', 濟州: 'korea', 大邱: 'korea', 清州: 'korea',
  曼谷: 'asia', 香港: 'asia', 新加坡: 'asia', 澳門: 'asia', 清邁: 'asia', 富國島: 'asia', 峴港: 'asia', 普吉島: 'asia'
};

const codeByDestination = {
  東京: 'TYO', 成田: 'NRT', 羽田: 'HND', 大阪: 'OSA', 關西: 'KIX',
  沖繩: 'OKA', 名古屋: 'NGO', 福岡: 'FUK', 石垣島: 'ISG', 函館: 'HKD', 札幌: 'CTS', 北海道: 'CTS',
  高松: 'TAK', 小松: 'KMQ', 高知: 'KCZ', 福島: 'FKS', 廣島: 'HIJ', 岡山: 'OKJ', 大分: 'OIT', 佐賀: 'HSG',
  秋田: 'AXT', 花卷: 'HNA', 仙台: 'SDJ',
  首爾: 'ICN', 釜山: 'PUS', 仁川: 'ICN', 濟州: 'CJU', 大邱: 'TAE', 清州: 'CJJ',
  曼谷: 'BKK', 香港: 'HKG', 新加坡: 'SIN', 澳門: 'MFM', 清邁: 'CNX', 富國島: 'PQC', 峴港: 'DAD', 普吉島: 'HKT'
};

const daysBetween = (depart, returnDate) => {
  if (!depart || !returnDate) return 5;
  return Math.max(1, Math.round((new Date(returnDate) - new Date(depart)) / 86400000));
};

export async function mergeCollected() {
  let lionDeals = await safeReadJson(lionFile);
  let flytourDeals = await safeReadJson(flytourFile);
  let ezflyDeals = await safeReadJson(ezflyFile);
  let kkdayDeals = await safeReadJson(kkdayFile);
  let ehsDeals = await safeReadJson(ehsFile);
  let funtimeDeals = await safeReadJson(funtimeFile);
  let goflytripDeals = await safeReadJson(goflytripFile);
  let extendedDeals = await safeReadJson(extendedFile);
  let momoDeals = await safeReadJson(momoFile);
  const zeroPromos = await safeReadJson(zeroPromosFile);

  // 備援防護：若有任何單一來源因為網路或防爬限制回傳 0 筆，從現有 deals.json 恢復資料（自動排除已知售罄與黑名單商品）
  const BLACKLIST_PATTERNS = ['247091', '135223', '135753', '139265', '175503', '157399', '146962', '137240', 'st_flight_inter_search.html'];
  const isBlacklisted = (d) => BLACKLIST_PATTERNS.some(p => (d.sourceUrl || '').includes(p) || (d.id || '').includes(p));
  const isGarbage = (d) => isBlacklisted(d) ||
    d.city === '精選航點' ||
    d.code === 'INT' ||
    /Facebook\s*Facebook/i.test(`${d.detail || ''} ${d.rawMessage || ''}`) ||
    /萬位追蹤者|正在追蹤|上線狀態指示燈/i.test(`${d.detail || ''} ${d.rawMessage || ''}`) ||
    /聊天室|未讀|陌生訊息|存股日記/i.test(`${d.detail || ''} ${d.rawMessage || ''}`) ||
    /折扣券|折扣碼|現折|領起來|機場接送.*折|指定迷你團/i.test(`${d.detail || ''} ${d.rawMessage || ''}`) ||
    d.agency === '東南旅遊' ||
    d.agency === '可樂旅遊' ||
    (d.agency === '飛趣旅遊' && (!d.depart || Number(d.price) < 2500 || d.airline === '精選航空'));


  const existingDeals = (await safeReadJson(dealsFile)).filter(d => !isGarbage(d));
  if (existingDeals.length > 0) {
    if (!lionDeals.length) lionDeals = existingDeals.filter(d => d.agency === '雄獅旅遊');
    if (!flytourDeals.length) flytourDeals = existingDeals.filter(d => d.agency === '飛遊網');
    if (!ezflyDeals.length) ezflyDeals = existingDeals.filter(d => d.agency === '易飛網');
    // KKday 歷史硬編碼皆已售罄，若無新即時票則不從舊快取復原
    if (!ehsDeals.length) ehsDeals = existingDeals.filter(d => d.agency === '東森旅遊');
    if (!funtimeDeals.length) funtimeDeals = existingDeals.filter(d => d.agency === 'FunTime');
    if (!goflytripDeals.length) goflytripDeals = existingDeals.filter(d => d.agency === '飛趣旅遊');
    if (!extendedDeals.length) extendedDeals = existingDeals.filter(d => ['燦星旅遊', '旅天下', '山富旅遊', '喜鴻假期'].includes(d.agency));
    if (!momoDeals.length) momoDeals = existingDeals.filter(d => (d.agency || '').includes('momo'));
  }


  console.log(`讀取各來源筆數：雄獅 ${lionDeals.length} 筆，飛遊網 ${flytourDeals.length} 筆，易飛網 ${ezflyDeals.length} 筆，KKday ${kkdayDeals.length} 筆，東森旅遊 ${ehsDeals.length} 筆，FunTime ${funtimeDeals.length} 筆，飛趣旅遊 ${goflytripDeals.length} 筆，燦星/旅天下/山富/喜鴻 ${extendedDeals.length} 筆，momo直購單品 ${momoDeals.length} 筆，航空公司特報 ${zeroPromos.length} 筆`);

  // 格式化 momo 直購商品
  const formattedMomoDeals = momoDeals.map(d => {
    const city = d.to || d.city || '精選航點';
    const from = d.from || '台北';
    const code = d.toCode || d.code || codeByDestination[city] || 'INT';
    const fc = d.fromCode || d.fc || (from === '高雄' ? 'KHH' : 'TPE');
    const country = d.country === '日本' ? 'japan' : (d.country === '韓國' ? 'korea' : (countryByDestination[city] || 'asia'));
    const depart = d.departDate || d.depart || '';
    const returnDate = d.returnDate || d.return || '';
    const duration = d.durationDays ? `${d.durationDays} 天` : (d.duration || '5 天');
    const date = (depart && returnDate) ? `${depart.slice(5).replace('-', '/')} – ${returnDate.slice(5).replace('-', '/')}` : (d.date || '精選計畫票');

    return {
      id: d.id,
      city,
      code,
      from,
      fc,
      country,
      price: d.priceTwd || d.price,
      currency: 'TWD',
      depart,
      return: returnDate,
      duration,
      date,
      airline: d.airline || '精選航空',
      air: d.airline || '精選航空',
      baggage: d.baggageNote || d.baggage || '含來回託運 20 公斤',
      source: 'momo購物網',
      sourceUrl: d.sourceUrl, // 100% direct single-product URL!
      tag: (d.rawTitle || '').includes('喜鴻') ? 'momo・喜鴻特惠' : 'momo直達特惠',
      agency: 'momo購物網',
      kind: 'plan',
      detail: d.rawTitle || d.detail || `${city}計畫機票・momo購物網線上直購免排隊`,
      flightTime: (d.rawTitle || '').match(/早去晚回|早去午回|午去晚回|早去早回|午去午回|晚去晚回/) ? (d.rawTitle || '').match(/早去晚回|早去午回|午去晚回|早去早回|午去午回|晚去晚回/)[0] : '',
      checked: d.checked || (d.lastSeen ? d.lastSeen.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      collectedAt: d.lastSeen || d.collectedAt || new Date().toISOString()
    };
  });

  // 智能比價與去重邏輯：FunTime 會先比對其他旅行社已有的商品
  function extractProductKey(url) {
    if (!url) return '';
    const normMatch = url.match(/NormGroupID=([a-zA-Z0-9-]+)/i);
    if (normMatch) return 'norm_' + normMatch[1];
    const kkMatch = url.match(/product\/(\d+)/i);
    if (kkMatch) return 'kk_' + kkMatch[1];
    return '';
  }

  const directDeals = [
    ...lionDeals.map(d => ({ ...d, agency: '雄獅旅遊', tag: '雄獅旅遊計畫票' })),
    ...ezflyDeals.map(d => ({ ...d, agency: '易飛網', tag: d.tag || '易飛網神秘機票' })),
    ...kkdayDeals.map(d => ({ ...d, agency: 'KKday', tag: 'KKday清艙特惠' })),
    ...ehsDeals.map(d => ({ ...d, agency: '東森旅遊', tag: '東森清艙特惠' })),
    ...goflytripDeals.map(d => ({ ...d, agency: '飛趣旅遊', tag: '飛趣旅遊清艙' })),
    ...extendedDeals,
    ...formattedMomoDeals
  ];

  const excludedDirectIds = new Set();
  const filteredFuntimeDeals = [];
  let cheaperCount = 0;
  let discardedCount = 0;
  let uniqueCount = 0;

  for (const f of funtimeDeals) {
    const fKey = extractProductKey(f.sourceUrl);
    const fTitle = (f.title || '').trim();

    let matched = null;
    for (const d of directDeals) {
      const dKey = extractProductKey(d.sourceUrl);
      if (fKey && dKey && fKey === dKey) {
        matched = d;
        break;
      }
      const dTitle = (d.title || '').trim();
      if (fTitle && dTitle && (fTitle === dTitle || (fTitle.length > 8 && dTitle.length > 8 && (fTitle.includes(dTitle) || dTitle.includes(fTitle))))) {
        matched = d;
        break;
      }
    }

    if (matched) {
      if (f.price < matched.price) {
        // FunTime 較便宜！保留 FunTime 並標記現省金額，剔除原旅行社較貴項目
        cheaperCount++;
        excludedDirectIds.add(matched.id);
        filteredFuntimeDeals.push({
          ...f,
          originalPrice: matched.price,
          priceSaved: matched.price - f.price,
          comparedAgency: matched.agency,
          tag: `🔥 比價現省 $${(matched.price - f.price).toLocaleString()}`,
          agency: 'FunTime'
        });
      } else {
        // FunTime 同價或較貴，不顯示該重複項
        discardedCount++;
      }
    } else {
      // 獨家特惠，保留展示
      uniqueCount++;
      filteredFuntimeDeals.push({
        ...f,
        agency: 'FunTime',
        tag: 'FunTime計畫機票'
      });
    }
  }

  console.log(`[FunTime 智能比價] 比原旅行社更便宜: ${cheaperCount} 筆，同價或較貴自動剔除: ${discardedCount} 筆，獨家特惠: ${uniqueCount} 筆`);

  const allRawDeals = [
    // 加入未被便宜 FunTime 替換的原旅行社機票
    ...directDeals.filter(d => !excludedDirectIds.has(d.id)),
    // 加入經比價篩選後的 FunTime 機票
    ...filteredFuntimeDeals,
    // 加入飛遊網清艙日曆機票
    ...flytourDeals.map(d => {
      const city = d.city || d.destination || '精選航點';
      const from = d.from || (d.origin === '桃園' ? '台北' : (d.origin || '台北'));
      const code = d.code || codeByDestination[city] || 'INT';
      const fc = d.fc || (from === '高雄' ? 'KHH' : (from === '台中' ? 'RMQ' : 'TPE'));
      const country = d.country || countryByDestination[city] || 'asia';
      return {
        id: d.id,
        city,
        code,
        from,
        fc,
        country,
        price: d.price,
        depart: d.depart,
        return: d.return,
        duration: d.duration || `${daysBetween(d.depart, d.return)} 天`,
        date: d.date || (d.depart && d.return ? `${d.depart.slice(5).replace('-', '/')} – ${d.return.slice(5).replace('-', '/')}` : '清艙特惠票'),
        airline: d.airline || d.air || '特價清艙航空',
        air: d.airline || d.air || '特價清艙航空',
        baggage: d.baggage || '含託運行李',
        source: d.source || '飛遊網特價清艙',
        sourceUrl: 'https://www.plynet.com.tw/',
        flightTime: d.flightTime || '',
        checked: d.checked || (d.collectedAt ? d.collectedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
        collectedAt: d.collectedAt || new Date().toISOString(),
        tag: '飛遊網清艙日曆',

        agency: '飛遊網',
        kind: 'plan',
        detail: d.detail || `${d.title || ''}｜飛遊網特價清艙，去回程固定不可改期。點擊直接前往飛遊網官網查看完整機票與出發日曆！`
      };
    })
  ];

  const todayStr = new Date().toISOString().slice(0, 10);
  const byId = new Map();
  for (const deal of allRawDeals) {
    // 1. 過期機票自動排除（出發日期已小於今天）
    if (deal.depart && deal.depart < todayStr) continue;

    // 2. 排除死連結或無效 URL（如已失效的舊版 404 搜尋頁）
    if (!deal.sourceUrl || deal.sourceUrl === '#' || deal.sourceUrl.includes('st_flight_inter_search.html')) continue;

    // 3. 排除已知售罄、無法購買、或死鏈之黑名單商品（如 KKday 247091 等舊行銷活動）
    if (isBlacklisted(deal)) continue;

    // 4. 排除標題或說明中明確標記已售完、售罄、已額滿的項目
    const textToCheck = `${deal.title || ''} ${deal.detail || ''} ${deal.availableDates || ''}`;
    if (textToCheck.includes('已售完') || textToCheck.includes('已售罄') || textToCheck.includes('已額滿') || textToCheck.includes('此商品已下架') || textToCheck.includes('此商品目前無法購買')) {
      continue;
    }

    // 5. 排除無具體航點的虛構假卡片（如「精選航點 / INT」）
    if (deal.city === '精選航點' || deal.code === 'INT') continue;

    // 6. 排除被社群粉專簡介、導航雜訊或重複 Facebook 標籤污染之無效項目
    const fullText = `${deal.title || ''} ${deal.detail || ''} ${deal.rawMessage || ''}`;
    if (
      /Facebook\s*Facebook/i.test(fullText) ||
      /萬位追蹤者|正在追蹤|上線狀態指示燈/i.test(fullText) ||
      (deal.detail && (deal.detail.match(/Facebook/gi) || []).length >= 3)
    ) {
      continue;
    }

    // 7. 排除聊天室側邊欄聯絡人列表與未讀清單雜訊，以及折價券廣告、無出發日機票
    if (
      /聊天室|未讀|陌生訊息|存股日記/i.test(fullText) ||
      /折扣券|折扣碼|現折|領起來|機場接送.*折|指定迷你團/i.test(fullText) ||
      (deal.agency === '飛趣旅遊' && (!deal.depart || Number(deal.price) < 2500 || deal.airline === '精選航空'))
    ) {
      continue;
    }


    // 8. 價格有效性檢查
    if (!deal.price || Number(deal.price) < 1000) continue;

    const city = deal.city || deal.destination || '精選航點';
    const normalized = {
      id: deal.id,
      city,
      code: deal.code || codeByDestination[city] || 'INT',
      from: deal.from || '台北',
      fc: deal.fc || 'TPE',
      country: deal.country || countryByDestination[city] || 'asia',
      price: Number(deal.price) || 0,
      currency: deal.currency || 'TWD',
      depart: deal.depart || '',
      return: deal.return || '',
      duration: deal.duration || '5 天',
      date: deal.date || (deal.depart && deal.return ? `${deal.depart.slice(5).replace('-', '/')} – ${deal.return.slice(5).replace('-', '/')}` : '固定天數計畫票'),
      airline: deal.airline || deal.air || '精選航空',
      air: deal.airline || deal.air || '精選航空',
      baggage: deal.baggage || '含來回託運行李',
      source: deal.source || '旅行社計畫票',
      sourceUrl: deal.sourceUrl || '#',
      checked: deal.checked || new Date().toISOString().slice(0, 10),
      collectedAt: deal.collectedAt || (deal.checked ? `${deal.checked}T00:00:00.000Z` : new Date().toISOString()),
      updatedAt: deal.collectedAt || (deal.checked ? `${deal.checked}T00:00:00.000Z` : new Date().toISOString()),
      tag: deal.tag || '旅行社計畫票',

      agency: deal.agency || '旅行社',
      kind: 'plan',
      detail: deal.detail || `${deal.title || ''}｜含稅金與行李，固定去回程不可改期`,
      availableDates: deal.availableDates || '',
      flightTime: deal.flightTime || (deal.detail && deal.detail.match(/早去晚回|早去午回|午去晚回|早去早回|午去午回|晚去晚回/) ? deal.detail.match(/早去晚回|早去午回|午去晚回|早去早回|午去午回|晚去晚回/)[0] : '') || '',
      originalPrice: Number(deal.originalPrice) || 0,
      priceSaved: Number(deal.priceSaved) || 0,
      comparedAgency: deal.comparedAgency || ''
    };
    byId.set(normalized.id, normalized);
  }

  const finalDeals = [...byId.values()].sort((a, b) => a.price - b.price);

  await writeFile(dealsFile, JSON.stringify(finalDeals, null, 2));
  console.log(`[整合完成] 成功寫入 ${finalDeals.length} 筆多平台計畫票至 deals.json`);

  if (zeroPromos.length > 0) {
    await writeFile(promosFile, JSON.stringify(zeroPromos, null, 2));
    console.log(`[整合完成] 成功寫入 ${zeroPromos.length} 筆 0 元機票與廉航促銷至 promos.json`);
  }
}

if (process.argv[1] === import.meta.filename) {
  mergeCollected();
}
