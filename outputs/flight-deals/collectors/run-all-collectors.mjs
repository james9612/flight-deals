import { collectLionTravel } from './collect-liontravel.mjs';
import { collectPlynet } from './collect-plynet.mjs';
import { collectEzfly } from './collect-ezfly.mjs';
import { collectKkday } from './collect-kkday.mjs';
import { collectEhs } from './collect-ehs.mjs';
import { collectFuntime } from './collect-funtime.mjs';
import { collectExtendedAgencies } from './collect-extended-agencies.mjs';
import { collectUgoTravel } from './collect-ugotravel.mjs';
import { collectMomoDeals } from './collect-momo.mjs';
import { collectZeroPromos } from './collect-zero-promos.mjs';
import { mergeCollected } from './merge-collected.mjs';

console.log('=== [啟動多平台機票與 0 元機票自動蒐集引擎] ===\n');

async function safeStep(label, fn) {
  console.log(label);
  try {
    await fn();
  } catch (err) {
    console.warn(`⚠️ ${label} 執行時發生部分異常（已自動略過並保留快取）:`, err?.message || err);
  }
}

try {
  await safeStep('1. 正在爬取【雄獅旅遊】旅遊計畫票專區...', collectLionTravel);
  await safeStep('\n2. 正在爬取【飛遊網】特價清艙日曆...', collectPlynet);
  await safeStep('\n3. 正在整理【易飛網】神秘清艙與團體湊票...', collectEzfly);
  await safeStep('\n4. 正在整理【KKday】清艙機票與計畫票專區...', collectKkday);
  await safeStep('\n5. 正在爬取【東森旅遊／ETMall】計畫票與清艙專區...', collectEhs);
  await safeStep('\n6. 正在爬取【FunTime旅遊比價網】localtour 計畫機票專區...', collectFuntime);
  await safeStep('\n7. 正在整理【燦星旅遊、旅天下、山富旅遊、喜鴻假期】精選包機與計畫票...', collectExtendedAgencies);
  await safeStep('\n8. 正在動態爬取【旅天下 (U-Go Travel)】真實直購單品計畫機票...', collectUgoTravel);
  await safeStep('\n9. 正在動態爬取【momo購物網】真實直購計畫機票（含喜鴻假期等直購單品）...', collectMomoDeals);
  await safeStep('\n10. 正在抓取【各大航空公司】0 元機票與官方促銷特報...', collectZeroPromos);

  console.log('\n11. 正在執行多來源正規化、比價與去重整合管線...');
  await mergeCollected();

  console.log('\n=== [全部採集與聚合完成！] ===');
} catch (err) {
  console.error('整合流程發生異常，保留既有 deals.json 資料:', err);
}
