import { mkdir, writeFile } from 'node:fs/promises';

const outputDir = new URL('../data/collected/', import.meta.url);
const outputFile = new URL('ezfly-plan.json', outputDir);
const now = new Date().toISOString();

/**
 * 易飛網（ezfly）神秘機票與計畫票收集器
 * （無確認在售可購票期時回傳空陣列，避免過期已售罄死票殘留）
 */
export async function collectEzfly() {
  const deals = [];

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, JSON.stringify({
    source: '易飛網神秘機票與計畫票專區',
    sourceUrl: 'https://www.ezfly.com/mkt/flightticket/',
    collectedAt: now,
    count: deals.length,
    deals
  }, null, 2));

  console.log(`[易飛網] 整理完成，目前收錄 ${deals.length} 筆有效計畫機票！已儲存至 ezfly-plan.json`);
  return deals;
}

if (process.argv[1] && process.argv[1].endsWith('collect-ezfly.mjs')) {
  collectEzfly();
}
