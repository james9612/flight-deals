import { collectLionTravel } from './collect-liontravel.mjs';
import { collectPlynet } from './collect-plynet.mjs';
import { collectEzfly } from './collect-ezfly.mjs';
import { collectKkday } from './collect-kkday.mjs';
import { collectEhs } from './collect-ehs.mjs';
import { collectFuntime } from './collect-funtime.mjs';
import { collectExtendedAgencies } from './collect-extended-agencies.mjs';
import { collectZeroPromos } from './collect-zero-promos.mjs';
import { mergeCollected } from './merge-collected.mjs';

console.log('=== [啟動多平台機票與 0 元機票自動蒐集引擎] ===\n');

try {
  console.log('1. 正在爬取【雄獅旅遊】旅遊計畫票專區...');
  await collectLionTravel();

  console.log('\n2. 正在爬取【飛遊網】特價清艙日曆...');
  await collectPlynet();

  console.log('\n3. 正在整理【易飛網】神秘清艙與團體湊票...');
  await collectEzfly();

  console.log('\n4. 正在整理【KKday】清艙機票與計畫票專區...');
  await collectKkday();

  console.log('\n5. 正在爬取【東森旅遊／ETMall】計畫票與清艙專區...');
  await collectEhs();

  console.log('\n6. 正在爬取【FunTime旅遊比價網】localtour 計畫機票專區...');
  await collectFuntime();

  console.log('\n7. 正在整理【燦星旅遊、旅天下、山富旅遊、喜鴻假期、momo購物網】精選計畫票...');
  await collectExtendedAgencies();

  console.log('\n8. 正在抓取【各大航空公司】0 元機票與官方促銷特報...');
  await collectZeroPromos();

  console.log('\n9. 正在執行多來源正規化、比價與去重整合管線...');
  await mergeCollected();

  console.log('\n=== [全部採集與聚合完成！] ===');
} catch (err) {
  console.error('採集流程發生錯誤:', err);
  process.exit(1);
}
