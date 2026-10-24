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
  const [origin = '', destination = ''] = (title.match(/(?:桃園|台中|高雄|台北)-([^\s\d]+)/)?.[0] || '').split('-');
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
await page.goto(sourceUrl, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '清艙機票', exact: true }).click();
await page.waitForTimeout(800);

const heading = await page.locator('#home-ticket-calendar-title').locator('..').innerText();
const calendarYear = Number(heading.match(/(20\d{2})年/)?.[1] || new Date().getFullYear());
const eventButtons = page.locator('[role="button"]').filter({ hasText: /\d天\s*\|\s*\$\d+/ });
const eventCount = await eventButtons.count();
const collected = [];

async function closeTicketModal() {
  await page.keyboard.press('Escape').catch(() => {});

  // Flytour keeps prior Livewire modal instances in the DOM.  Close each
  // visible instance and wait for its overlay to disappear before continuing.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const visibleClose = page.locator('button:visible').filter({ hasText: /^(關閉|close)$/i });
    if (!(await visibleClose.count())) break;
    await visibleClose.first().click({ timeout: 3_000 }).catch(async () => {
      await visibleClose.first().evaluate(button => button.click()).catch(() => {});
    });
    await page.waitForTimeout(500);
  }
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).some(button => {
    const text = button.textContent?.trim() || '';
    const style = window.getComputedStyle(button);
    return /^(關閉|close)$/i.test(text) && style.display !== 'none' && style.visibility !== 'hidden';
  }), null, { timeout: 5_000 }).catch(() => {});
}

for (let index = 0; index < eventCount; index += 1) {
  const event = page.locator('[role="button"]').filter({ hasText: /\d天\s*\|\s*\$\d+/ }).nth(index);
  await event.click();
  const detail = await page.locator('body').innerText();
  const record = parseDetail(detail, calendarYear);
  if (record && !collected.some(item => item.id === record.id)) collected.push(record);
  await closeTicketModal();
}

await browser.close();
await mkdir(outputDir, { recursive: true });
await writeFile(outputFile, JSON.stringify({ source: sourceUrl, collectedAt: now, count: collected.length, deals: collected }, null, 2));
console.log(`已寫入 ${collected.length} 筆飛遊網清艙票：${outputFile.pathname}`);
