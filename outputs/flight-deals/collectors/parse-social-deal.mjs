const cityCodeMap = {
  東京: 'TYO', 成田: 'NRT', 羽田: 'HND', 大阪: 'KIX', 關西: 'KIX',
  沖繩: 'OKA', 那霸: 'OKA', 名古屋: 'NGO', 福岡: 'FUK', 札幌: 'CTS', 北海道: 'CTS',
  函館: 'HKD', 仙台: 'SDJ', 小松: 'KMQ', 高松: 'TAK', 高知: 'KCZ', 石垣島: 'ISG',
  首爾: 'ICN', 仁川: 'ICN', 釜山: 'PUS', 大邱: 'TAE', 濟州: 'CJU', 清州: 'CJJ',
  曼谷: 'BKK', 清邁: 'CNX', 富國島: 'PQC', 峴港: 'DAD', 新加坡: 'SIN', 吉隆坡: 'KUL'
};

const countryMap = {
  東京: 'japan', 成田: 'japan', 羽田: 'japan', 大阪: 'japan', 關西: 'japan',
  沖繩: 'japan', 那霸: 'japan', 名古屋: 'japan', 福岡: 'japan', 札幌: 'japan', 北海道: 'japan',
  函館: 'japan', 仙台: 'japan', 小松: 'japan', 高松: 'japan', 高知: 'japan', 石垣島: 'japan',
  首爾: 'korea', 仁川: 'korea', 釜山: 'korea', 大邱: 'korea', 濟州: 'korea', 清州: 'korea',
  曼谷: 'asia', 清邁: 'asia', 富國島: 'asia', 峴港: 'asia', 新加坡: 'asia', 吉隆坡: 'asia'
};

/**
 * 智慧解析社群／Messenger 口語化清艙文字
 * @param {string} rawText 原始貼文文字
 * @param {string} sourceUrl 來源連結（預設為 Messenger 廣播專區）
 */
