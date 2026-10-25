const cityCodeMap = {
  東京: 'TYO', 成田: 'NRT', 羽田: 'HND', 大阪: 'KIX', 關西: 'KIX',
  沖繩: 'OKA', 那霸: 'OKA', 名古屋: 'NGO', 福岡: 'FUK', 札幌: 'CTS', 北海道: 'CTS', 新千歲: 'CTS',
  函館: 'HKD', 仙台: 'SDJ', 小松: 'KMQ', 高松: 'TAK', 高知: 'KCZ', 石垣島: 'ISG', 福島: 'FKS', 廣島: 'HIJ',
  岡山: 'OKJ', 大分: 'OIT', 佐賀: 'HSG',
  首爾: 'ICN', 仁川: 'ICN', 釜山: 'PUS', 大邱: 'TAE', 濟州: 'CJU', 清州: 'CJJ',
  曼谷: 'BKK', 清邁: 'CNX', 富國島: 'PQC', 峴港: 'DAD', 新加坡: 'SIN', 吉隆坡: 'KUL'
};

const countryMap = {
  東京: 'japan', 成田: 'japan', 羽田: 'japan', 大阪: 'japan', 關西: 'japan',
  沖繩: 'japan', 那霸: 'japan', 名古屋: 'japan', 福岡: 'japan', 札幌: 'japan', 北海道: 'japan', 新千歲: 'japan',
  函館: 'japan', 仙台: 'japan', 小松: 'japan', 高松: 'japan', 高知: 'japan', 石垣島: 'japan', 福島: 'japan', 廣島: 'japan',
  岡山: 'japan', 大分: 'japan', 佐賀: 'japan',
  首爾: 'korea', 仁川: 'korea', 釜山: 'korea', 大邱: 'korea', 濟州: 'korea', 清州: 'korea',
  曼谷: 'asia', 清邁: 'asia', 富國島: 'asia', 峴港: 'asia', 新加坡: 'asia', 吉隆坡: 'asia'
};

const routeFlightTimes = {
  // 台北（桃園 TPE）出發
  '台北-長榮航空-福岡': '去程 BR106 08:10-11:15／回程 BR105 12:15-13:50（早去午回）',
  '台北-中華航空-廣島': '去程 CI112 17:20-20:40／回程 CI113 09:00-10:50（晚去早回）',
  '台北-中華航空-高松': '去程 CI178 14:30-18:00／回程 CI179 19:00-21:00（午去晚回）',
  '台北-酷航-東京': '去程 TR898 06:40-10:45／回程 TR899 11:45-15:10（早去午回）',
  '台北-酷航-北海道': '去程 TR892 11:30-16:15／回程 TR893 17:35-21:05（午去晚回）',
  '台北-台灣虎航-福島': '去程 IT266 08:40-12:30／回程 IT267 13:20-16:20（早去午回）',
  '台北-台灣虎航-高知': '去程 IT250 08:40-12:00／回程 IT251 13:00-15:35（早去午回）',
  '台北-台灣虎航-石垣島': '去程 IT736 06:35-08:35／回程 IT737 09:25-09:35（早去早回・航程約50分）',
  '台北-台灣虎航-大分': '去程 IT274 07:30-10:55／回程 IT275 11:55-13:40（早去午回）',
  '台北-台灣虎航-佐賀大分': '去程台北-佐賀 IT246 07:00-10:25／回程大分-台北 IT275 11:55-13:40（雙點進出）',
  '台北-台灣虎航-大分佐賀': '去程台北-大分 IT274 07:30-10:55／回程佐賀-台北 IT247 11:25-13:10（雙點進出）',
  '台北-台灣虎航-岡山': '去程 IT214 13:30-17:00／回程 IT215 17:55-19:55（午去晚回）',
  '台北-樂桃航空-東京': '去程 MM620 02:30-06:45／回程 MM627 22:00-00:45（紅眼早去晚回）',
  '台北-樂桃航空-大阪': '去程 MM022 09:35-13:05／回程 MM027 16:00-18:15（早去晚回）',
  '台北-樂桃航空-沖繩': '去程 MM924 09:30-12:15／回程 MM927 16:40-17:20（早去晚回）',
  '台北-亞洲航空-沖繩': '去程 FD230 13:30-16:00／回程 FD231 16:55-17:35（午去晚回）',
  '台北-亞洲航空-北海道': '去程 FD242 07:05-12:05／回程 FD243 14:40-18:00（早去午回）',

  // 高雄（小港 KHH）出發（真實核實航班，不再誤植台北班機）
  '高雄-中華航空-高松': '去程 CI7760 06:35-10:30／回程 CI7761 11:50-13:55（早去午回・華航A321neo客機）',
  '高雄-泰國獅航-北海道': '去程 SL392 10:50-16:00／回程 SL393 17:00-21:00（午去晚回・直飛札幌）',
  '高雄-台灣虎航-北海道': '去程 IT260 08:00-12:55／回程 IT261 13:55-18:05（早去午回・直飛札幌）',
  '高雄-台灣虎航-岡山': '去程 IT262 12:40-16:30／回程 IT263 17:30-20:00（午去晚回）',
  '高雄-亞洲航空-大阪': '去程 AK170 08:30-12:40／回程 AK171 13:40-16:30（早去午回・直飛關西）'
};

