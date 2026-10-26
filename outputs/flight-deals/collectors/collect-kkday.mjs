import { mkdir, writeFile } from 'node:fs/promises';

const outputDir = new URL('../data/collected/', import.meta.url);
const outputFile = new URL('kkday-plan.json', outputDir);
const now = new Date().toISOString();

export async function collectKkday() {
  // KKday 計畫機票生命週期極短（通常為快閃清艙，幾天內即售罄下架）
  // 為確保前端不出現「已售罄／此商品目前無法購買」或死鏈，已下架之歷史商品（如 247091 等）全數清除
  // 僅保留官方即時機票專區連結，待未來有官方實時 API 再行掛載
  const deals = [];

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, JSON.stringify({
    source: 'KKday 計劃機票與清艙專區',
    sourceUrl: 'https://www.kkday.com/zh-tw/promo/flight_hotel',
    collectedAt: now,
    count: deals.length,
    deals
  }, null, 2));

  console.log(`[KKday] 清理完成，目前收錄 ${deals.length} 筆有效機票（避免已售罄死票）！已儲存至 kkday-plan.json`);
  return deals;
}

if (process.argv[1] === import.meta.filename) {
  collectKkday();
}
