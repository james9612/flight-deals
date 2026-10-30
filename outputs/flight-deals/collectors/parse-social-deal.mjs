const cityCodeMap = {
  東京: 'TYO', 成田: 'NRT', 羽田: 'HND', 大阪: 'KIX', 關西: 'KIX',
  沖繩: 'OKA', 那霸: 'OKA', 名古屋: 'NGO', 福岡: 'FUK',
  新千歲: 'CTS', 千歲: 'CTS', 函館: 'HKD', 旭川: 'AKJ', 帶廣: 'OBO', 札幌: 'CTS', 北海道: 'CTS',
  仙台: 'SDJ', 小松: 'KMQ', 高松: 'TAK', 高知: 'KCZ', 石垣島: 'ISG', 福島: 'FKS', 廣島: 'HIJ',
  岡山: 'OKJ', 大分: 'OIT', 佐賀: 'HSG',
  首爾: 'ICN', 仁川: 'ICN', 釜山: 'PUS', 大邱: 'TAE', 濟州: 'CJU', 清州: 'CJJ',
  曼谷: 'BKK', 清邁: 'CNX', 富國島: 'PQC', 峴港: 'DAD', 新加坡: 'SIN', 吉隆坡: 'KUL'
};

const countryMap = {
  東京: 'japan', 成田: 'japan', 羽田: 'japan', 大阪: 'japan', 關西: 'japan',
  沖繩: 'japan', 那霸: 'japan', 名古屋: 'japan', 福岡: 'japan',
  新千歲: 'japan', 千歲: 'japan', 函館: 'japan', 旭川: 'japan', 帶廣: 'japan', 札幌: 'japan', 北海道: 'japan',
  仙台: 'japan', 小松: 'japan', 高松: 'japan', 高知: 'japan', 石垣島: 'japan', 福島: 'japan', 廣島: 'japan',
  岡山: 'japan', 大分: 'japan', 佐賀: 'japan',
  首爾: 'korea', 仁川: 'korea', 釜山: 'korea', 大邱: 'korea', 濟州: 'korea', 清州: 'korea',
  曼谷: 'asia', 清邁: 'asia', 富國島: 'asia', 峴港: 'asia', 新加坡: 'asia', 吉隆坡: 'asia'
};

function resolveActualCity(matchedCity, contextText = '') {
  if (matchedCity === '成田' || matchedCity === '羽田') return '東京';
  if (matchedCity === '關西') return '大阪';
  if (matchedCity === '那霸') return '沖繩';
  if (matchedCity === '千歲' || matchedCity === '新千歲') return '新千歲';
  if (matchedCity === '北海道' || matchedCity === '札幌') {
    if (/函館|HKD|IT0?236|IT0?237/i.test(contextText)) return '函館';
    if (/旭川|AKJ|IT0?238|IT0?239/i.test(contextText)) return '旭川';
    if (/帶廣|OBO/i.test(contextText)) return '帶廣';
    if (/新千歲|千歲|CTS|TR892|TR893|FD242|FD243|SL392|SL393|IT0?234|IT0?235|IT0?260|IT0?261|CI130|BR116|JX850/i.test(contextText)) {
      return '新千歲';
    }
    return '新千歲';
  }
  return matchedCity;
}

/**
 * 擷取班機時間：支援「去程 IT0236 桃園 06:45 ➜ 函館 11:10 / 回程 IT0237 函館 12:20 ➜ 桃園 16:00」以及「早去晚回」等關鍵字
 * @param {string} rawText 原始文字
 * @returns {string} 班機時間或空字串
 */
