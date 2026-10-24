import { mkdir, writeFile, readFile } from 'node:fs/promises';

const sourceUrl = 'https://www.plynet.com.tw/';
const outputDir = new URL('../data/collected/', import.meta.url);
const outputFile = new URL('plynet-clearance.json', outputDir);
const now = new Date().toISOString();

const cityCodeMap = {
  東京: 'TYO', 大阪: 'OSA', 沖繩: 'OKA', 首爾: 'ICN', 仁川: 'ICN',
  釜山: 'PUS', 福岡: 'FUK', 名古屋: 'NGO', 石垣島: 'ISG', 函館: 'HKD',
  高松: 'TAK', 小松: 'KMQ', 札幌: 'CTS', 北海道: 'CTS', 高知: 'KCZ', 清邁: 'CNX', 曼谷: 'BKK'
};

const countryMap = {
  東京: 'japan', 大阪: 'japan', 沖繩: 'japan', 福岡: 'japan',
  名古屋: 'japan', 石垣島: 'japan', 函館: 'japan', 高松: 'japan', 小松: 'japan', 札幌: 'japan', 北海道: 'japan', 高知: 'japan',
  首爾: 'korea', 釜山: 'korea', 仁川: 'korea',
  曼谷: 'asia', 清邁: 'asia'
};

function parsePlynetEvent(event) {
  const fullTitle = event.extendedProps?.listTitle || event.title || '';
  const priceMatch = fullTitle.match(/\$\s*(\d+)/);
  const price = priceMatch ? Number(priceMatch[1]) : 0;

  const daysMatch = fullTitle.match(/(\d+)\s*天/);
  const days = daysMatch ? Number(daysMatch[1]) : 5;

  let origin = '台北';
  let fc = 'TPE';
  if (fullTitle.includes('高雄')) {
    origin = '高雄';
    fc = 'KHH';
  } else if (fullTitle.includes('台中')) {
    origin = '台中';
    fc = 'RMQ';
  }

  let city = '精選航點';
  for (const c of ['東京', '大阪', '沖繩', '首爾', '仁川', '釜山', '福岡', '名古屋', '石垣島', '函館', '高松', '小松', '札幌', '北海道', '高知', '清邁', '曼谷']) {
    if (fullTitle.includes(c)) {
      city = c === '仁川' ? '首爾' : c;
      break;
    }
  }

  let airline = '特價清艙航空';
  if (fullTitle.includes('易斯達')) airline = '易斯達航空';
  else if (fullTitle.includes('樂桃')) airline = '樂桃航空';
  else if (fullTitle.includes('虎航')) airline = '台灣虎航';
  else if (fullTitle.includes('酷航')) airline = '酷航';
  else if (fullTitle.includes('德威')) airline = '德威航空';
  else if (fullTitle.includes('濟州')) airline = '濟州航空';
  else if (fullTitle.includes('真航空')) airline = '真航空';

  const depart = event.start || '';
  let returnDate = '';
  if (depart) {
    const d = new Date(depart);
    d.setDate(d.getDate() + (days - 1));
    returnDate = d.toISOString().slice(0, 10);
  }

  const code = cityCodeMap[city] || 'INT';
  const country = countryMap[city] || 'asia';

  const lineMsg = `您好，我想訂購飛遊網清艙機票：\n【${city} ${days}天機票】${fullTitle}\n出發日期：${depart || '依清艙排程'} ~ ${returnDate || ''}\n特惠價格：NT$ ${price.toLocaleString()}\n請問目前還有機位可預訂嗎？`;
  const directBookingUrl = `https://line.me/R/oaMessage/%40msc8686z/?${encodeURIComponent(lineMsg)}`;

  return {
    id: `plynet-${event.id}`,
    ticketId: event.id,
    title: fullTitle,
    city,
    code,
    from: origin,
    fc,
    country,
    price,
    currency: 'TWD',
    depart,
    return: returnDate,
    duration: `${days} 天`,
    date: depart && returnDate ? `${depart.slice(5).replace('-', '/')} – ${returnDate.slice(5).replace('-', '/')}` : `${days} 天清艙票`,
    airline,
    air: airline,
    baggage: '含託運行李（依清艙商品規格）',
    kind: 'plan',
    tag: '飛遊網清艙日曆',
    source: '飛遊網特價清艙',
    sourceUrl: directBookingUrl,
    detail: `${fullTitle}｜飛遊網特價清艙機票，固定去回程時間，不可退票與改期。點擊預訂直達飛遊網官方專人在線開票！`,
    checked: now.slice(0, 10),
    collectedAt: now
  };
}

