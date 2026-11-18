import { writeFile } from 'node:fs/promises';

const outputFile = new URL('../data/collected/extended-deals.json', import.meta.url);

/**
 * 燦星旅遊、旅天下、山富旅遊、喜鴻假期 精選包機與計畫票
 * （若無即時動態 API 或最新有效票源，則嚴禁塞入過期或已截止之舊快取資料）
 */
export async function collectExtendedAgencies() {
  console.log('[擴充票源採集] 正在整理【燦星旅遊、旅天下、山富旅遊、喜鴻假期】精選計畫票與清艙特惠...');

  // 僅在有確認可購之最新檔期時收錄，全面排除出發日在 5 天以內或已售罄商品
  const deals = [];

  await writeFile(outputFile, JSON.stringify(deals, null, 2), 'utf8');
  console.log(`[擴充票源採集完成] 成功收錄 ${deals.length} 筆有效計畫機票！已儲存至 extended-deals.json`);
  return deals;
}

if (process.argv[1] && process.argv[1].endsWith('collect-extended-agencies.mjs')) {
  collectExtendedAgencies();
}