function extractFlightTimeFromText(rawText = '') {
  const outMatch = rawText.match(/去程\s*([A-Z0-9]{2,7})?[^\d\n]*?(\d{1,2}:\d{2})\s*(?:➜|➔|->|→|~|-|～|至)\s*[^\d\n]*?(\d{1,2}:\d{2})/i);
  const inMatch = rawText.match(/回程\s*([A-Z0-9]{2,7})?[^\d\n]*?(\d{1,2}:\d{2})\s*(?:➜|➔|->|→|~|-|～|至)\s*[^\d\n]*?(\d{1,2}:\d{2})/i);
  if (outMatch && inMatch) {
    const outCode = outMatch[1] ? `${outMatch[1]} ` : '';
    const inCode = inMatch[1] ? `${inMatch[1]} ` : '';
    return `去程 ${outCode}${outMatch[2]}–${outMatch[3]} ／ 回程 ${inCode}${inMatch[2]}–${inMatch[3]}`;
  }

  const timeKeywords = ['早去晚回', '早去午回', '午去晚回', '早去早回', '晚去晚回', '午去午回', '紅眼早去晚回', '晚去早回'];
  for (const kw of timeKeywords) {
    if (rawText.includes(kw)) return kw;
  }
  const flightMatch = rawText.match(/(?:去程\s*[A-Z0-9\s:／-]+回程\s*[A-Z0-9\s:／-]+)/);
  if (flightMatch) return flightMatch[0].trim();

  return '';
}

function cleanMessengerNoise(rawText = '') {
  return rawText
    .replace(/^輸入，訊息已在.*?傳送[：:]\s*/gm, '')
    .replace(/^飛趣旅遊\s*Go\s*Fly\s*Trip\s*/gim, '')
    .replace(/\d+\s*人已看過/g, '')
    .trim();
}

/**
 * 智慧解析社群／Messenger／Facebook 粉專口語化清艙文字（支援多行大補帖與單則促銷）
 * @param {string} rawText 原始貼文文字
 * @param {string} sourceUrl 訂票連結（預設為官方 LINE: @flynow01）
 * @returns {Array<object>} 解析完成的機票資料陣列
 */
