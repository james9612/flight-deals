import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

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
  // 例如「11/07易斯達桃園釜山5天機票」：飛遊網通常不會在城市間放連字號。
  const route = title.match(/(桃園|台北|台中|高雄)\s*[-－]?\s*([^\d\s]+?)\d+天機票/);
  const origin = route?.[1] || '';
  const destination = route?.[2]?.trim() || '';
  if (!dates || !fare || !title) return null;
  const [, departMonth, departDay, returnMonth, returnDay] = dates;
  const departure = toIsoDate(calendarYear, Number(departMonth), Number(departDay));
  const returnYear = Number(returnMonth) < Number(departMonth) ? calendarYear + 1 : calendarYear;
  return {
    id: productCode || `plynet-${departure}-${title}-${fare}`,
    kind: 'plan',
    title,
    origin,
    destination,
    depart: departure,
    return: toIsoDate(returnYear, Number(returnMonth), Number(returnDay)),
    price: Number(fare),
    currency: 'TWD',
    availability: 'source-page-listed',
    airline,
    outbound,
    inbound,
    baggage,
    rules,
    source: '飛遊網特價清艙',
    sourceUrl,
    collectedAt: now
  };
}

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
const collected = [];

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
await mkdir(outputDir, { recursive: true });
await writeFile(outputFile, JSON.stringify({ source: sourceUrl, collectedAt: now, count: collected.length, deals: collected }, null, 2));
console.log(`已寫入 ${collected.length} 筆飛遊網清艙票：${outputFile.pathname}`);
