import { mkdir, writeFile, readFile } from 'node:fs/promises';

const outputDir = new URL('../data/collected/', import.meta.url);
const outputFile = new URL('liontravel-plan.json', outputDir);
const now = new Date().toISOString();

const cityCodeMap = {
  '東京': 'TYO',
  '成田': 'NRT',
  '羽田': 'HND',
  '大阪': 'OSA',
  '關西': 'KIX',
  '沖繩': 'OKA',
  '那霸': 'OKA',
  '名古屋': 'NGO',
  '福岡': 'FUK',
  '新千歲': 'CTS',
  '札幌': 'CTS',
  '函館': 'HKD',
  '旭川': 'AKJ',
  '北海道': 'CTS',
  '首爾': 'ICN',
  '釜山': 'PUS',
  '曼谷': 'BKK',
  '石垣島': 'ISG',
  '澳門': 'MFM',
  '新加坡': 'SIN'
};

const countryMap = {
  '東京': 'japan',
  '大阪': 'japan',
  '沖繩': 'japan',
  '名古屋': 'japan',
  '福岡': 'japan',
  '新千歲': 'japan',
  '札幌': 'japan',
  '函館': 'japan',
  '旭川': 'japan',
  '石垣島': 'japan',
  '首爾': 'korea',
  '釜山': 'korea',
  '曼谷': 'asia',
  '澳門': 'asia',
  '新加坡': 'asia'
};

function extractCity(productName) {
  if (productName.includes('函館')) return '函館';
  if (productName.includes('旭川')) return '旭川';
  if (productName.includes('新千歲') || productName.includes('千歲') || productName.includes('札幌') || productName.includes('北海道')) return '新千歲';
  for (const city of ['東京', '大阪', '沖繩', '名古屋', '福岡', '首爾', '釜山', '石垣島', '澳門', '曼谷']) {
    if (productName.includes(city)) return city;
  }
  return '精選航點';
}

function extractAirline(productName) {
  if (productName.includes('樂桃')) return '樂桃航空';
  if (productName.includes('虎航')) return '台灣虎航';
  if (productName.includes('酷航')) return '酷航';
  if (productName.includes('濟州')) return '濟州航空';
  if (productName.includes('德威')) return '德威航空';
  if (productName.includes('星宇')) return '星宇航空';
  if (productName.includes('長榮')) return '長榮航空';
  if (productName.includes('華航')) return '中華航空';
  if (productName.includes('澳門航空')) return '澳門航空';
  return '精選航空';
}

function extractBaggage(productName) {
  const match = productName.match(/含[^\/]*?(?:\d+K?G?|行李)[^\/|\)]*/i);
  if (match) return match[0].trim();
  if (productName.includes('含行李')) return '含來回託運行李';
  return '含託運行李（依產品規格）';
}

function calculateReturnDate(departDate, days) {
  if (!departDate) return '';
  const d = new Date(departDate);
  d.setDate(d.getDate() + (days - 1));
  return d.toISOString().slice(0, 10);
}

export async function collectLionTravel() {
  const keywords = ['計畫旅遊票', '計畫票', '團體自由行'];
  const allDeals = new Map();

  for (const kw of keywords) {
    try {
      const url = `https://search.liontravel.com/json/searchtravel?keyword=${encodeURIComponent(kw)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://search.liontravel.com/'
        }
      });
      if (!res.ok) continue;
      const json = await res.json();
      const list = json?.DataDetail?.DataList || [];

      for (const item of list) {
        // filter out tours that are not plan tickets
        const name = item.ProductName || '';
        const isPlanTicket = name.includes('計畫') || name.includes('機票') || name.includes('湊票');
        if (!isPlanTicket) continue;

        const city = extractCity(name);
        const airline = extractAirline(name);
        const baggage = extractBaggage(name);
        const days = Number(item.Days) || 5;
        const depart = item.GoDate || '';
        const returnDate = calculateReturnDate(depart, days);
        const code = cityCodeMap[city] || 'INT';
        const country = countryMap[city] || 'asia';

        const deal = {
          id: `lion-${item.ProductID}`,
          productId: item.ProductID,
          title: name,
          city,
          code,
          from: '台北',
          fc: 'TPE',
          country,
          price: item.DirectPrice || item.TradePrice || 0,
          currency: 'TWD',
          depart,
          return: returnDate,
          duration: `${days} 天`,
          date: depart && returnDate ? `${depart.slice(5).replace('-', '/')} – ${returnDate.slice(5).replace('-', '/')}` : `${days} 天計畫票`,
          airline,
          baggage,
          kind: 'plan',
          tag: '雄獅旅遊計畫票',
          source: '雄獅旅遊（Lion Travel）',
          sourceUrl: item.ProductURL || 'https://travel.liontravel.com/',
          imageUrl: item.ImageURL || '',
          availableDates: item.GoDateShow || '',
          detail: `${name}｜含稅金及行李，去回程固定不可改期`,
          checked: now.slice(0, 10),
          collectedAt: now
        };

        allDeals.set(deal.id, deal);
      }
    } catch (err) {
      console.error(`爬取雄獅關鍵字 ${kw} 失敗:`, err.message);
    }
  }

  let results = [...allDeals.values()];

  // 快取防呆備援
  if (!results.length) {
    try {
      const cached = JSON.parse(await readFile(outputFile, 'utf8'));
      if (Array.isArray(cached.deals) && cached.deals.length > 0) {
        results = cached.deals;
        console.log(`[雄獅旅遊] 網路抓取受到限制，已啟用現有快取備援共 ${results.length} 筆！`);
      }
    } catch {
      console.warn('[雄獅旅遊] 無現成快取資料可用');
    }
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, JSON.stringify({
    source: '雄獅旅遊旅遊計畫票專區',
    sourceUrl: 'https://travel.liontravel.com/',
    collectedAt: now,
    count: results.length,
    deals: results
  }, null, 2));

  console.log(`[雄獅旅遊] 成功蒐集 ${results.length} 筆旅遊計畫票！已儲存至 liontravel-plan.json`);
  return results;
}

if (process.argv[1] === import.meta.filename) {
  collectLionTravel();
}
