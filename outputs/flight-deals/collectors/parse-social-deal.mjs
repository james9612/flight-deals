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

/**
 * 智慧解析社群／Messenger／Facebook 粉專口語化清艙文字（支援單篇文宣與多行匯總貼文）
 * @param {string} rawText 原始貼文文字
 * @param {string} sourceUrl 來源連結（預設為 Messenger 廣播專區）
 * @returns {Array<object>} 解析完成的機票資料陣列
 */
export function parseSocialDeals(rawText, sourceUrl = 'https://www.messenger.com/channel/goflytripTW') {
  if (!rawText || typeof rawText !== 'string') return [];

  const text = rawText.trim();
  const currentYear = new Date().getFullYear();
  const results = [];

  // 先檢測是否為「多行清艙清單匯總」（例如包含多個日期與價格行）
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const isMultiLineDigest = lines.filter(l => l.match(/\d{1,2}\/\d{1,2}.*?\d{4,5}/) || l.match(/✈.*?機票.*?\d{4,5}/)).length >= 2;

  if (isMultiLineDigest) {
    let currentBlockHeader = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('<') || line.startsWith('---') || line.startsWith('——') || line.includes('今天買什麼') || line.includes('沒寫就是')) continue;

      // 區塊標題（如：✈長榮 福岡4日機票 10700 或 ✈華航 廣島來回機票 12300）
      if (line.includes('✈') || (line.includes('機票') && line.match(/\d{4,5}/))) {
        currentBlockHeader = line;
        continue;
      }

      // 伴隨日期行（如：🗓️11/03、11/10、12/08、12/15 或 🗓️ : 12/31🌟6日）
      if (currentBlockHeader && (line.includes('🗓') || line.match(/^[0-1]?[0-9]\/[0-3]?[0-9]/))) {
        // 從 header 與 line 解析
        const combined = `${currentBlockHeader} ${line}`;
        const blockPriceM = currentBlockHeader.match(/([0-9]{4,5})/);
        const blockPrice = blockPriceM ? parseInt(blockPriceM[1], 10) : 9999;
        
        let blockDays = 5;
        const dayM = combined.match(/([3-8])\s*[日天]/);
        if (dayM) blockDays = parseInt(dayM[1], 10);

        let city = '精選航點';
        for (const c of Object.keys(cityCodeMap)) {
          if (combined.includes(c)) { city = (c === '新千歲') ? '北海道' : c; break; }
        }

        let from = '台北';
        let fc = 'TPE';
        if (combined.includes('高雄')) { from = '高雄'; fc = 'KHH'; }

        let airline = '精選航空';
        if (combined.includes('長榮')) airline = '長榮航空';
        else if (combined.includes('華航')) airline = '中華航空';
        else if (combined.includes('虎航')) airline = '台灣虎航';
        else if (combined.includes('星宇')) airline = '星宇航空';

        // 提取多個日期
        const datesMatches = line.matchAll(/([0-1]?[0-9])\/([0-3]?[0-9])/g);
        for (const dm of datesMatches) {
          const m = dm[1].padStart(2, '0');
          const d = dm[2].padStart(2, '0');
          const year = parseInt(m, 10) < 5 && new Date().getMonth() > 8 ? currentYear + 1 : currentYear;
          const depart = `${year}-${m}-${d}`;
          const retObj = new Date(depart);
          retObj.setDate(retObj.getDate() + (blockDays - 1));
          const returnDate = retObj.toISOString().slice(0, 10);

          results.push({
            id: `goflytrip-${cityCodeMap[city] || 'INT'}-${m}${d}-${blockPrice}-${Math.random().toString(36).slice(2, 5)}`,
            city,
            code: cityCodeMap[city] || 'INT',
            from,
            fc,
            country: countryMap[city] || 'japan',
            price: blockPrice,
            currency: 'TWD',
            depart,
            return: returnDate,
            duration: `${blockDays} 天`,
            date: `${m}/${d} – ${returnDate.slice(5).replace('-', '/')}`,
            airline,
            air: airline,
            baggage: '含託運行李（依清艙商品規格）',
            source: '飛趣旅遊 Messenger/粉專清艙',
            sourceUrl,
            checked: new Date().toISOString().slice(0, 10),
            tag: '飛趣突發清艙',
            agency: '飛趣旅遊',
            kind: 'plan',
            flightTime: combined.includes('早去晚回') ? '早去晚回' : (combined.includes('早去午回') ? '早去午回' : ''),
            detail: `【飛趣旅遊 突發清艙】${airline}直飛${city}${blockDays}日機票｜出發日：${depart}，含稅特惠價 NT$ ${blockPrice.toLocaleString()}，席次有限私訊小編搶位！`,
            rawMessage: combined,
            collectedAt: new Date().toISOString()
          });
        }
        continue;
      }

      // 標準單行清單格式：如 "10/29 酷航東京5日 7800→6" 或 "10/31、11/14 虎航大分5日 7888→4"
      const standardMatch = line.match(/^([0-1]?[0-9]\/[0-3]?[0-9](?:[、,][0-1]?[0-9]\/[0-3]?[0-9])*)\s+(.+?)\s+([0-9]{4,5})(?:up|→\d+)?/i);
      if (standardMatch) {
        const datesStr = standardMatch[1];
        const desc = standardMatch[2];
        const price = parseInt(standardMatch[3], 10);

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
        let fc = 'TPE';
        if (desc.includes('高雄')) { from = '高雄'; fc = 'KHH'; }
        else if (desc.includes('台中')) { from = '台中'; fc = 'RMQ'; }

        let airline = '精選航空';
        if (desc.includes('酷航')) airline = '酷航';
        else if (desc.includes('虎航')) airline = '台灣虎航';
        else if (desc.includes('樂桃')) airline = '樂桃航空';
        else if (desc.includes('華航')) airline = '中華航空';
        else if (desc.includes('長榮')) airline = '長榮航空';
        else if (desc.includes('泰獅')) airline = '泰國獅航';
        else if (desc.includes('泰亞航') || desc.includes('亞航')) airline = '亞洲航空';
        else if (desc.includes('星宇')) airline = '星宇航空';

        const dateParts = datesStr.split(/[、,]/);
        for (const dPart of dateParts) {
          const [m, d] = dPart.trim().split('/');
          if (!m || !d) continue;
          const year = parseInt(m, 10) < 5 && new Date().getMonth() > 8 ? currentYear + 1 : currentYear;
          const depart = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          const retDateObj = new Date(depart);
          retDateObj.setDate(retDateObj.getDate() + (days - 1));
          const returnDate = retDateObj.toISOString().slice(0, 10);

          results.push({
            id: `goflytrip-${cityCodeMap[city] || 'INT'}-${m}${d}-${price}-${Math.random().toString(36).slice(2, 5)}`,
            city,
            code: cityCodeMap[city] || 'INT',
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
            baggage: '含託運行李（依清艙商品規格）',
            source: '飛趣旅遊 Messenger/粉專清艙',
            sourceUrl,
            checked: new Date().toISOString().slice(0, 10),
            tag: '飛趣突發清艙',
            agency: '飛趣旅遊',
            kind: 'plan',
            flightTime: desc.includes('早去晚回') ? '早去晚回' : (desc.includes('早去午回') ? '早去午回' : ''),
            detail: `【飛趣旅遊 突發清艙】${desc}｜出發日：${depart}，含稅特惠價 NT$ ${price.toLocaleString()}，席次有限私訊小編搶位！`,
            rawMessage: line,
            collectedAt: new Date().toISOString()
          });
        }
      }
    }

    if (results.length > 0) {
      return results;
    }
  }

  // 單一訊息模式解析
  const single = parseSingleSocialDeal(text, sourceUrl);
  return single ? [single] : [];
}

// 相容舊有介面
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

  if (!depart) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    depart = tomorrow.toISOString().slice(0, 10);
    tomorrow.setDate(tomorrow.getDate() + (days - 1));
    returnDate = tomorrow.toISOString().slice(0, 10);
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

  let baggage = '含託運行李（依貼文公告）';
  const bagMatch = text.match(/([1-3][0-9])\s*kg|([1-3][0-9])\s*公斤/i);
  if (bagMatch) {
    baggage = `含來回託運 ${bagMatch[1] || bagMatch[2]} 公斤`;
  } else if (text.includes('含行李') || text.includes('含托運') || text.includes('含託運')) {
    baggage = '含來回託運行李';
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
    source: '飛趣旅遊 Messenger/粉專清艙',
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
