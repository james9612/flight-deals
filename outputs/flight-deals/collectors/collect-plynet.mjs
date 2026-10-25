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

  const routeSchedules = {
    '易斯達航空-首爾': '去程 ZE882 10:30-14:05／回程 ZE881 07:45-09:30（午去早回）',
    '易斯達航空-釜山': '去程 ZE984 02:50-06:05／回程 ZE983 22:00-00:15（紅眼早去晚回）',
    '樂桃航空-沖繩': '去程 MM924 09:30-12:15／回程 MM927 16:40-17:20（早去晚回）',
    '樂桃航空-東京': '去程 MM620 02:30-06:45／回程 MM627 22:00-00:45（紅眼早去晚回）',
    '樂桃航空-大阪': '去程 MM022 09:35-13:05／回程 MM027 16:00-18:15（早去晚回）',
    '台灣虎航-沖繩': origin === '高雄' ? '去程 IT288 12:40-16:00／回程 IT289 16:50-17:40（午去晚回）' : '去程 IT230 06:35-09:00／回程 IT231 10:00-10:45（早去早回）',
    '台灣虎航-東京': '去程 IT200 06:35-10:45／回程 IT201 11:35-14:45（早去午回）',
    '台灣虎航-大阪': origin === '高雄' ? '去程 IT284 08:35-12:20／回程 IT285 13:10-15:25（早去午回）' : '去程 IT210 06:55-10:25／回程 IT211 11:15-13:30（早去午回）',
    '台灣虎航-福岡': '去程 IT240 06:45-10:00／回程 IT241 10:55-12:35（早去午回）',
    '台灣虎航-名古屋': '去程 IT206 09:00-12:50／回程 IT207 13:45-16:05（早去午回）',
    '台灣虎航-石垣島': origin === '高雄' ? '去程 IT282 11:15-13:20／回程 IT283 14:10-14:25（午去午回）' : '去程 IT280 12:15-14:10／回程 IT281 15:00-15:05（午去午回）',
    '台灣虎航-函館': '去程 IT236 07:00-11:40／回程 IT237 12:40-16:00（早去午回）',
    '台灣虎航-高知': '去程 IT250 08:40-12:00／回程 IT251 13:00-15:35（早去午回）',
    '台灣虎航-小松': '去程 IT252 12:00-15:55／回程 IT253 16:55-19:30（午去晚回）',
    '台灣虎航-高松': '去程 IT214 06:55-10:35／回程 IT215 11:35-13:40（早去午回）',
    '酷航-札幌': '去程 TR892 11:30-16:15／回程 TR893 17:35-21:05（午去晚回）',
    '酷航-東京': '去程 TR898 06:40-10:45／回程 TR899 11:45-15:10（早去午回）',
    '德威航空-首爾': '去程 TW668 11:40-15:25／回程 TW667 08:50-10:40（午去早回）',
    '濟州航空-首爾': '去程 7C2678 03:00-06:30／回程 7C2677 22:45-00:40（紅眼早去晚回）',
    '真航空-首爾': '去程 LJ732 10:35-14:15／回程 LJ731 07:50-09:35（午去早回）'
  };
  const flightKey = `${airline}-${city}`;
  const flightTime = routeSchedules[flightKey] || (fullTitle.includes('早去晚回') ? '早去晚回' : (fullTitle.includes('早去午回') ? '早去午回' : (fullTitle.includes('午去晚回') ? '午去晚回' : '')));

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
    flightTime,
    baggage: '含託運行李（依清艙商品規格）',
    kind: 'plan',
    tag: '飛遊網清艙日曆',
    source: '飛遊網特價清艙',
    sourceUrl: 'https://www.plynet.com.tw/',
    detail: `${fullTitle}｜飛遊網特價清艙機票，固定去回程時間，不可退票與改期。點擊直接前往飛遊網官網查看完整機票與出發日曆！`,
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
