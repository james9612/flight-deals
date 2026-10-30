import { mkdir, writeFile, readFile } from 'node:fs/promises';

const sourceUrl = 'https://www.plynet.com.tw/';
const outputDir = new URL('../data/collected/', import.meta.url);
const outputFile = new URL('plynet-clearance.json', outputDir);
const now = new Date().toISOString();

const cityCodeMap = {
  東京: 'TYO', 大阪: 'OSA', 沖繩: 'OKA', 首爾: 'ICN', 仁川: 'ICN',
  釜山: 'PUS', 福岡: 'FUK', 名古屋: 'NGO', 石垣島: 'ISG', 函館: 'HKD', 旭川: 'AKJ', 帶廣: 'OBO',
  高松: 'TAK', 小松: 'KMQ', 新千歲: 'CTS', 札幌: 'CTS', 北海道: 'CTS', 高知: 'KCZ', 清邁: 'CNX', 曼谷: 'BKK'
};

const countryMap = {
  東京: 'japan', 大阪: 'japan', 沖繩: 'japan', 福岡: 'japan',
  名古屋: 'japan', 石垣島: 'japan', 函館: 'japan', 旭川: 'japan', 帶廣: 'japan', 高松: 'japan', 小松: 'japan', 新千歲: 'japan', 札幌: 'japan', 北海道: 'japan', 高知: 'japan',
  首爾: 'korea', 釜山: 'korea', 仁川: 'korea',
  曼谷: 'asia', 清邁: 'asia'
};

