import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.resolve(__dirname, '../data/collected/momo-deals.json');

const KEYWORDS = ['計畫機票', '計畫票', '機票', '清艙機票'];

const CITY_MAPPING = [
  { match: /東京|成田|羽田/i, name: '東京', code: 'TYO', country: '日本' },
  { match: /大阪|關西/i, name: '大阪', code: 'OSA', country: '日本' },
  { match: /沖繩|那霸/i, name: '沖繩', code: 'OKA', country: '日本' },
  { match: /福岡/i, name: '福岡', code: 'FUK', country: '日本' },
  { match: /札幌|北海道|新千歲/i, name: '札幌', code: 'SPK', country: '日本' },
  { match: /名古屋/i, name: '名古屋', code: 'NGO', country: '日本' },
  { match: /石垣島|石垣/i, name: '石垣島', code: 'ISG', country: '日本' },
  { match: /秋田/i, name: '秋田', code: 'AXT', country: '日本' },
  { match: /高知/i, name: '高知', code: 'KCZ', country: '日本' },
  { match: /首爾|仁川|金浦/i, name: '首爾', code: 'SEL', country: '韓國' },
  { match: /釜山/i, name: '釜山', code: 'PUS', country: '韓國' },
  { match: /濟州/i, name: '濟州', code: 'CJU', country: '韓國' },
  { match: /曼谷/i, name: '曼谷', code: 'BKK', country: '泰國' },
  { match: /清邁/i, name: '清邁', code: 'CNX', country: '泰國' },
  { match: /普吉/i, name: '普吉島', code: 'HKT', country: '泰國' },
  { match: /峴港/i, name: '峴港', code: 'DAD', country: '越南' },
  { match: /富國島/i, name: '富國島', code: 'PQC', country: '越南' },
  { match: /宿霧/i, name: '宿霧', code: 'CEB', country: '菲律賓' },
];

const AIRLINE_MAPPING = [
  { match: /樂桃/i, name: '樂桃航空 (MM)' },
  { match: /酷航/i, name: '酷航 (TR)' },
  { match: /虎航/i, name: '台灣虎航 (IT)' },
  { match: /亞航|亞洲航空/i, name: '亞洲航空 (AK)' },
  { match: /濟州航空/i, name: '濟州航空 (7C)' },
  { match: /真航空/i, name: '真航空 (LJ)' },
  { match: /德威/i, name: '德威航空 (TW)' },
  { match: /星宇/i, name: '星宇航空 (JX)' },
  { match: /長榮/i, name: '長榮航空 (BR)' },
  { match: /華航|中華航空/i, name: '中華航空 (CI)' },
  { match: /國泰/i, name: '國泰航空 (CX)' },
  { match: /越捷/i, name: '越捷航空 (VJ)' },
];

export async function collectMomoDeals() {
  console.log('[momo Collector] Starting momo flight deals collector...');
  const dealsMap = new Map();

  for (const kw of KEYWORDS) {
    try {
      const url = `https://m.momoshop.com.tw/search.momo?searchKeyword=${encodeURIComponent(kw)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8'
        }
      });

      if (!res.ok) {
        console.warn(`[momo Collector] Failed to fetch keyword "${kw}": HTTP ${res.status}`);
        continue;
      }

      const html = await res.text();
      const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      if (!ldMatch) continue;

      const data = JSON.parse(ldMatch[1]);
      const graph = data['@graph'] || [data];
      const itemList = graph.find(item => item['@type'] === 'ItemList');
      if (!itemList || !Array.isArray(itemList.itemListElement)) continue;

      for (const el of itemList.itemListElement) {
        const item = el.item || el;
        const name = (item.name || '').trim();
        const rawUrl = item.url || '';
        const price = Number(item.offers?.price) || 0;

        // Extract i_code
        const iCodeMatch = rawUrl.match(/i_code=(\d+)/);
        if (!iCodeMatch) continue;
        const iCode = iCodeMatch[1];
        const directUrl = `https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=${iCode}`;

        // Exclude accessories, guidebooks, baggage tags
        if (!name.includes('機票') && !name.includes('計畫票') && !name.includes('自由行') && !name.includes('航空')) {
          continue;
        }
        if (name.includes('護照') || name.includes('吊牌') || name.includes('防盜') || name.includes('行李秤') || name.includes('旅遊包') || name.includes('網卡') || name.includes('SIM')) {
          continue;
        }

        // Must have reasonable price for a flight (> 3000)
        if (price < 3500) continue;

        // Destination match
        let dest = { name: '熱門航點', code: 'TPE', country: '海外' };
        for (const c of CITY_MAPPING) {
          if (c.match.test(name)) {
            dest = c;
            break;
          }
        }

        // Airline match
        let airline = '合作廉航/國籍航空';
        for (const a of AIRLINE_MAPPING) {
          if (a.match.test(name)) {
            airline = a.name;
            break;
          }
        }

        // Departure origin
        let fromCode = 'TPE';
        let fromCity = '台北/桃園';
        if (/高雄|小港|KHH/i.test(name)) {
          fromCode = 'KHH';
          fromCity = '高雄';
        } else if (/台中|RMQ/i.test(name)) {
          fromCode = 'RMQ';
          fromCity = '台中';
        }

        // Extract duration / days
        let days = 5;
        const daysMatch = name.match(/(\d+)\s*日|(\d+)\s*天/);
        if (daysMatch) {
          days = parseInt(daysMatch[1] || daysMatch[2], 10);
        }

        // Baggage note
        let baggage = '含隨身+託運行李';
        if (name.includes('20公斤') || name.includes('20KG')) {
          baggage = '含20kg托運+7kg手提';
        }

        // Agency supplier
        let agencyName = 'momo 購物網';
        if (name.includes('喜鴻')) {
          agencyName = 'momo 購物網 (喜鴻假期)';
        }

        // Today & future date estimates
        const today = new Date();
        const departDate = new Date(today.getTime() + 14 * 86400000);
        const returnDate = new Date(departDate.getTime() + (days - 1) * 86400000);
        const departStr = departDate.toISOString().slice(0, 10);
        const returnStr = returnDate.toISOString().slice(0, 10);

        const dealId = `momo-${iCode}`;
        if (!dealsMap.has(dealId)) {
          dealsMap.set(dealId, {
            id: dealId,
            source: 'momo-goods',
            agency: agencyName,
            airline: airline,
            flightNumber: '依商品確認',
            from: fromCity,
            fromCode: fromCode,
            to: dest.name,
            toCode: dest.code,
            country: dest.country,
            departDate: departStr,
            returnDate: returnStr,
            durationDays: days,
            tripType: 'roundtrip',
            priceTwd: price,
            isTaxIncluded: true,
            isBaggageIncluded: true,
            baggageNote: baggage,
            ticketType: '計畫機票 / 清艙特惠',
            sourceUrl: directUrl, // 100% direct single-product checkout URL
            lastSeen: new Date().toISOString(),
            rawTitle: name
          });
        }
      }
    } catch (err) {
      console.error(`[momo Collector] Error processing keyword "${kw}":`, err.message);
    }
  }

  const results = Array.from(dealsMap.values());
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');
  console.log(`[momo Collector] Successfully saved ${results.length} direct momo flight deals to ${OUTPUT_FILE}`);
  return results;
}

// Run directly if invoked from command line
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  collectMomoDeals().then(deals => {
    console.log(`Finished momo deals collector: ${deals.length} deals.`);
  });
}
