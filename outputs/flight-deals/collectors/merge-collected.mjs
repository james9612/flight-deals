import { readFile, writeFile } from 'node:fs/promises';

const dealsFile = new URL('../data/deals.json', import.meta.url);
const promosFile = new URL('../data/promos.json', import.meta.url);

const lionFile = new URL('../data/collected/liontravel-plan.json', import.meta.url);
const flytourFile = new URL('../data/collected/plynet-clearance.json', import.meta.url);
const colatourFile = new URL('../data/collected/colatour-plan.json', import.meta.url);
const ezflyFile = new URL('../data/collected/ezfly-plan.json', import.meta.url);
const kkdayFile = new URL('../data/collected/kkday-plan.json', import.meta.url);
const ehsFile = new URL('../data/collected/ehs-plan.json', import.meta.url);
const settourFile = new URL('../data/collected/settour-plan.json', import.meta.url);
const funtimeFile = new URL('../data/collected/funtime-plan.json', import.meta.url);
const goflytripFile = new URL('../data/collected/goflytrip-deals.json', import.meta.url);
const zeroPromosFile = new URL('../data/collected/zero-promos.json', import.meta.url);

async function safeReadJson(fileUrl, fallback = []) {
  try {
    const raw = await readFile(fileUrl, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.deals)) return parsed.deals;
    if (Array.isArray(parsed.promos)) return parsed.promos;
    return fallback;
  } catch {
    return fallback;
  }
}

const countryByDestination = {
  東京: 'japan', 成田: 'japan', 羽田: 'japan', 大阪: 'japan', 關西: 'japan',
  沖繩: 'japan', 名古屋: 'japan', 福岡: 'japan', 石垣島: 'japan', 函館: 'japan', 札幌: 'japan', 北海道: 'japan',
  高松: 'japan', 小松: 'japan', 高知: 'japan', 福島: 'japan',
  首爾: 'korea', 釜山: 'korea', 仁川: 'korea', 濟州: 'korea', 大邱: 'korea', 清州: 'korea',
  曼谷: 'asia', 香港: 'asia', 新加坡: 'asia', 澳門: 'asia', 清邁: 'asia', 富國島: 'asia', 峴港: 'asia'
};

const codeByDestination = {
  東京: 'TYO', 成田: 'NRT', 羽田: 'HND', 大阪: 'OSA', 關西: 'KIX',
  沖繩: 'OKA', 名古屋: 'NGO', 福岡: 'FUK', 石垣島: 'ISG', 函館: 'HKD', 札幌: 'CTS', 北海道: 'CTS',
  高松: 'TAK', 小松: 'KMQ', 高知: 'KCZ', 福島: 'FKS',
  首爾: 'ICN', 釜山: 'PUS', 仁川: 'ICN', 濟州: 'CJU', 大邱: 'TAE', 清州: 'CJJ',
  曼谷: 'BKK', 香港: 'HKG', 新加坡: 'SIN', 澳門: 'MFM', 清邁: 'CNX', 富國島: 'PQC', 峴港: 'DAD'
};

const daysBetween = (depart, returnDate) => {
  if (!depart || !returnDate) return 5;
  return Math.max(1, Math.round((new Date(returnDate) - new Date(depart)) / 86400000));
};

export async function mergeCollected() {
  let lionDeals = await safeReadJson(lionFile);
  let flytourDeals = await safeReadJson(flytourFile);
  let colatourDeals = await safeReadJson(colatourFile);
  let ezflyDeals = await safeReadJson(ezflyFile);
  let kkdayDeals = await safeReadJson(kkdayFile);
  let ehsDeals = await safeReadJson(ehsFile);
  let settourDeals = await safeReadJson(settourFile);
  let funtimeDeals = await safeReadJson(funtimeFile);
  let goflytripDeals = await safeReadJson(goflytripFile);
  const zeroPromos = await safeReadJson(zeroPromosFile);

  // 備援防護：若有任何單一來源因為網路或防爬限制回傳 0 筆，從現有 deals.json 恢復資料，防止資料被清空
  const existingDeals = await safeReadJson(dealsFile);
  if (existingDeals.length > 0) {
    if (!lionDeals.length) lionDeals = existingDeals.filter(d => d.agency === '雄獅旅遊');
    if (!flytourDeals.length) flytourDeals = existingDeals.filter(d => d.agency === '飛遊網');
    if (!colatourDeals.length) colatourDeals = existingDeals.filter(d => d.agency === '可樂旅遊');
    if (!ezflyDeals.length) ezflyDeals = existingDeals.filter(d => d.agency === '易飛網');
    if (!kkdayDeals.length) kkdayDeals = existingDeals.filter(d => d.agency === 'KKday');
    if (!ehsDeals.length) ehsDeals = existingDeals.filter(d => d.agency === '東森旅遊');
    if (!settourDeals.length) settourDeals = existingDeals.filter(d => d.agency === '東南旅遊');
    if (!funtimeDeals.length) funtimeDeals = existingDeals.filter(d => d.agency === 'FunTime');
    if (!goflytripDeals.length) goflytripDeals = existingDeals.filter(d => d.agency === '飛趣旅遊');
  }

  console.log(`讀取各來源筆數：雄獅 ${lionDeals.length} 筆，飛遊網 ${flytourDeals.length} 筆，可樂 ${colatourDeals.length} 筆，易飛網 ${ezflyDeals.length} 筆，KKday ${kkdayDeals.length} 筆，東森旅遊 ${ehsDeals.length} 筆，東南旅遊 ${settourDeals.length} 筆，FunTime ${funtimeDeals.length} 筆，飛趣旅遊 ${goflytripDeals.length} 筆，航空公司特報 ${zeroPromos.length} 筆`);

  // 智能比價與去重邏輯：FunTime 會先比對其他旅行社已有的商品
  // 1. 若 FunTime 價格更便宜：保留 FunTime，標註現省金額，並剔除原旅行社較貴的重複卡片
  // 2. 若 FunTime 價格相同或較貴：視為無價格優勢的重複項目，直接過濾掉 FunTime
  // 3. 若為其他旅行社沒爬到的獨家票源：保留展示
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
    ...colatourDeals.map(d => ({ ...d, agency: '可樂旅遊', tag: '可樂旅遊計畫票' })),
    ...ezflyDeals.map(d => ({ ...d, agency: '易飛網', tag: d.tag || '易飛網神秘機票' })),
    ...kkdayDeals.map(d => ({ ...d, agency: 'KKday', tag: 'KKday清艙特惠' })),
    ...ehsDeals.map(d => ({ ...d, agency: '東森旅遊', tag: '東森清艙特惠' })),
    ...settourDeals.map(d => ({ ...d, agency: '東南旅遊', tag: '東南計畫旅遊票' })),
    ...goflytripDeals.map(d => ({ ...d, agency: '飛趣旅遊', tag: '飛趣旅遊清艙' }))
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
    // 過期機票自動排除（出發日期已小於今天）
    if (deal.depart && deal.depart < todayStr) continue;

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