function lookupFlightTime(from, airline, city, rawDesc = '') {
  if (rawDesc.includes('佐賀大分')) {
    return routeFlightTimes[`${from}-${airline}-佐賀大分`] || '去程台北-佐賀 IT246／回程大分-台北 IT275（雙點進出）';
  }
  if (rawDesc.includes('大分佐賀')) {
    return routeFlightTimes[`${from}-${airline}-大分佐賀`] || '去程台北-大分 IT274／回程佐賀-台北 IT247（雙點進出）';
  }
  const key = `${from}-${airline}-${city}`;
  if (routeFlightTimes[key]) return routeFlightTimes[key];

  const timeKeywords = ['早去晚回', '早去午回', '午去晚回', '早去早回', '晚去晚回', '午去午回'];
  for (const kw of timeKeywords) {
    if (rawDesc.includes(kw)) return kw;
  }
  return '';
}

/**
 * 智慧解析社群／Messenger／Facebook 粉專口語化清艙文字（支援多行大補帖與單則促銷）
 * @param {string} rawText 原始貼文文字
 * @param {string} sourceUrl 訂票連結（預設為官方 LINE: @flynow01）
 * @returns {Array<object>} 解析完成的機票資料陣列
 */
export function parseSocialDeals(rawText, sourceUrl = 'https://line.me/R/ti/p/%40flynow01') {
  if (!rawText || typeof rawText !== 'string') return [];

  const text = rawText.trim();
  const currentYear = new Date().getFullYear();
  const results = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

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
      blockAirline = line.includes('長榮') ? '長榮航空' : (line.includes('華航') ? '中華航空' : (line.includes('虎航') ? '台灣虎航' : (line.includes('酷航') ? '酷航' : (line.includes('樂桃') ? '樂桃航空' : (line.includes('星宇') ? '星宇航空' : '精選航空')))));

      blockCity = '精選航點';
      for (const c of Object.keys(cityCodeMap)) {
        if (line.includes(c)) { blockCity = (c === '新千歲') ? '北海道' : c; break; }
      }

      const pMatch = line.match(/([0-9]{4,5})/);
      blockPrice = pMatch ? parseInt(pMatch[1], 10) : null;

      const dMatch = line.match(/([3-8])\s*[日天]/);
      blockDays = dMatch ? parseInt(dMatch[1], 10) : 5;
      continue;
    }

    // 格式 B：區塊伴隨日期行（如 "🗓️11/03、11/10、12/08、12/15(3)" 或 "7999 🌟5天 🗓️：10/29"）
    // 嚴格條件：必須有 blockAirline，且行內包含 🗓 或 🌟（避免誤判一般單行機票）
    if (blockAirline && (line.includes('🗓') || line.includes('🌟'))) {
      const linePriceMatch = line.match(/^([0-9]{4,5})\s*.*?[🌟日天]/);
      const activePrice = linePriceMatch ? parseInt(linePriceMatch[1], 10) : (blockPrice || 8888);

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

        const flightTime = lookupFlightTime(blockFrom, blockAirline, blockCity, line);

        results.push({
          id: `goflytrip-${cityCodeMap[blockCity] || 'INT'}-${m}${d}-${activePrice}-${Math.random().toString(36).slice(2, 5)}`,
          city: blockCity,
          code: cityCodeMap[blockCity] || 'INT',
          from: blockFrom,
          fc: blockFrom === '高雄' ? 'KHH' : (blockFrom === '台中' ? 'RMQ' : 'TPE'),
          country: countryMap[blockCity] || 'japan',
          price: activePrice,
          currency: 'TWD',
          depart,
          return: returnDate,
          duration: `${activeDays} 天`,
          date: `${m}/${d} – ${returnDate.slice(5).replace('-', '/')}`,
          airline: blockAirline,
          air: blockAirline,
          baggage: blockAirline === '長榮航空' || blockAirline === '中華航空' ? '含機上餐與來回託運行李' : '含來回託運行李（依清艙商品規格）',
          source: '飛趣旅遊官方粉絲專頁',
          sourceUrl,
          checked: new Date().toISOString().slice(0, 10),
          tag: '飛趣旅遊清艙',
          agency: '飛趣旅遊',
          kind: 'plan',
          flightTime,
          detail: `【飛趣旅遊 清艙機票】${blockAirline}直飛${blockCity}${activeDays}日機票｜資訊來自於官方粉絲專頁，出發日：${depart}，含稅特惠價 NT$ ${activePrice.toLocaleString()}，官方 LINE: @flynow01 私訊搶位！`,
          rawMessage: line,
          collectedAt: new Date().toISOString()
        });
      }
      continue;
    }

    // 格式 C：獨立單行清單（如 "10/29 酷航東京5日 7800→6" 或 "10/31、11/14 虎航大分5日 7888→4"）
    // 獨立處理，絕不沿用 blockAirline，避免狀態污染
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
          city = (c === '新千歲') ? '北海道' : c;
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

      const flightTime = lookupFlightTime(from, airline, city, desc);

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
          id: `goflytrip-${cityCodeMap[city] || 'INT'}-${m}${d}-${price}-${Math.random().toString(36).slice(2, 5)}`,
          city,
          code: cityCodeMap[city] || 'INT',
          from,
          fc: from === '高雄' ? 'KHH' : (from === '台中' ? 'RMQ' : 'TPE'),
          country: countryMap[city] || 'japan',
          price,
          currency: 'TWD',
          depart,
          return: returnDate,
          duration: `${days} 天`,
          date: `${m.padStart(2, '0')}/${d.padStart(2, '0')} – ${returnDate.slice(5).replace('-', '/')}`,
          airline,
          air: airline,
          baggage: airline === '長榮航空' || airline === '中華航空' ? '含機上餐與來回託運行李' : '含來回託運行李（依清艙商品規格）',
          source: '飛趣旅遊官方粉絲專頁',
          sourceUrl,
          checked: new Date().toISOString().slice(0, 10),
          tag: '飛趣旅遊清艙',
          agency: '飛趣旅遊',
          kind: 'plan',
          flightTime,
          detail: `【飛趣旅遊 清艙機票】${desc}｜資訊來自於官方粉絲專頁，出發日：${depart}，含稅特惠價 NT$ ${price.toLocaleString()}，官方 LINE: @flynow01 私訊搶位！`,
          rawMessage: line,
          collectedAt: new Date().toISOString()
        });
      }
    }
  }

  // 若上述多行均無解析結果，嘗試單篇口語文宣解析
  if (results.length === 0) {
    const single = parseSingleSocialDeal(text, sourceUrl);
    if (single) results.push(single);
  }

  return results;
}