function resolveHokkaidoLocation(deal) {
  const combined = `${deal.title || ''} ${deal.flightTime || ''} ${deal.productCode || ''} ${deal.detail || ''}`;
  if (/函館|HKD|IT0?236|IT0?237/i.test(combined)) {
    deal.city = '函館';
    deal.code = 'HKD';
  } else if (/旭川|AKJ|IT0?238|IT0?239/i.test(combined)) {
    deal.city = '旭川';
    deal.code = 'AKJ';
  } else if (/帶廣|OBO/i.test(combined)) {
    deal.city = '帶廣';
    deal.code = 'OBO';
  } else if (
    deal.city === '北海道' ||
    /新千歲|千歲|\bCTS\b|TR892|TR893|FD242|FD243|SL392|SL393|IT0?234|IT0?235|IT0?260|IT0?261/i.test(combined)
  ) {
    deal.city = '新千歲';
    deal.code = 'CTS';
  }
}

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
  for (const c of ['東京', '大阪', '沖繩', '首爾', '仁川', '釜山', '福岡', '名古屋', '石垣島', '函館', '旭川', '帶廣', '新千歲', '高松', '小松', '札幌', '北海道', '高知', '清邁', '曼谷']) {
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
  else if (fullTitle.includes('泰獅')) airline = '泰國獅航';
  else if (fullTitle.includes('泰亞航') || fullTitle.includes('亞航')) airline = '亞洲航空';
  else if (fullTitle.includes('德威')) airline = '德威航空';
  else if (fullTitle.includes('濟州')) airline = '濟州航空';
  else if (fullTitle.includes('真航空')) airline = '真航空';
  else if (fullTitle.includes('星宇')) airline = '星宇航空';
  else if (fullTitle.includes('華航')) airline = '中華航空';
  else if (fullTitle.includes('長榮')) airline = '長榮航空';

  const depart = event.start || '';
  let returnDate = '';
  if (depart) {
    const d = new Date(depart);
    d.setDate(d.getDate() + (days - 1));
    returnDate = d.toISOString().slice(0, 10);
  }

  const code = cityCodeMap[city] || 'INT';
  const country = countryMap[city] || 'asia';

  let flightTime = '';
  const timeKeywords = ['早去晚回', '早去午回', '午去晚回', '早去早回', '晚去晚回', '午去午回', '紅眼早去晚回'];
  for (const kw of timeKeywords) {
    if (fullTitle.includes(kw)) {
      flightTime = kw;
      break;
    }
  }

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

const modalCacheFile = new URL('plynet-modal-cache.json', outputDir);

function parseModalHtml(modalHtml) {
  const boxIdx = modalHtml.indexOf('class="modal-box');
  const formIdx = modalHtml.indexOf('class="lg:hidden');
  if (boxIdx === -1 || formIdx === -1) return null;

  const clean = modalHtml.slice(boxIdx, formIdx)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  let outFlight = '';
  let inFlight = '';
  let baggage = '';
  let productCode = '';

  for (let i = 0; i < clean.length; i++) {
    const line = clean[i];
    if (line.includes('商品代碼：')) {
      productCode = clean[i + 1] || '';
    }
    if (line.startsWith('去程：') || line.startsWith('去程:')) {
      outFlight = line.replace(/^去程[：:]\s*/, '').trim() || clean[i + 1] || '';
    }
    if (line.startsWith('回程：') || line.startsWith('回程:')) {
      inFlight = line.replace(/^回程[：:]\s*/, '').trim() || clean[i + 1] || '';
    }
    if (line.includes('托運行李') || line.includes('託運行李')) {
      if (!baggage && !line.includes('手提行李')) baggage = line;
    }
  }

  let flightTime = '';
  if (outFlight && inFlight) {
    flightTime = `去程 ${outFlight}／回程 ${inFlight}`;
  } else if (outFlight) {
    flightTime = `去程 ${outFlight}`;
  }

  return {
    flightTime,
    baggage: baggage || '含來回託運行李（依清艙商品規格）',
    productCode
  };
}

export async function collectPlynet() {
  await mkdir(outputDir, { recursive: true });
  let collected = [];

  // 讀取既有詳細彈窗快取
  let modalCache = {};
  try {
    modalCache = JSON.parse(await readFile(modalCacheFile, 'utf8'));
  } catch {}

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

    const modalMatch = html.match(/wire:snapshot=\"([^\"]+)\"[^>]*wire:name=\"on-sale\.ticket-modal\"/i)
      || html.match(/wire:name=\"on-sale\.ticket-modal\"[^>]*wire:snapshot=\"([^\"]+)\"/i);
    const modalSnapshot = modalMatch ? (modalMatch[1] || modalMatch[2]).replaceAll('&quot;', '"') : null;

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

        // 3. 自動爬取未快取的機票彈窗詳細時刻與行李規格
        if (modalSnapshot) {
          const pendingTickets = collected.filter(d => d.ticketId && !modalCache[d.ticketId]);
          if (pendingTickets.length > 0) {
            console.log(`[飛遊網] 發現 ${pendingTickets.length} 筆新機票，開始抓取官方彈窗詳細資訊...`);
            const CONCURRENCY = 8;
            for (let i = 0; i < pendingTickets.length; i += CONCURRENCY) {
              const chunk = pendingTickets.slice(i, i + CONCURRENCY);
              await Promise.all(chunk.map(async (deal) => {
                try {
                  const mRes = await fetch(updateUrl, {
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
                          snapshot: modalSnapshot,
                          updates: { showTicketId: deal.ticketId },
                          calls: []
                        }
                      ]
                    })
                  });
                  if (mRes.ok) {
                    const mJson = await mRes.json();
                    const mHtml = mJson.components?.[0]?.effects?.html || '';
                    const detail = parseModalHtml(mHtml);
                    modalCache[deal.ticketId] = detail || { flightTime: '', baggage: '', productCode: '' };
                  }
                } catch {}
              }));
              await new Promise(r => setTimeout(r, 50));
            }
            // 寫回快取檔
            await writeFile(modalCacheFile, JSON.stringify(modalCache, null, 2), 'utf8');
            console.log(`[飛遊網] 詳細航班彈窗快取已更新！目前快取數: ${Object.keys(modalCache).length}`);
          }
        }

        // 4. 將官方詳細資訊回填至每一筆機票並核實北海道實際機場航點
        for (const deal of collected) {
          const info = modalCache[deal.ticketId];
          if (info) {
            if (info.flightTime) deal.flightTime = info.flightTime;
            if (info.baggage) deal.baggage = info.baggage;
            if (info.productCode) deal.productCode = info.productCode;
          }
          resolveHokkaidoLocation(deal);
        }
      }
    }
  } catch (err) {
    console.warn('[飛遊網] Livewire API 讀取異常，嘗試讀取快取:', err.message);
  }

  // 5. 快取防呆備援
  if (!collected.length) {
    try {
      const cached = JSON.parse(await readFile(outputFile, 'utf8'));
      if (Array.isArray(cached.deals) && cached.deals.length > 0) {
        collected = cached.deals.map(deal => {
          const info = modalCache[deal.ticketId];
          if (info) {
            if (info.flightTime) deal.flightTime = info.flightTime;
            if (info.baggage) deal.baggage = info.baggage;
            if (info.productCode) deal.productCode = info.productCode;
          }
          resolveHokkaidoLocation(deal);
          return deal;
        });
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

