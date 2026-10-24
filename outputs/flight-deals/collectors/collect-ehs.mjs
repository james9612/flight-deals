import { mkdir, writeFile } from 'node:fs/promises';

const outputDir = new URL('../data/collected/', import.meta.url);
const outputFile = new URL('ehs-plan.json', outputDir);
const now = new Date().toISOString();

export async function collectEhs() {
  console.log('1. 正在爬取【東森旅遊／ETMall】計畫票與清艙專區...');
  const searchKeywords = ['機票', '清艙機票', '自由行'];
  const allProducts = new Map();

  for (const kw of searchKeywords) {
    try {
      const url = `https://www.etmall.com.tw/Search/Get?keyword=${encodeURIComponent(kw)}&PageIndex=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `https://www.etmall.com.tw/Search?keyword=${encodeURIComponent(kw)}`
        }
      });

      if (!res.ok) continue;
      const json = await res.json();
      const products = json?.SearchProductResult?.products || [];
      for (const p of products) {
        if (!allProducts.has(p.id)) {
          allProducts.set(p.id, p);
        }
      }
    } catch (err) {
      console.warn(`[東森旅遊] 關鍵字 "${kw}" 抓取略過:`, err.message);
    }
  }

  const deals = [];
  for (const [id, p] of allProducts) {
    const title = p.title || '';
    // Must be related to flights / charter / plan tickets
    if (!title.includes('機票') && !title.includes('計畫') && !title.includes('自由行') && !title.includes('清艙')) {
      continue;
    }

    // Exclude SIM cards, wifi routers, luggage bags, etc.
    if (title.includes('網卡') || title.includes('SIM') || title.includes('WIFI') || title.includes('行李箱') || title.includes('枕') || title.includes('轉接頭')) {
      continue;
    }

    let city = '國外特惠';
    let code = 'TYO';
    let country = 'japan';

    if (title.includes('沖繩') || title.includes('那霸')) { city = '沖繩'; code = 'OKA'; country = 'japan'; }
    else if (title.includes('石垣島') || title.includes('石垣')) { city = '石垣島'; code = 'ISG'; country = 'japan'; }
    else if (title.includes('東京') || title.includes('成田') || title.includes('羽田')) { city = '東京'; code = 'TYO'; country = 'japan'; }
    else if (title.includes('大阪') || title.includes('關西')) { city = '大阪'; code = 'OSA'; country = 'japan'; }
    else if (title.includes('名古屋')) { city = '名古屋'; code = 'NGO'; country = 'japan'; }
    else if (title.includes('福岡') || title.includes('九州')) { city = '福岡'; code = 'FUK'; country = 'japan'; }
    else if (title.includes('北海道') || title.includes('札幌')) { city = '北海道'; code = 'CTS'; country = 'japan'; }
    else if (title.includes('高知')) { city = '高知'; code = 'KCZ'; country = 'japan'; }
    else if (title.includes('首爾') || title.includes('仁川')) { city = '首爾'; code = 'ICN'; country = 'korea'; }
    else if (title.includes('釜山')) { city = '釜山'; code = 'PUS'; country = 'korea'; }
    else if (title.includes('濟州')) { city = '濟州'; code = 'CJU'; country = 'korea'; }
    else if (title.includes('曼谷')) { city = '曼谷'; code = 'BKK'; country = 'asia'; }
    else if (title.includes('清邁')) { city = '清邁'; code = 'CNX'; country = 'asia'; }
    else if (title.includes('富國島')) { city = '富國島'; code = 'PQC'; country = 'asia'; }
    else if (title.includes('峴港')) { city = '峴港'; code = 'DAD'; country = 'asia'; }
    else if (title.includes('澳門')) { city = '澳門'; code = 'MFM'; country = 'asia'; }

    const durationMatch = title.match(/([3-8])\s*日/);
    const duration = durationMatch ? `${durationMatch[1]} 天` : '5 天';

    let airline = '配合航空';
    if (title.includes('樂桃') || title.includes('MM')) airline = '樂桃航空';
    else if (title.includes('虎航') || title.includes('IT')) airline = '台灣虎航';
    else if (title.includes('酷航') || title.includes('TR')) airline = '酷航';
    else if (title.includes('星宇') || title.includes('JX')) airline = '星宇航空';
    else if (title.includes('華航') || title.includes('CI')) airline = '中華航空';
    else if (title.includes('長榮') || title.includes('BR')) airline = '長榮航空';
    else if (title.includes('德威') || title.includes('TW')) airline = '德威航空';
    else if (title.includes('濟州') || title.includes('7C')) airline = '濟州航空';
    else if (title.includes('真航空') || title.includes('LJ')) airline = '真航空';
    else if (title.includes('越捷') || title.includes('VJ')) airline = '越捷航空';

    const price = Number(p.finalPrice || p.salePrice || 9999);

    deals.push({
      id: `ehs-${p.id}`,
      productId: `EHS-${p.id}`,
      title,
      city,
      code,
      from: '台北',
      fc: 'TPE',
      country,
      price,
      currency: 'TWD',
      depart: '2026-11-15',
      return: '2026-11-20',
      duration,
      date: '依專案梯次指定',
      airline,
      air: airline,
      baggage: title.includes('含行李') ? '含來回託運行李' : (title.includes('廉航') ? '手提7KG+加購行李' : '含來回託運行李'),
      kind: 'plan',
      tag: title.includes('清艙') ? '東森清艙特惠' : '東森計畫旅遊票',
      agency: '東森旅遊',
      source: '東森購物網・東森旅遊館',
      sourceUrl: p.pageLink ? (p.pageLink.startsWith('http') ? p.pageLink : `https://www.etmall.com.tw${p.pageLink}`) : `https://www.etmall.com.tw/i/${p.id}`,
      detail: title,
      availableDates: '下單後專人聯繫劃位（1人即可成行）',
      checked: now.slice(0, 10),
      collectedAt: now
    });
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, JSON.stringify({
    source: '東森購物網・東森旅遊館',
    sourceUrl: 'https://www.etmall.com.tw/Search?keyword=%E6%A9%9F%E7%A5%A8',
    collectedAt: now,
    count: deals.length,
    deals
  }, null, 2));

  console.log(`[東森旅遊] 成功整理 ${deals.length} 筆清艙／計畫機票！已儲存至 ehs-plan.json`);
  return deals;
}

if (process.argv[1] === import.meta.filename) {
  collectEhs();
}
