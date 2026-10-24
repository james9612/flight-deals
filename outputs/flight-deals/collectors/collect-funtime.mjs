import { mkdir, writeFile } from 'node:fs/promises';

const outputDir = new URL('../data/collected/', import.meta.url);
const outputFile = new URL('funtime-plan.json', outputDir);
const now = new Date().toISOString();

export async function collectFuntime() {
  console.log('正在爬取【FunTime旅遊比價網】localtour 計畫機票專區...');
  const targets = ['Japan', 'Korea', 'Thailand', 'Vietnam'];
  const allDeals = [];
  let index = 0;

  for (const t of targets) {
    try {
      const url = `https://www.funtime.com.tw/localtour/topic/api_index.php?theme=GroupAffinity-Ticket&target=${t}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `https://www.funtime.com.tw/localtour/topic/index.php?theme=GroupAffinity-Ticket&target=${t}`
        }
      });

      if (!res.ok) continue;
      const data = await res.json();
      const blocks = data.data_detail?.block || [];

      for (const b of blocks) {
        const goods = b.goods || [];
        for (const g of goods) {
          if (g.price_str === '售完' || !g.price) continue;
          index++;

          const title = g.title || '';
          let city = b.sub_title || '精選航點';
          let code = 'TYO';
          let country = t === 'Japan' ? 'japan' : (t === 'Korea' ? 'korea' : 'asia');

          if (title.includes('沖繩') || title.includes('那霸') || city.includes('沖繩')) { city = '沖繩'; code = 'OKA'; country = 'japan'; }
          else if (title.includes('石垣島') || title.includes('宮古島') || city.includes('石垣島')) { city = '石垣島'; code = 'ISG'; country = 'japan'; }
          else if (title.includes('東京') || title.includes('成田') || title.includes('羽田') || city.includes('東京')) { city = '東京'; code = 'TYO'; country = 'japan'; }
          else if (title.includes('大阪') || title.includes('關西') || city.includes('大阪')) { city = '大阪'; code = 'OSA'; country = 'japan'; }
          else if (title.includes('名古屋') || city.includes('名古屋')) { city = '名古屋'; code = 'NGO'; country = 'japan'; }
          else if (title.includes('福岡') || title.includes('九州') || city.includes('九州')) { city = '福岡'; code = 'FUK'; country = 'japan'; }
          else if (title.includes('北海道') || title.includes('札幌') || city.includes('北海道')) { city = '北海道'; code = 'CTS'; country = 'japan'; }
          else if (title.includes('首爾') || title.includes('仁川') || city.includes('首爾')) { city = '首爾'; code = 'ICN'; country = 'korea'; }
          else if (title.includes('釜山') || city.includes('釜山')) { city = '釜山'; code = 'PUS'; country = 'korea'; }
          else if (title.includes('曼谷') || city.includes('曼谷')) { city = '曼谷'; code = 'BKK'; country = 'asia'; }
          else if (title.includes('清邁') || city.includes('清邁')) { city = '清邁'; code = 'CNX'; country = 'asia'; }
          else if (title.includes('富國島') || city.includes('富國島')) { city = '富國島'; code = 'PQC'; country = 'asia'; }
          else if (title.includes('峴港') || city.includes('峴港')) { city = '峴港'; code = 'DAD'; country = 'asia'; }

          // Extract origin from title
          const from = title.includes('高雄出發') ? '高雄' : (title.includes('台中出發') ? '台中' : '台北');
          const fc = from === '高雄' ? 'KHH' : (from === '台中' ? 'RMQ' : 'TPE');

          // Extract duration
          const durationMatch = title.match(/([3-8])\s*(?:日|天)/);
          const duration = durationMatch ? `${durationMatch[1]} 天` : '5 天';

          // Extract airline
          let airline = '精選航空';
          if (title.includes('樂桃') || title.includes('MM')) airline = '樂桃航空';
          else if (title.includes('虎航') || title.includes('IT')) airline = '台灣虎航';
          else if (title.includes('酷航') || title.includes('TR')) airline = '酷航';
          else if (title.includes('亞洲航空') || title.includes('亞航') || title.includes('AirAsia')) airline = '亞洲航空';
          else if (title.includes('星宇') || title.includes('JX')) airline = '星宇航空';
          else if (title.includes('華航') || title.includes('CI')) airline = '中華航空';
          else if (title.includes('長榮') || title.includes('BR')) airline = '長榮航空';
          else if (title.includes('濟州') || title.includes('7C')) airline = '濟州航空';
          else if (title.includes('真航空') || title.includes('LJ')) airline = '真航空';
          else if (title.includes('越捷') || title.includes('VJ')) airline = '越捷航空';

          const baggage = title.includes('含行李') || title.includes('含來回') ? '含來回託運行李' : '依專案說明為準';

          allDeals.push({
            id: `funtime-${index}`,
            productId: `FT-${index}`,
            title,
            city,
            code,
            from,
            fc,
            country,
            price: Number(g.price),
            currency: 'TWD',
            depart: '2026-11-18',
            return: '2026-11-23',
            duration,
            date: '依專案出發日為準',
            airline,
            air: airline,
            baggage,
            kind: 'plan',
            tag: 'FunTime計畫機票',
            agency: 'FunTime',
            source: 'FunTime旅遊比價網（localtour）',
            sourceUrl: g.url ? (g.url.startsWith('http') ? g.url : `https://www.funtime.com.tw${g.url}`) : 'https://www.funtime.com.tw/localtour/',
            detail: `${title}｜FunTime 旅遊比價彙整，點擊直達原始預訂頁`,
            availableDates: '熱門出發日期多梯次可選',
            checked: now.slice(0, 10),
            collectedAt: now
          });
        }
      }
    } catch (err) {
      console.warn(`[FunTime] 抓取目標 "${t}" 時發生錯誤:`, err.message);
    }
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, JSON.stringify({
    source: 'FunTime旅遊比價網 localtour 計畫機票',
    sourceUrl: 'https://www.funtime.com.tw/localtour/topic/index.php?theme=GroupAffinity-Ticket',
    collectedAt: now,
    count: allDeals.length,
    deals: allDeals
  }, null, 2));

  console.log(`[FunTime] 成功整理 ${allDeals.length} 筆計畫機票！已儲存至 funtime-plan.json`);
  return allDeals;
}

if (process.argv[1] === import.meta.filename) {
  collectFuntime();
}