export function parseSocialDeal(rawText, sourceUrl = 'https://www.messenger.com/channel/goflytripTW') {
  if (!rawText || typeof rawText !== 'string') return null;

  const text = rawText.trim();

  // 1. 目的地識別
  let city = '精選航點';
  for (const c of Object.keys(cityCodeMap)) {
    if (text.includes(c)) {
      city = (c === '成田' || c === '羽田') ? '東京' : (c === '關西' ? '大阪' : (c === '那霸' ? '沖繩' : c));
      break;
    }
  }

  // 2. 出發地識別
  let from = '台北';
  let fc = 'TPE';
  if (text.includes('高雄') || text.includes('小港')) {
    from = '高雄';
    fc = 'KHH';
  } else if (text.includes('台中') || text.includes('清泉崗')) {
    from = '台中';
    fc = 'RMQ';
  }

  // 3. 價格識別（尋找 NT$8888、8888元、只要 8,888、$8888 等）
  let price = 0;
  const priceMatches = text.match(/(?:NT\$|TWD|\$|特價|只要|機票|費用|一口價|只要)\s*([0-9]{1,2}[,\.][0-9]{3}|[0-9]{4,5})\s*(?:元|起|含稅|\/人|\b)/i)
    || text.match(/([0-9]{1,2},[0-9]{3}|[0-9]{4,5})\s*(?:元|含稅)/)
    || text.match(/\$\s*([0-9]{4,5})/);

  if (priceMatches) {
    price = parseInt(priceMatches[1].replace(/[,\.]/g, ''), 10);
  }

  // 防呆：若未找到合理機票價格（3000~40000），則不作為機票特價
  if (price < 2000 || price > 60000) {
    // 嘗試找純數字 4~5 位數
    const genericNum = text.match(/\b([3-9][0-9]{3}|[1-3][0-9]{4})\b/);
    if (genericNum) {
      price = parseInt(genericNum[1], 10);
    }
  }

  // 4. 天數識別
  let days = 5;
  const dayMatch = text.match(/([3-8])\s*天|([3-8])D|([3-8])d|([3-8])\s*日/);
  if (dayMatch) {
    days = parseInt(dayMatch[1] || dayMatch[2] || dayMatch[3] || dayMatch[4], 10);
  }

  // 5. 日期識別（支援 10/28~11/01、10/28、11月5日 等）
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
  } else {
    // 單一日期匹配出發日
    const singleDateMatch = text.match(/([0-1]?[0-9])[\/\.月]([0-3]?[0-9])日?\s*(?:出發|起飛|去程)?/);
    if (singleDateMatch) {
      const m1 = singleDateMatch[1].padStart(2, '0');
      const d1 = singleDateMatch[2].padStart(2, '0');
      depart = `${currentYear}-${m1}-${d1}`;
    }
  }

  // 若只有出發日沒有回程日，用天數推算回程日
  if (depart && !returnDate) {
    const d = new Date(depart);
    d.setDate(d.getDate() + (days - 1));
    returnDate = d.toISOString().slice(0, 10);
  }

  // 若都未標明日期，預設為即將出發的晚鳥清艙（明天起算）
  if (!depart) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    depart = tomorrow.toISOString().slice(0, 10);
    tomorrow.setDate(tomorrow.getDate() + (days - 1));
    returnDate = tomorrow.toISOString().slice(0, 10);
  }

  // 6. 航空公司識別
  let airline = '精選航空';
  if (text.includes('虎航') || text.includes('台灣虎航')) airline = '台灣虎航';
  else if (text.includes('樂桃') || text.includes('樂桃航空')) airline = '樂桃航空';
  else if (text.includes('酷航')) airline = '酷航';
  else if (text.includes('易斯達')) airline = '易斯達航空';
  else if (text.includes('德威')) airline = '德威航空';
  else if (text.includes('濟州')) airline = '濟州航空';
  else if (text.includes('真航空')) airline = '真航空';
  else if (text.includes('華航') || text.includes('中華航空')) airline = '中華航空';
  else if (text.includes('長榮') || text.includes('長榮航空')) airline = '長榮航空';
  else if (text.includes('星宇') || text.includes('星宇航空')) airline = '星宇航空';
  else if (text.includes('亞航') || text.includes('亞洲航空') || text.includes('泰亞航')) airline = '亞洲航空';
  else if (text.includes('越捷') || text.includes('越捷航空')) airline = '越捷航空';

  // 7. 班機時間（早去晚回等）
  let flightTime = '';
  for (const kw of ['早去晚回', '早去午回', '午去晚回', '早去早回', '午去午回', '晚去晚回', '紅眼早去晚回']) {
    if (text.includes(kw)) {
      flightTime = kw;
      break;
    }
  }

  // 8. 行李識別
  let baggage = '含託運行李（依貼文公告）';
  const bagMatch = text.match(/([1-3][0-9])\s*kg|([1-3][0-9])\s*公斤/i);
  if (bagMatch) {
    baggage = `含來回託運 ${bagMatch[1] || bagMatch[2]} 公斤`;
  } else if (text.includes('含行李') || text.includes('含托運') || text.includes('含託運')) {
    baggage = '含來回託運行李';
  } else if (text.includes('手提') && !text.includes('託運')) {
    baggage = '含手提行李（不含託運）';
  }

  const code = cityCodeMap[city] || 'INT';
  const country = countryMap[city] || 'asia';
  const dateStr = depart && returnDate ? `${depart.slice(5).replace('-', '/')} – ${returnDate.slice(5).replace('-', '/')}` : `${days} 天清艙票`;

  const dealId = `goflytrip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id: dealId,
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
    source: '飛趣旅遊 Messenger 清艙',
    sourceUrl,
    checked: new Date().toISOString().slice(0, 10),
    tag: '飛趣突發清艙',
    agency: '飛趣旅遊',
    kind: 'plan',
    flightTime,
    detail: `【飛趣旅遊 突發清艙】${text.slice(0, 180)}`,
    rawMessage: text,
    collectedAt: new Date().toISOString()
  };
}
