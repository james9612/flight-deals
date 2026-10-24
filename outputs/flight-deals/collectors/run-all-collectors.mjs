import { collectLionTravel } from './collect-liontravel.mjs';
import { collectPlynet } from './collect-plynet.mjs';
import { collectColatour } from './collect-colatour.mjs';
import { collectEzfly } from './collect-ezfly.mjs';
import { collectKkday } from './collect-kkday.mjs';
import { collectZeroPromos } from './collect-zero-promos.mjs';
import { mergeCollected } from './merge-collected.mjs';

console.log('=== [啟動多平台機票與 0 元機票自動蒐集引擎] ===\n');

try {
  console.log('1. 正在爬取【雄獅旅遊】旅遊計畫票專區...');
  await collectLionTravel();

  console.log('\n2. 正在爬取【飛遊網】特價清艙日曆...');
  await collectPlynet();

  console.log('\n3. 正在整理【可樂旅遊】計畫旅遊票...');
  await collectColatour();

  console.log('\n4. 正在整理【易飛網】神秘清艙與團體湊票...');
  await collectEzfly();

  console.log('\n5. 正在整理【KKday】清艙機票與計畫票專區...');
  await collectKkday();

  console.log('\n6. 正在抓取【各大航空公司】0 元機票與官方促銷特報...');
  await collectZeroPromos();

  console.log('\n7. 正在執行多來源正規化、比價與去重整合管線...');
  await mergeCollected();

  console.log('\n=== [全部採集與聚合完成！] ===');
} catch (err) {
  console.error('採集流程發生錯誤:', err);
  process.exit(1);
}
