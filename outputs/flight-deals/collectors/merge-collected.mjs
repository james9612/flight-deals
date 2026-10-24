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
  高松: 'japan', 小松: 'japan', 高知: 'japan',
  首爾: 'korea', 釜山: 'korea', 仁川: 'korea',
  曼谷: 'asia', 香港: 'asia', 新加坡: 'asia', 澳門: 'asia', 清邁: 'asia', 富國島: 'asia'
};

const codeByDestination = {
  東京: 'TYO', 成田: 'NRT', 羽田: 'HND', 大阪: 'OSA', 關西: 'KIX',
  沖繩: 'OKA', 名古屋: 'NGO', 福岡: 'FUK', 石垣島: 'ISG', 函館: 'HKD', 札幌: 'CTS', 北海道: 'CTS',
  高松: 'TAK', 小松: 'KMQ', 高知: 'KCZ',
  首爾: 'ICN', 釜山: 'PUS', 仁川: 'ICN',
  曼谷: 'BKK', 香港: 'HKG', 新加坡: 'SIN', 澳門: 'MFM', 清邁: 'CNX', 富國島: 'PQC'
};

const daysBetween = (depart, returnDate) => {
  if (!depart || !returnDate) return 5;
  return Math.max(1, Math.round((new Date(returnDate) - new Date(depart)) / 86400000));
};

export async function mergeCollected() {
  const lionDeals = await safeReadJson(lionFile);
  const flytourDeals = await safeReadJson(flytourFile);
  const colatourDeals = await safeReadJson(colatourFile);
  const ezflyDeals = await safeReadJson(ezflyFile);
  const kkdayDeals = await safeReadJson(kkdayFile);
  const ehsDeals = await safeReadJson(ehsFile);
  const settourDeals = await safeReadJson(settourFile);
  const funtimeDeals = await safeReadJson(funtimeFile);
  const zeroPromos = await safeReadJson(zeroPromosFile);

  console.log(`讀取各來源筆數：雄獅 ${lionDeals.length} 筆，飛遊網 ${flytourDeals.length} 筆，可樂 ${colatourDeals.length} 筆，易飛網 ${ezflyDeals.length} 筆，KKday ${kkdayDeals.length} 筆，東森旅遊 ${ehsDeals.length} 筆，東南旅遊 ${settourDeals.length} 筆，FunTime ${funtimeDeals.length} 筆，航空公司特報 ${zeroPromos.length} 筆`);

  const allRawDeals = [
    ...lionDeals.map(d => ({
      ...d,
      agency: '雄獅旅遊',
      tag: '雄獅旅遊計畫票'
    })),
    ...colatourDeals.map(d => ({
      ...d,
      agency: '可樂旅遊',
      tag: '可樂旅遊計畫票'
    })),
    ...ezflyDeals.map(d => ({
      ...d,
      agency: '易飛網',
      tag: '易飛網清艙快閃'
    })),
    ...kkdayDeals.map(d => ({
      ...d,
      agency: 'KKday',
      tag: 'KKday清艙特惠'
    })),
    ...ehsDeals.map(d => ({
      ...d,
      agency: '東森旅遊',
      tag: '東森清艙特惠'
    })),
    ...settourDeals.map(d => ({
      ...d,
      agency: '東南旅遊',
      tag: '東南計畫旅遊票'
    })),
    ...funtimeDeals.map(d => ({
      ...d,
      agency: 'FunTime',
      tag: 'FunTime計畫機票'
    })),
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
        sourceUrl: (d.sourceUrl && !d.sourceUrl.endsWith('plynet.com.tw/')) ? d.sourceUrl : `https://line.me/R/oaMessage/%40msc8686z/?${encodeURIComponent(`您好，我想訂購飛遊網清艙機票：\n【${city} ${d.duration || '5 天'}】${d.title || ''}\n出發日期：${d.depart || ''} ~ ${d.return || ''}\n特惠價格：NT$ ${(d.price || 0).toLocaleString()}\n請問目前還有機位可預訂嗎？`)}`,
        checked: d.checked || (d.collectedAt ? d.collectedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
        tag: '飛遊網清艙日曆',
        agency: '飛遊網',
        kind: 'plan',
        detail: d.detail || `${d.title || ''}｜飛遊網特價清艙，去回程固定不可改期。點擊直達飛遊網官方專人在線開票！`
      };
    })
  ];

  const byId = new Map();
  for (const deal of allRawDeals) {
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
      detail: deal.detail || `${deal.title || ''}｜含稅金與行李，固定去回程不可改期`
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
