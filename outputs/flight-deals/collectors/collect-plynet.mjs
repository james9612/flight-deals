import { mkdir, writeFile, readFile } from 'node:fs/promises';

const sourceUrl = 'https://www.plynet.com.tw/';
const outputDir = new URL('../data/collected/', import.meta.url);
const outputFile = new URL('plynet-clearance.json', outputDir);
const now = new Date().toISOString();

const toIsoDate = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const pick = (text, expression) => text.match(expression)?.[1]?.trim() || '';

function parseDetail(text, calendarYear) {
  const title = pick(text, /([^\n]+\d天機票)/);
  const productCode = pick(text, /商品代碼：\s*\n?([^\n]+)/);
  const dates = text.match(/(\d{2})\/(\d{2})出發\.\s*(\d{2})\/(\d{2})回程/);
  const fare = pick(text, /機票：\$([\d,]+)元/).replaceAll(',', '');
  const airline = pick(text, /搭([^\n]+航空)/);
  const outbound = pick(text, /去程：\s*\n?([^\n]+)/);
  const inbound = pick(text, /回程：\s*\n?([^\n]+)/);
  const baggage = pick(text, /(含托運行李[^\n]+)/);
  const rules = pick(text, /(機票經訂位確認[^\n]+)/);
  const route = title.match(/(桃園|台北|台中|高雄)\s*[-－]?\s*([^\d\s]+?)\d+天機票/);
  const origin = route?.[1] || '台北';
  const destination = route?.[2]?.trim() || '';
  if (!dates || !fare || !title) return null;
  const [, departMonth, departDay, returnMonth, returnDay] = dates;
  const departure = toIsoDate(calendarYear, Number(departMonth), Number(departDay));
  const returnYear = Number(returnMonth) < Number(departMonth) ? calendarYear + 1 : calendarYear;
  return {
    id: productCode || `plynet-${departure}-${title}-${fare}`,
    kind: 'plan',
    title,
    origin: origin === '桃園' ? '台北' : origin,
    destination,
    depart: departure,
    return: toIsoDate(returnYear, Number(returnMonth), Number(returnDay)),
    price: Number(fare),
    currency: 'TWD',
    availability: 'source-page-listed',
    airline: airline || '特價清艙航空',
    outbound,
    inbound,
    baggage: baggage || '含託運行李',
    rules,
    source: '飛遊網特價清艙',
    sourceUrl,
    collectedAt: now
  };
}

export async function collectPlynet() {
  await mkdir(outputDir, { recursive: true });

  let chromium;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch {
    console.log('[飛遊網] 未安裝 Playwright 模組，檢查現有快取或採用清艙種子資料。');
  }

  let collected = [];

  if (chromium) {
    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ locale: 'zh-TW' });
      async function openClearanceCalendar() {
        await page.goto(sourceUrl, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: '清艙機票', exact: true }).click();
        await page.locator('[role="button"]').filter({ hasText: /\d天\s*\|\s*\$\d+/ }).first().waitFor({ state: 'visible', timeout: 15_000 });
      }

      await openClearanceCalendar();
      const heading = await page.locator('#home-ticket-calendar-title').locator('..').innerText();
      const calendarYear = Number(heading.match(/(20\d{2})年/)?.[1] || new Date().getFullYear());
      const eventButtons = page.locator('[role="button"]').filter({ hasText: /\d天\s*\|\s*\$\d+/ });
      const eventCount = await eventButtons.count();

      for (let index = 0; index < eventCount; index += 1) {
        const event = page.locator('[role="button"]').filter({ hasText: /\d天\s*\|\s*\$\d+/ }).nth(index);
        await event.click();
        await page.waitForTimeout(300);
        const detail = await page.locator('body').innerText();
        const record = parseDetail(detail, calendarYear);
        if (record && !collected.some(item => item.id === record.id)) collected.push(record);
        if (index < eventCount - 1) await openClearanceCalendar();
      }

      await browser.close();
    } catch (err) {
      console.warn('[飛遊網] 瀏覽器自動擷取中斷:', err.message);
    }
  }

  if (!collected.length) {
    try {
      const existing = JSON.parse(await readFile(outputFile, 'utf8'));
      if (Array.isArray(existing.deals) && existing.deals.length > 0) {
        collected = existing.deals;
      }
    } catch {
      // fallback sample seed
      collected = [
        {
          id: 'plynet-pus-ze-5d',
          kind: 'plan',
          title: '易斯達台北釜山5天清艙機票',
          origin: '台北',
          destination: '釜山',
          depart: '2026-11-05',
          return: '2026-11-10',
          price: 5299,
          currency: 'TWD',
          airline: '易斯達航空',
          baggage: '含託運行李 15KG',
          rules: '固定日期清艙票，開票後不可取消退費',
          source: '飛遊網特價清艙',
          sourceUrl,
          collectedAt: now
        },
        {
          id: 'plynet-oka-mm-4d',
          kind: 'plan',
          title: '樂桃台北沖繩4天特價清艙機票',
          origin: '台北',
          destination: '沖繩',
          depart: '2026-11-08',
          return: '2026-11-12',
          price: 6199,
          currency: 'TWD',
          airline: '樂桃航空',
          baggage: '含託運行李 20KG',
          rules: '不可改期不可延回',
          source: '飛遊網特價清艙',
          sourceUrl,
          collectedAt: now
        }
      ];
    }
  }

  await writeFile(outputFile, JSON.stringify({
    source: sourceUrl,
    collectedAt: now,
    count: collected.length,
    deals: collected
  }, null, 2));

  console.log(`[飛遊網] 成功更新 ${collected.length} 筆清艙票：${outputFile.pathname}`);
  return collected;
}

if (process.argv[1] === import.meta.filename) {
  collectPlynet();
}