export function parseSocialDeals(rawText, sourceUrl = 'https://line.me/R/ti/p/%40flynow01') {
  if (!rawText || typeof rawText !== 'string') return [];

  const text = cleanMessengerNoise(rawText);
  // 嚴格過濾：排除粉專自介、社群導航、重複 Facebook 雜訊與純折價券/折扣碼推廣廣告
  if (
    /萬位追蹤者|正在追蹤|上線狀態指示燈|營業時間|旅遊服務\s*·\s*\$\$|發送訊息/i.test(text) ||
    /折扣券|折扣碼|現折|領起來|機場接送.*折|指定迷你團/i.test(text) ||
    /Facebook\s*Facebook\s*Facebook/i.test(text) ||
    (text.match(/Facebook/gi) || []).length >= 3
  ) {
    return [];
  }

  const currentYear = new Date().getFullYear();
  const results = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const globalFlightTime = extractFlightTimeFromText(text);

  let blockAirline = null;
  let blockCity = null;
  let blockFrom = '台北';
  let blockPrice = null;
  let blockDays = 5;

  for (let line of lines) {
    // 遇到分隔線，重設區塊快取避免狀態污染後續單行機票
    if (line.startsWith('---') || line.startsWith('——') || line.includes('今天買什麼') || line.includes('沒寫就是')) {
      blockAirline = null;
      blockCity = null;
      blockFrom = '台北';
      blockPrice = null;
      blockDays = 5;
      continue;
    }

    // 格式 A：區塊標題行（以 ✈ 開頭，例如 "✈長榮 福岡4日機票 10700🍁" 或 "✈華航高雄高松5/6日機票"）
    if (line.startsWith('✈')) {
      blockFrom = line.includes('高雄') ? '高雄' : (line.includes('台中') ? '台中' : '台北');
      blockAirline = line.includes('長榮') ? '長榮航空' : (line.includes('華航') ? '中華航空' : (line.includes('虎航') ? '台灣虎航' : (line.includes('酷航') ? '酷航' : (line.includes('樂桃') ? '樂桃航空' : (line.includes('星宇') ? '星宇航空' : (line.includes('泰亞航') || line.includes('亞航') ? '亞洲航空' : '精選航空'))))));

      blockCity = '精選航點';
      for (const c of Object.keys(cityCodeMap)) {
        if (line.includes(c)) {
          blockCity = resolveActualCity(c, line);
          break;
        }
      }

      const pMatch = line.match(/([0-9]{4,5})/);
      blockPrice = pMatch ? parseInt(pMatch[1], 10) : null;

      const dMatch = line.match(/([3-8])\s*[日天]/);
      blockDays = dMatch ? parseInt(dMatch[1], 10) : 5;
      continue;
    }

    // 格式 B：區塊伴隨日期行（如 "🗓️11/03、11/10、12/08、12/15(3)" 或 "7999 🌟5天 🗓️：10/29"）
    // 嚴格條件：必須有 blockAirline，且行內包含 🗓 或 🌟（避免誤判一般單行機票）
    if (blockAirline && (line.includes('🗓') || line.includes('🌟')) && !line.includes('機酒')) {
      const linePriceMatch = line.match(/^([0-9]{4,5})\s*.*?[🌟日天]/) || line.match(/([0-9]{1,2},[0-9]{3}|[0-9]{4,5})\s*(?:\/人|\/席|元)/);
      const activePrice = linePriceMatch ? parseInt(linePriceMatch[1].replace(/,/g, ''), 10) : (blockPrice || 8888);

      const lineDaysMatch = line.match(/([3-8])\s*[日天]/);
      const activeDays = lineDaysMatch ? parseInt(lineDaysMatch[1], 10) : blockDays;

      const dateMatches = line.matchAll(/([0-1]?[0-9])\/([0-3]?[0-9])/g);
      for (const dm of dateMatches) {
        const m = dm[1].padStart(2, '0');
        const d = dm[2].padStart(2, '0');
        const year = parseInt(m, 10) < 5 ? currentYear + 1 : currentYear;
        const depart = `${year}-${m}-${d}`;
        const retObj = new Date(depart);
        retObj.setDate(retObj.getDate() + (activeDays - 1));
        const returnDate = retObj.toISOString().slice(0, 10);

        const flightTime = extractFlightTimeFromText(line) || globalFlightTime;
        const code = cityCodeMap[blockCity] || 'INT';
        const fc = blockFrom === '高雄' ? 'KHH' : (blockFrom === '台中' ? 'RMQ' : 'TPE');

        results.push({
          id: `goflytrip-${code}-${fc}-${year}${m}${d}-${activePrice}`,
          city: blockCity,
          code,
          from: blockFrom,
          fc,
          country: countryMap[blockCity] || 'japan',
          price: activePrice,
          currency: 'TWD',
          depart,
          return: returnDate,
          duration: `${activeDays} 天`,
          date: `${m}/${d} – ${returnDate.slice(5).replace('-', '/')}`,
          airline: blockAirline,
          air: blockAirline,
          baggage: blockAirline === '長榮航空' || blockAirline === '中華航空' ? '含機上餐與來回託運行李' : '含來回託運 20 公斤',
          source: '飛趣旅遊 Messenger 官方頻道',
          sourceUrl,
          checked: new Date().toISOString().slice(0, 10),
          tag: '飛趣旅遊清艙',
          agency: '飛趣旅遊',
          kind: 'plan',
          flightTime,
          detail: `【飛趣旅遊 清艙機票】${blockAirline}直飛${blockCity}${activeDays}日機票｜資訊來自於 Messenger 官方頻道，出發日：${depart}，含稅特惠價 NT$ ${activePrice.toLocaleString()}，官方 LINE: @flynow01 私訊搶位！`,
          rawMessage: line,
          collectedAt: new Date().toISOString()
        });
      }
      continue;
    }

    // 格式 C：獨立單行清單（如 "10/29 酷航東京5日 7800→6" 或 "10/31、11/14 虎航大分5日 7888→4"）
    const singleMatch = line.match(/^([0-1]?[0-9]\/[0-3]?[0-9](?:[、,][0-1]?[0-9]\/[0-3]?[0-9])*)\s+(.+?)\s+([0-9]{4,5})(?:up|→\d+)?/i);
    if (singleMatch) {
      const datesStr = singleMatch[1];
      const desc = singleMatch[2];
      const price = parseInt(singleMatch[3], 10);

      let days = 5;
      const dayM = desc.match(/([3-8])\s*[日天]/);
      if (dayM) days = parseInt(dayM[1], 10);

      let city = '精選航點';
      for (const c of Object.keys(cityCodeMap)) {
        if (desc.includes(c)) {
          city = resolveActualCity(c, desc);
          break;
        }
      }

      let from = '台北';
      if (desc.includes('高雄')) from = '高雄';
      else if (desc.includes('台中')) from = '台中';

      let airline = '精選航空';
      if (desc.includes('酷航')) airline = '酷航';
      else if (desc.includes('虎航')) airline = '台灣虎航';
      else if (desc.includes('樂桃')) airline = '樂桃航空';
      else if (desc.includes('華航')) airline = '中華航空';
      else if (desc.includes('長榮')) airline = '長榮航空';
      else if (desc.includes('泰獅')) airline = '泰國獅航';
      else if (desc.includes('泰亞航') || desc.includes('亞航')) airline = '亞洲航空';
      else if (desc.includes('星宇')) airline = '星宇航空';

      const flightTime = extractFlightTimeFromText(desc) || globalFlightTime;
      const code = cityCodeMap[city] || 'INT';
      const fc = from === '高雄' ? 'KHH' : (from === '台中' ? 'RMQ' : 'TPE');

      const dateParts = datesStr.split(/[、,]/);
      for (const dPart of dateParts) {
        const [m, d] = dPart.trim().split('/');
        if (!m || !d) continue;
        const year = parseInt(m, 10) < 5 ? currentYear + 1 : currentYear;
        const depart = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        const retDateObj = new Date(depart);
        retDateObj.setDate(retDateObj.getDate() + (days - 1));
        const returnDate = retDateObj.toISOString().slice(0, 10);

        results.push({
          id: `goflytrip-${code}-${fc}-${depart.replace(/-/g, '')}-${price}`,
          city,
          code,
          from,
          fc,
          country: countryMap[city] || 'japan',
          price,
          currency: 'TWD',
          depart,
          return: returnDate,
          duration: `${days} 天`,
          date: `${m.padStart(2, '0')}/${d.padStart(2, '0')} – ${returnDate.slice(5).replace('-', '/')}`,
          airline,
          air: airline,
          baggage: airline === '長榮航空' || airline === '中華航空' ? '含機上餐與來回託運行李' : '含來回託運 20 公斤',
          source: '飛趣旅遊 Messenger 官方頻道',
          sourceUrl,
          checked: new Date().toISOString().slice(0, 10),
          tag: '飛趣旅遊清艙',
          agency: '飛趣旅遊',
          kind: 'plan',
          flightTime,
          detail: `【飛趣旅遊 清艙機票】${desc}｜資訊來自於 Messenger 官方頻道，出發日：${depart}，含稅特惠價 NT$ ${price.toLocaleString()}，官方 LINE: @flynow01 私訊搶位！`,
          rawMessage: line,
          collectedAt: new Date().toISOString()
        });
      }
    }
  }

  // 若上述區塊與單行均無結果，嘗試解析單篇口語文宣（支援單篇內含多組純機票日期與價格）
  if (results.length === 0) {
    const multiSingles = parseSingleSocialDeals(text, sourceUrl);
    results.push(...multiSingles);
  }

  return results;
}

