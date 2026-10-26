import { mkdir, writeFile, readFile } from 'node:fs/promises';

const outputDir = new URL('../data/collected/', import.meta.url);
const outputFile = new URL('funtime-plan.json', outputDir);
const now = new Date().toISOString();

export async function collectFuntime() {
  console.log('正在爬取【FunTime旅遊比價網】localtour 計畫機票專區...');
  const targets = ['Japan', 'Korea', 'Thailand', 'Vietnam'];
  let allDeals = [];
  let index = 0;

  for (const t of targets) {
    try {
      const url = `https://www.funtime.com.tw/localtour/topic/api_index.php?theme=GroupAffinity-Ticket&target=${t}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': `https://www.funtime.com.tw/localtour/topic/index.php?theme=GroupAffinity-Ticket&target=${t}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!res.ok) {
        console.warn(`[FunTime] 抓取目標 "${t}" 回傳狀態碼: ${res.status}`);
        continue;
      }
      const data = await res.json();
      const blocks = data.data_detail?.block || [];

      for (const b of blocks) {
        // Skip informational blog / travel guide blocks
        if ((b.name || '').includes('攻略') || (b.name || '').includes('介紹')) continue;

        const goods = b.goods || [];
        for (const g of goods) {
          const price = Number(g.price || 0);
          const priceStr = g.price_str || '';
          const title = g.title || '';
          const rawUrl = g.url || '';

          // 嚴格過濾：已售完、售罄、已額滿或非正常價格
          if (priceStr.includes('售完') || priceStr.includes('售罄') || priceStr.includes('額滿') ||
              title.includes('售完') || title.includes('額滿') || title.includes('售罄') || title.includes('已滿') ||
              !price || price < 4000) {
            continue;
          }

          // 嚴格過濾：已知已售罄／無法購買的黑名單商品（如 KKday 247091 等失效專案）
          // 以及過期的行銷導購（KKday 計畫機票生命週期短，FunTime 專題常年未更新導致點開皆顯示已售罄）
          if (rawUrl.includes('247091') || rawUrl.includes('travel.gounitravel.com') || rawUrl.includes('kkday.com/zh-tw/product/')) {
            continue;
          }
          index++;
          let city = b.sub_title || '精選航點';
          let code = 'TYO';
          let country = t === 'Japan' ? 'japan' : (t === 'Korea' ? 'korea' : 'asia');

          // Accurate Destination Mapping
          if (title.includes('福島')) { city = '福島'; code = 'FKS'; country = 'japan'; }
          else if (title.includes('高松')) { city = '高松'; code = 'TAK'; country = 'japan'; }
          else if (title.includes('小松')) { city = '小松'; code = 'KMQ'; country = 'japan'; }
          else if (title.includes('石垣島') || title.includes('宮古島')) { city = '石垣島'; code = 'ISG'; country = 'japan'; }
          else if (title.includes('沖繩') || title.includes('那霸')) { city = '沖繩'; code = 'OKA'; country = 'japan'; }
          else if (title.includes('函館')) { city = '函館'; code = 'HKD'; country = 'japan'; }
          else if (title.includes('北海道') || title.includes('札幌') || title.includes('千歲')) { city = '北海道'; code = 'CTS'; country = 'japan'; }
          else if (title.includes('東京') || title.includes('成田') || title.includes('羽田')) { city = '東京'; code = 'TYO'; country = 'japan'; }
          else if (title.includes('大阪') || title.includes('關西')) { city = '大阪'; code = 'OSA'; country = 'japan'; }
          else if (title.includes('名古屋')) { city = '名古屋'; code = 'NGO'; country = 'japan'; }
          else if (title.includes('福岡') || title.includes('九州')) { city = '福岡'; code = 'FUK'; country = 'japan'; }
          else if (title.includes('首爾') || title.includes('仁川') || title.includes('金浦')) { city = '首爾'; code = 'ICN'; country = 'korea'; }
          else if (title.includes('釜山')) { city = '釜山'; code = 'PUS'; country = 'korea'; }
          else if (title.includes('濟州')) { city = '濟州'; code = 'CJU'; country = 'korea'; }
          else if (title.includes('大邱')) { city = '大邱'; code = 'TAE'; country = 'korea'; }
          else if (title.includes('清州')) { city = '清州'; code = 'CJJ'; country = 'korea'; }
          else if (title.includes('曼谷')) { city = '曼谷'; code = 'BKK'; country = 'asia'; }
          else if (title.includes('清邁')) { city = '清邁'; code = 'CNX'; country = 'asia'; }
          else if (title.includes('富國島')) { city = '富國島'; code = 'PQC'; country = 'asia'; }
          else if (title.includes('峴港')) { city = '峴港'; code = 'DAD'; country = 'asia'; }
          else if (city.includes('沖繩')) { city = '沖繩'; code = 'OKA'; country = 'japan'; }
          else if (city.includes('東京')) { city = '東京'; code = 'TYO'; country = 'japan'; }
          else if (city.includes('大阪')) { city = '大阪'; code = 'OSA'; country = 'japan'; }
          else if (city.includes('首爾')) { city = '首爾'; code = 'ICN'; country = 'korea'; }
          else if (city === '其他城市') { city = '首爾'; code = 'ICN'; country = 'korea'; }

          // Extract origin from title
          const from = title.includes('高雄出發') || title.includes('高雄') ? '高雄' : (title.includes('台中出發') || title.includes('台中') ? '台中' : '台北');
          const fc = from === '高雄' ? 'KHH' : (from === '台中' ? 'RMQ' : 'TPE');

          // Extract duration
          const durationMatch = title.match(/([3-8])\s*(?:日|天)/);
          const days = durationMatch ? Number(durationMatch[1]) : 5;
          const duration = `${days} 天`;

          // Accurate Airline Parsing
          let airline = '精選航空';
          if (title.includes('樂桃') || title.includes('MM')) airline = '樂桃航空';
          else if (title.includes('虎航') || title.includes('IT')) airline = '台灣虎航';
          else if (title.includes('酷航') || title.includes('TR')) airline = '酷航';
          else if (title.includes('易斯達') || title.includes('ZE')) airline = '易斯達航空';
          else if (title.includes('德威') || title.includes('泰瑞') || title.includes('TW')) airline = '德威航空';
          else if (title.includes('釜山航空') || title.includes('BX')) airline = '釜山航空';
          else if (title.includes('真航空') || title.includes('LJ')) airline = '真航空';
          else if (title.includes('濟州航空') || title.includes('7C')) airline = '濟州航空';
          else if (title.includes('韓亞') || title.includes('OZ')) airline = '韓亞航空';
          else if (title.includes('泰越捷') || title.includes('越捷') || title.includes('VJ')) airline = '越捷航空';
          else if (title.includes('亞洲航空') || title.includes('亞航') || title.includes('AirAsia') || title.includes('AK') || title.includes('FD')) airline = '亞洲航空';
          else if (title.includes('星宇') || title.includes('JX')) airline = '星宇航空';
          else if (title.includes('中華航空') || title.includes('華航') || title.includes('CI')) airline = '中華航空';
          else if (title.includes('長榮') || title.includes('BR')) airline = '長榮航空';

          // Accurate Schedule & Flight Timing
          const schedule = title.includes('早去晚回') ? '早去晚回直飛' :
            (title.includes('早去午回') ? '早去午回直飛' :
            (title.includes('午去晚回') ? '午去晚回直飛' :
            (title.includes('早去早回') ? '早去早回直飛' : '每日正班直飛')));

          // Check if title has explicit departure date (e.g. 11/20出發, 12/5出發)
          const titleDateMatch = title.match(/(?:【|\(|\[)?([0-1]?[0-9])[\/\.月]([0-3]?[0-9])(?:日)?(?:\s*出發)?(?:】|\)|\])?/);
          const hasRangeOrMulti = title.includes('~') || title.includes('～') || title.includes('至') || title.includes('4-6') || title.includes('4~6') || title.includes('5-6');

          let departDate = '';
          let returnDate = '';
          let dateStr = '';
          let availableDates = '';

          if (titleDateMatch && !hasRangeOrMulti) {
            const m = titleDateMatch[1].padStart(2, '0');
            const d = titleDateMatch[2].padStart(2, '0');
            const curY = new Date().getFullYear();
            departDate = `${curY}-${m}-${d}`;
            const retD = new Date(departDate);
            retD.setDate(retD.getDate() + (days - 1));
            returnDate = retD.toISOString().slice(0, 10);
            dateStr = `${m}/${d} – ${returnDate.slice(5).replace('-', '/')}（${schedule}）`;
            availableDates = `指定固定梯次：${m}/${d} 出發，${duration}`;
          } else {
            // Multi-batch plan ticket package: transparently guide users to supplier calendar
            departDate = '';
            returnDate = '';
            dateStr = `${duration}・多梯次可選（依預訂頁為準）`;
            availableDates = '此商品包含多個出發梯次，點擊「前往預訂」即可查看供應商最新日曆與即時餘位';
          }

          // Accurate Baggage
          const baggage = (title.includes('含餐') && title.includes('含行李')) ? '含機上餐＋來回20KG行李' :
            (title.includes('20') ? '含來回 20KG 託運行李' :
            (title.includes('15') ? '含來回 15KG 託運行李' : '含來回託運行李'));

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
            depart: departDate,
            return: returnDate,
            duration,
            date: dateStr,
            airline,
            air: airline,
            baggage,
            kind: 'plan',
            tag: 'FunTime計畫機票',
            agency: 'FunTime',
            source: 'FunTime旅遊比價網（localtour）',
            sourceUrl: g.url ? (g.url.startsWith('http') ? g.url : `https://www.funtime.com.tw${g.url}`) : 'https://www.funtime.com.tw/localtour/',
            detail: `${title}｜${airline}直飛，含稅金與行李。此為 FunTime 彙整之多梯次計畫機票，實際可售出發日與即時剩餘機位以跳轉後的供應商預訂頁為準。`,
            availableDates,
            checked: now.slice(0, 10),
            collectedAt: now
          });
        }
      }
    } catch (err) {
      console.warn(`[FunTime] 抓取目標 "${t}" 時發生錯誤:`, err.message);
    }
  }

  // 快取防呆備援：若遠端伺服器阻擋海外/CI IP 導致 0 筆，自動保留現有快取資料
  if (!allDeals.length) {
    try {
      const cached = JSON.parse(await readFile(outputFile, 'utf8'));
      if (Array.isArray(cached.deals) && cached.deals.length > 0) {
        allDeals = cached.deals;
        console.log(`[FunTime] 網路抓取受到限制，已啟用現有快取備援共 ${allDeals.length} 筆！`);
      }
    } catch {
      console.warn('[FunTime] 無現成快取資料可用');
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