export function parseSocialDeal(rawText, sourceUrl) {
  const deals = parseSocialDeals(rawText, sourceUrl);
  return deals[0] || null;
}

function parseSingleSocialDeal(rawText, sourceUrl) {
  const text = rawText.trim();

  let city = '精選航點';
  for (const c of Object.keys(cityCodeMap)) {
    if (text.includes(c)) {
      city = (c === '成田' || c === '羽田') ? '東京' : (c === '關西' ? '大阪' : (c === '那霸' ? '沖繩' : (c === '新千歲' ? '北海道' : c)));
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

  let price = 0;
  const priceMatches = text.match(/(?:NT\$|TWD|\$|特價|只要|機票|費用|一口價|只要)\s*([0-9]{1,2}[,\.][0-9]{3}|[0-9]{4,5})\s*(?:元|起|含稅|\/人|\b)/i)
    || text.match(/([0-9]{1,2},[0-9]{3}|[0-9]{4,5})\s*(?:元|含稅)/)
    || text.match(/\$\s*([0-9]{4,5})/);

  if (priceMatches) {
    price = parseInt(priceMatches[1].replace(/[,\.]/g, ''), 10);
  }

  if (price < 2000 || price > 60000) {
    const genericNum = text.match(/\b([3-9][0-9]{3}|[1-3][0-9]{4})\b/);
    if (genericNum) price = parseInt(genericNum[1], 10);
  }

  let days = 5;
  const dayMatch = text.match(/([3-8])\s*天|([3-8])D|([3-8])d|([3-8])\s*日/);
  if (dayMatch) {
    days = parseInt(dayMatch[1] || dayMatch[2] || dayMatch[3] || dayMatch[4], 10);
  }

  const currentYear = new Date().getFullYear();
  let depart = '';
  let returnDate = '';

  const dateRangeMatch = text.match(/([0-1]?[0-9])[\/\.月]([0-3]?[0-9])日?\s*[-~～至到]\s*([0-1]?[0-9])?[\/\.月]?([0-3]?[0-9])日?/);
  if (dateRangeMatch) {
    const m1 = dateRangeMatch[1].padStart(2, '0');
    const d1 = dateRangeMatch[2].padStart(2, '0');
    depart = `${currentYear}-${m1}-${d1}`;

    if (dateRangeMatch[4]) {
      const m2 = (dateRangeMatch[3] || dateRangeMatch[1]).padStart(2, '0');
      const d2 = dateRangeMatch[4].padStart(2, '0');
      returnDate = `${currentYear}-${m2}-${d2}`;
    }
  }

  if (depart && !returnDate) {
    const d = new Date(depart);
    d.setDate(d.getDate() + (days - 1));
    returnDate = d.toISOString().slice(0, 10);
  }

  let airline = '精選航空';
  if (text.includes('虎航') || text.includes('台灣虎航')) airline = '台灣虎航';
  else if (text.includes('樂桃') || text.includes('樂桃航空')) airline = '樂桃航空';
  else if (text.includes('酷航')) airline = '酷航';
  else if (text.includes('華航') || text.includes('中華航空')) airline = '中華航空';
  else if (text.includes('長榮') || text.includes('長榮航空')) airline = '長榮航空';
  else if (text.includes('星宇') || text.includes('星宇航空')) airline = '星宇航空';
  else if (text.includes('泰亞航') || text.includes('亞航')) airline = '亞洲航空';

  let flightTime = '';
  for (const kw of ['早去晚回', '早去午回', '午去晚回', '早去早回', '午去午回', '晚去晚回', '紅眼早去晚回']) {
    if (text.includes(kw)) {
      flightTime = kw;
      break;
    }
  }

  let baggage = airline === '長榮航空' || airline === '中華航空' ? '含機上餐與來回託運行李' : '含來回託運行李（依清艙商品規格）';
  const bagMatch = text.match(/([1-3][0-9])\s*kg|([1-3][0-9])\s*公斤/i);
  if (bagMatch) {
    baggage = `含來回託運 ${bagMatch[1] || bagMatch[2]} 公斤`;
  }

  const code = cityCodeMap[city] || 'INT';
  const country = countryMap[city] || 'asia';
  const dateStr = depart && returnDate ? `${depart.slice(5).replace('-', '/')} – ${returnDate.slice(5).replace('-', '/')}` : `${days} 天清艙票`;

  return {
    id: `goflytrip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    city,
    code,
    from,
    fc,
    country,
    price: price || 8888,
    currency: 'TWD',
    depart,
    return: returnDate,
    duration: `${days} 天`,
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
    detail: `【飛趣旅遊 清艙機票】${text.slice(0, 150)}｜資訊來自於官方粉絲專頁`,
    rawMessage: text,
    collectedAt: new Date().toISOString()
  };
}