export function parseSocialDeal(rawText, sourceUrl) {
  const deals = parseSocialDeals(rawText, sourceUrl);
  return deals[0] || null;
}

function parseSingleSocialDeals(rawText, sourceUrl) {
  const text = rawText.trim();

  let city = '精選航點';
  for (const c of Object.keys(cityCodeMap)) {
    if (text.includes(c)) {
      city = resolveActualCity(c, text);
      break;
    }
  }

  let from = '台北';
  let fc = 'TPE';
  if (text.includes('高雄') || text.includes('小港')) {
    from = '高雄';
    fc = 'KHH';
  } else if (text.includes('台中') || text.includes('清泉崗')) {
    from = '台中';
    fc = 'RMQ';
  }

  let airline = '精選航空';
  if (text.includes('虎航') || text.includes('台灣虎航')) airline = '台灣虎航';
  else if (text.includes('樂桃') || text.includes('樂桃航空')) airline = '樂桃航空';
  else if (text.includes('酷航')) airline = '酷航';
  else if (text.includes('華航') || text.includes('中華航空')) airline = '中華航空';
  else if (text.includes('長榮') || text.includes('長榮航空')) airline = '長榮航空';
  else if (text.includes('星宇') || text.includes('星宇航空')) airline = '星宇航空';
  else if (text.includes('泰亞航') || text.includes('亞航')) airline = '亞洲航空';
  else if (text.includes('泰獅') || text.includes('獅航')) airline = '泰國獅航';
  else if (text.includes('濟州')) airline = '濟州航空';
  else if (text.includes('德威')) airline = '德威航空';
  else if (text.includes('真航空')) airline = '真航空';
  else if (text.includes('越捷')) airline = '越捷航空';

  let defaultDays = 5;
  const dayMatch = text.match(/([3-8])\s*天|([3-8])D|([3-8])d|([3-8])\s*日/);
  if (dayMatch) {
    defaultDays = parseInt(dayMatch[1] || dayMatch[2] || dayMatch[3] || dayMatch[4], 10);
  }

  const flightTime = extractFlightTimeFromText(text);
  let baggage = airline === '長榮航空' || airline === '中華航空' ? '含機上餐與來回託運行李' : '含來回託運 20 公斤';
  const bagMatch = text.match(/([1-3][0-9])\s*kg|([1-3][0-9])\s*公斤/i);
  if (bagMatch) {
    baggage = `含來回託運 ${bagMatch[1] || bagMatch[2]} 公斤`;
  }

  const code = cityCodeMap[city] || 'INT';
  const country = countryMap[city] || 'asia';
  if (city === '精選航點' || code === 'INT' || airline === '精選航空') {
    return [];
  }

  const cleanDetailText = text.replace(/Facebook\s*/gi, '').replace(/\n+/g, ' ').trim();
  if (cleanDetailText.length < 15) return [];

  const currentYear = new Date().getFullYear();
  const pairs = [];

  // 排除「機酒：14,900/人」這類機加酒價格，只抓純機票的 (價格 + 日期) 或 (日期 + 價格)
  const strippedHotelText = text.replace(/[^\n]*?機酒\s*[：:]\s*[0-9,]+[^\n]*/g, '');

  // 模式 1：價格在前、日期在後（如 "💵：4,499/席 🌟5天 🗓️：10/31" 或 "🌟6天💵：8,800/人 🗓️ : 11/05" 或 "純機票：4,499/席 🗓️：11/04"）
  // 確保價格前面沒有緊鄰未配對的 🗓️，避免跨行誤配「日期在前、價格在後」的貼文
  const patternPriceFirst = /(?:🌟\s*([3-8])\s*[天日]\s*)?(?:純?機票|💵)\s*[：:]\s*([0-9]{1,2},[0-9]{3}|[3-9][0-9]{3}|[1-2][0-9]{4})\s*(?:\/人|\/席|元|人)?(?:\s*🌟\s*([3-8])\s*[天日])?[^💵🗓\d\/]{0,18}?(?:🗓️|🗓)\s*[：:]?\s*([0-1]?[0-9])\/([0-3]?[0-9])/g;
  for (const m of strippedHotelText.matchAll(patternPriceFirst)) {
    const days = parseInt(m[1] || m[3] || defaultDays, 10);
    const price = parseInt(m[2].replace(/,/g, ''), 10);
    const month = m[4].padStart(2, '0');
    const day = m[5].padStart(2, '0');
    if (price >= 3000 && price <= 35000) {
      pairs.push({ price, month, day, days });
    }
  }

  // 模式 2：日期在前、價格在後（如 "🗓️ : 11/03 💵：5,500"）
  if (pairs.length === 0) {
    const patternDateFirst = /(?:🗓️|🗓|\b)\s*[：:]\s*([0-1]?[0-9])\/([0-3]?[0-9])[^🗓\d\/]{0,18}?(?:💵|[：:])\s*([0-9]{1,2},[0-9]{3}|[3-9][0-9]{3}|[1-2][0-9]{4})/g;
    for (const m of strippedHotelText.matchAll(patternDateFirst)) {
      const month = m[1].padStart(2, '0');
      const day = m[2].padStart(2, '0');
      const price = parseInt(m[3].replace(/,/g, ''), 10);
      if (price >= 3000 && price <= 35000) {
        pairs.push({ price, month, day, days: defaultDays });
      }
    }
  }

  // 若未匹配到多組，退回單一價格與單一出發日擷取
  if (pairs.length === 0) {
    let price = 0;
    const priceMatches = strippedHotelText.match(/(?:NT\$|TWD|\$|特價|只要|機票|費用|一口價|💵|票價|：|:)\s*([0-9]{1,2}[,\.][0-9]{3}|[0-9]{4,5})\s*(?:元|起|含稅|\/人|\/席|人|\b)/i)
      || strippedHotelText.match(/([0-9]{1,2}[,\.][0-9]{3}|[0-9]{4,5})\s*(?:元|含稅|\/人|\/席)/)
      || strippedHotelText.match(/\b([0-9]{1,2},[0-9]{3})\b/);

    if (priceMatches) {
      price = parseInt(priceMatches[1].replace(/[,\.]/g, ''), 10);
    }
    if (price < 3000 || price > 35000) return [];

    const singleDateMatch = strippedHotelText.match(/(?:🗓️|🗓|出發|出發日|日期|：|:|\s|^)([0-1]?[0-9])[\/\.月]([0-3]?[0-9])日?/);
    if (!singleDateMatch) return [];

    pairs.push({
      price,
      month: singleDateMatch[1].padStart(2, '0'),
      day: singleDateMatch[2].padStart(2, '0'),
      days: defaultDays
    });
  }

  const out = [];
  const seenKeys = new Set();
  for (const p of pairs) {
    const year = parseInt(p.month, 10) < 5 ? currentYear + 1 : currentYear;
    const depart = `${year}-${p.month}-${p.day}`;
    const dObj = new Date(depart);
    dObj.setDate(dObj.getDate() + (p.days - 1));
    const returnDate = dObj.toISOString().slice(0, 10);
    const id = `goflytrip-${code}-${fc}-${year}${p.month}${p.day}-${p.price}`;
    if (seenKeys.has(id)) continue;
    seenKeys.add(id);

    const dateStr = `${p.month}/${p.day} – ${returnDate.slice(5).replace('-', '/')}`;
    out.push({
      id,
      city,
      code,
      from,
      fc,
      country,
      price: p.price,
      currency: 'TWD',
      depart,
      return: returnDate,
      duration: `${p.days} 天`,
      date: dateStr,
      airline,
      air: airline,
      baggage,
      source: '飛趣旅遊官方粉絲專頁',
      sourceUrl: sourceUrl || 'https://line.me/R/ti/p/%40flynow01',
      checked: new Date().toISOString().slice(0, 10),
      tag: '飛趣旅遊清艙',
      agency: '飛趣旅遊',
      kind: 'plan',
      flightTime,
      detail: `【飛趣旅遊 清艙機票】${cleanDetailText.slice(0, 150)}｜資訊來自於 Messenger 官方頻道`,
      rawMessage: text,
      collectedAt: new Date().toISOString()
    });
  }

  return out;
}