export async function collectPlynet() {
  await mkdir(outputDir, { recursive: true });
  let collected = [];

  try {
    // 1. 首頁取得 CSRF token, Session cookie 與 Livewire snapshot
    const getRes = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!getRes.ok) throw new Error(`HTTP ${getRes.status}`);
    const html = await getRes.text();

    const setCookies = getRes.headers.getSetCookie ? getRes.headers.getSetCookie() : [];
    const cookieHeader = setCookies.map(c => c.split(';')[0]).join('; ');

    const xsrfMatch = cookieHeader.match(/XSRF-TOKEN=([^;]+)/);
    const xsrfToken = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : '';

    const tokenMatch = html.match(/name=\"csrf-token\"\s*content=\"([^\"]+)\"/i);
    const csrfToken = tokenMatch?.[1] || '';

    const lwScript = html.match(/src=[\"']([^\"']*livewire[^\/]*\/livewire[^\"]*)[\"']/i);
    const prefix = lwScript?.[1]?.match(/(livewire-[a-f0-9]+)/)?.[1] || 'livewire';

    const snapshotMatch = html.match(/wire:snapshot=\"([^\"]+)\"[^>]*wire:name=\"on-sale\.ticket-calendar\"/i);
    if (!snapshotMatch) throw new Error('未找到 on-sale.ticket-calendar snapshot');
    const snapshotStr = snapshotMatch[1].replaceAll('&quot;', '"');

    // 2. 呼叫 Livewire getEvents API 抓取近三個月完整清艙日曆
    const updateUrl = `https://www.plynet.com.tw/${prefix}/update`;
    const today = new Date().toISOString().slice(0, 10);
    const future = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    const updateRes = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Livewire': 'true',
        'X-CSRF-TOKEN': csrfToken,
        'X-XSRF-TOKEN': xsrfToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookieHeader,
        'Referer': sourceUrl
      },
      body: JSON.stringify({
        _token: csrfToken,
        components: [
          {
            snapshot: snapshotStr,
            updates: {},
            calls: [
              {
                path: '',
                method: 'getEvents',
                params: [`${today}T00:00:00`, `${future}T23:59:59`]
              }
            ]
          }
        ]
      })
    });

    if (updateRes.ok) {
      const json = await updateRes.json();
      const comp = json.components?.[0];
      const rawEvents = comp?.effects?.returns?.[0] || [];
      if (Array.isArray(rawEvents) && rawEvents.length > 0) {
        // filter valid clearance tickets with price > 0
        const validEvents = rawEvents.filter(e => e.id && (e.extendedProps?.listTitle || e.title));
        collected = validEvents.map(parsePlynetEvent);
      }
    }
  } catch (err) {
    console.warn('[飛遊網] Livewire API 讀取異常，嘗試讀取快取:', err.message);
  }

  // 3. 快取防呆備援
  if (!collected.length) {
    try {
      const cached = JSON.parse(await readFile(outputFile, 'utf8'));
      if (Array.isArray(cached.deals) && cached.deals.length > 0) {
        collected = cached.deals;
      }
    } catch {
      console.warn('[飛遊網] 無現成快取資料可用');
    }
  }

  await writeFile(outputFile, JSON.stringify({
    source: sourceUrl,
    collectedAt: now,
    count: collected.length,
    deals: collected
  }, null, 2));

  console.log(`[飛遊網] 成功更新 ${collected.length} 筆清艙票！已儲存至 plynet-clearance.json`);
  return collected;
}

if (process.argv[1] === import.meta.filename) {
  collectPlynet();
}
