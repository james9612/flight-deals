import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.resolve(__dirname, '../data/collected/ugotravel-deals.json');

const KEYWORDS = [
  '旅天下',
  '沖繩 計畫',
  '大阪 計畫',
  '東京 計畫',
  '花卷 機票',
  '仙台 機票',
  '函館 計畫'
];

const CITY_MAPPING = [
  { match: /東京|成田|羽田/i, name: '東京', code: 'TYO', country: 'japan' },
  { match: /大阪|關西/i, name: '大阪', code: 'OSA', country: 'japan' },
  { match: /沖繩|那霸/i, name: '沖繩', code: 'OKA', country: 'japan' },
  { match: /福岡/i, name: '福岡', code: 'FUK', country: 'japan' },
  { match: /函館/i, name: '函館', code: 'HKD', country: 'japan' },
  { match: /旭川/i, name: '旭川', code: 'AKJ', country: 'japan' },
  { match: /新千歲|千歲|札幌|北海道/i, name: '新千歲', code: 'CTS', country: 'japan' },
  { match: /花卷|岩手/i, name: '花卷', code: 'HNA', country: 'japan' },
  { match: /仙台/i, name: '仙台', code: 'SDJ', country: 'japan' },
  { match: /首爾|仁川/i, name: '首爾', code: 'ICN', country: 'korea' },
  { match: /釜山/i, name: '釜山', code: 'PUS', country: 'korea' }
];

const AIRLINE_MAPPING = [
  { match: /樂桃/i, name: '樂桃航空' },
  { match: /虎航/i, name: '台灣虎航' },
  { match: /酷航/i, name: '酷航' },
  { match: /星宇/i, name: '星宇航空' },
  { match: /長榮/i, name: '長榮航空' },
  { match: /華航/i, name: '中華航空' }
];

export async function collectUgoTravel() {
  console.log('[旅天下 Collector] 正在爬取旅天下（U-Go Travel）直達單品計畫機票...');
  const dealsMap = new Map();

  for (const kw of KEYWORDS) {
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
        const name = (item.ProductName || '').trim();
        const rawUrl = item.ProductURL || '';
        const isUGo = rawUrl.includes('Origin=UNI') || (item.ProductID || '').includes('ZP') || name.includes('旅天下');
        if (!isUGo) continue;

        // Filter for plan tickets / charter flight products
        const isTicketOrPlan = name.includes('機票') || name.includes('計畫') || name.includes('包機');
        if (!isTicketOrPlan) continue;
        if (name.includes('不含機票') || name.includes('機票自理')) continue;

        const directUrl = rawUrl.replace('travel.liontravel.com', 'travel.gounitravel.com');
        const price = Number(item.TradePrice || item.DirectPrice) || 0;
        if (price < 3000) continue;

        // Destination match
        let dest = { name: '熱門航點', code: 'TYO', country: 'japan' };
        for (const c of CITY_MAPPING) {
          if (c.match.test(name)) {
            dest = c;
            break;
          }
        }

        // Airline match
        let airline = '台灣虎航 / 樂桃航空';
        for (const a of AIRLINE_MAPPING) {
          if (a.match.test(name)) {
            airline = a.name;
            break;
          }
        }

        const days = Number(item.Days) || 5;
        const depart = item.GoDate || '';
        let returnDate = '';
        if (depart) {
          const d = new Date(depart);
          d.setDate(d.getDate() + (days - 1));
          returnDate = d.toISOString().slice(0, 10);
        }

        // Baggage
        let baggage = '含來回託運 20 公斤';
        if (name.includes('含行李') || name.includes('托運') || name.includes('託運')) {
          const match = name.match(/含[^\/]*?(?:\d+K?G?|行李)[^\/|\)]*/i);
          if (match) baggage = match[0].trim();
        }

        const id = `ugotravel-${item.ProductID}`;
        if (!dealsMap.has(id)) {
          dealsMap.set(id, {
            id,
            productId: item.ProductID,
            agency: '旅天下',
            title: name,
            city: dest.name,
            code: dest.code,
            country: dest.country,
            from: '台北',
            fc: 'TPE',
            price,
            currency: 'TWD',
            depart,
            return: returnDate,
            duration: `${days} 天`,
            date: depart && returnDate ? `${depart.slice(5).replace('-', '/')} – ${returnDate.slice(5).replace('-', '/')}` : `${days} 天計畫票`,
            airline,
            air: airline,
            baggage,
            source: '旅天下官方網站',
            sourceUrl: directUrl, // 100% direct single-product URL on travel.gounitravel.com
            tag: '旅天下獨家直購',
            kind: 'plan',
            detail: `${name}｜含稅金及託運行李，去回程固定不可改期`,
            flightTime: name.match(/早去晚回|早去午回|午去晚回|早去早回|午去午回|晚去晚回/) ? name.match(/早去晚回|早去午回|午去晚回|早去早回|午去午回|晚去晚回/)[0] : '早去午回',
            checked: new Date().toISOString().slice(0, 10),
            collectedAt: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error(`[旅天下 Collector] 抓取關鍵字 "${kw}" 失敗:`, err.message);
    }
  }

  const results = Array.from(dealsMap.values());
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');
  console.log(`[旅天下 Collector] 成功蒐集 ${results.length} 筆旅天下直達單品機票至 ${OUTPUT_FILE}`);
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  collectUgoTravel();
}
