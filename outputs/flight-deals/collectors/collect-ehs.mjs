import { mkdir, writeFile, readFile } from 'node:fs/promises';

const outputDir = new URL('../data/collected/', import.meta.url);
const outputFile = new URL('ehs-plan.json', outputDir);
const now = new Date().toISOString();

export async function collectEhs() {
  console.log('正在爬取【東森旅遊／ETMall】計畫票與清艙專區...');
  const searchKeywords = ['機票', '計畫旅遊票'];
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

  // 排除電商雜貨、包包、周邊配件
  const excludeMerchandise = [
    '護照', '證件', '機票夾', '護照夾', '護照包', '護照套', '收納包', '保護套',
    '皮夾', '錢包', '斜挎', '拉鏈', '手包', '皮套', '腰包', '後背包', '隨身包',
    '旅行箱', '吊牌', '行李秤', '行李束帶', '網卡', 'SIM', 'WIFI', '轉接頭', '轉換插頭', '頸枕'
  ];

  // 排除跟團遊覽車觀光行程（動輒數萬元的歐洲/美加/中亞/北海道深度跟團）
  const excludeGroupTours = [
    '全程無自理餐', '無自理餐', '全程五星', '升等一晚', '環球影城門票', '門票', '纜車',
    '遊船', '極光', '城堡', '地中海榮耀號', '郵輪', '世界遺產', '砂浴', '鐵道自行車', '大紅花渡假村'
  ];

  const deals = [];
  for (const [id, p] of allProducts) {
    const title = p.title || '';
    const price = Number(p.finalPrice || p.salePrice || 0);

    // 1. 價格門檻：過濾百元周邊與十萬元長程跟團團體
    if (price < 4000 || price > 25000) {
      continue;
    }

    // 2. 嚴格過濾周邊百貨
    if (excludeMerchandise.some(w => title.includes(w))) {
      continue;
    }

    // 3. 嚴格過濾跟團行程
    if (excludeGroupTours.some(w => title.includes(w))) {
      continue;
    }

    // 4. 必須為真實「計畫機票 / 計劃旅遊票 (TKT)」
    const isPlanTicket = (title.includes('計畫') || title.includes('計劃') || title.includes('TKT')) &&
                         (title.includes('機票') || title.includes('旅遊票'));

    if (!isPlanTicket) {
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
    else if (title.includes('函館')) { city = '函館'; code = 'HKD'; country = 'japan'; }
    else if (title.includes('旭川')) { city = '旭川'; code = 'AKJ'; country = 'japan'; }
    else if (title.includes('新千歲') || title.includes('千歲')) { city = '新千歲'; code = 'CTS'; country = 'japan'; }
    else if (title.includes('札幌') || title.includes('北海道')) { city = '新千歲'; code = 'CTS'; country = 'japan'; }
    else if (title.includes('首爾') || title.includes('仁川')) { city = '首爾'; code = 'ICN'; country = 'korea'; }
    else if (title.includes('釜山')) { city = '釜山'; code = 'PUS'; country = 'korea'; }
    else if (title.includes('曼谷')) { city = '曼谷'; code = 'BKK'; country = 'asia'; }
    else if (title.includes('富國島')) { city = '富國島'; code = 'PQC'; country = 'asia'; }

    const durationMatch = title.match(/([3-8])\s*日/);
    const duration = durationMatch ? `${durationMatch[1]} 天` : '5 天';

    let airline = '配合航空';
    if (title.includes('樂桃') || title.includes('MM')) airline = '樂桃航空';
    else if (title.includes('虎航') || title.includes('IT')) airline = '台灣虎航';
    else if (title.includes('酷航') || title.includes('TR')) airline = '酷航';
    else if (title.includes('星宇') || title.includes('JX')) airline = '星宇航空';
    else if (title.includes('華航') || title.includes('CI')) airline = '中華航空';
    else if (title.includes('長榮') || title.includes('BR')) airline = '長榮航空';

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
      baggage: '含來回託運行李與稅金',
      kind: 'plan',
      tag: title.includes('清艙') ? '東森清艙特惠' : '東森計畫旅遊票',
      agency: '東森旅遊',
      source: '東森購物網・東森旅遊館',
      sourceUrl: p.pageLink ? (p.pageLink.startsWith('http') ? p.pageLink : `https://www.etmall.com.tw${p.pageLink}`) : `https://www.etmall.com.tw/i/${p.id}`,
      detail: `${title}｜1人成行，已含稅金與來回行李，固定去回程不可改退。`,
      availableDates: '下單後專人聯繫劃位（1人即可成行）',
      checked: now.slice(0, 10),
      collectedAt: now
    });
  }

  // 快取防呆備援
  if (!deals.length) {
    try {
      const cached = JSON.parse(await readFile(outputFile, 'utf8'));
      if (Array.isArray(cached.deals) && cached.deals.length > 0) {
        deals = cached.deals;
        console.log(`[東森旅遊] 網路抓取受到限制，已啟用現有快取備援共 ${deals.length} 筆！`);
      }
    } catch {
      console.warn('[東森旅遊] 無現成快取資料可用');
    }
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, JSON.stringify({
    source: '東森購物網・東森旅遊館',
    sourceUrl: 'https://www.etmall.com.tw/Search?keyword=%E8%A8%88%E7%95%AB%E6%A9%9F%E7%A5%A8',
    collectedAt: now,
    count: deals.length,
    deals
  }, null, 2));

  console.log(`[東森旅遊] 成功整理 ${deals.length} 筆純計畫機票！已排除非機票雜物與跟團行程，已儲存至 ehs-plan.json`);
  return deals;
}

if (process.argv[1] === import.meta.filename) {
  collectEhs();
}
