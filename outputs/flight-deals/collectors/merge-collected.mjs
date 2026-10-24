import { readFile, writeFile } from 'node:fs/promises';

const baseFile = new URL('../data/deals.json', import.meta.url);
const flytourFile = new URL('../data/collected/plynet-clearance.json', import.meta.url);
const base = JSON.parse(await readFile(baseFile, 'utf8'));
const collected = JSON.parse(await readFile(flytourFile, 'utf8')).deals || [];
const countryByDestination = { 東京: 'japan', 大阪: 'japan', 沖繩: 'japan', 名古屋: 'japan', 石垣島: 'japan', 函館: 'japan', 釜山: 'korea', 仁川: 'korea' };
const daysBetween = (depart, returnDate) => Math.max(1, Math.round((new Date(returnDate) - new Date(depart)) / 86400000));
const normalized = collected.map(deal => ({
  id: deal.id,
  city: deal.destination || '未標示目的地',
  code: '',
  from: deal.origin === '桃園' ? '台北' : deal.origin,
  fc: deal.origin === '桃園' ? 'TPE' : '',
  country: countryByDestination[deal.destination] || 'asia',
  price: deal.price,
  depart: deal.depart,
  return: deal.return,
  duration: `${daysBetween(deal.depart, deal.return)} 天`,
  date: `${deal.depart.slice(5).replace('-', '/')} – ${deal.return.slice(5).replace('-', '/')}`,
  air: [deal.airline, deal.outbound, deal.inbound].filter(Boolean).join(' · '),
  source: deal.source,
  sourceUrl: deal.sourceUrl,
  checked: deal.collectedAt.slice(0, 10),
  tag: '自動蒐集清艙票',
  kind: 'plan',
  detail: [deal.title, deal.baggage, deal.rules].filter(Boolean).join('｜')
}));
const byId = new Map([...base, ...normalized].map(deal => [deal.id, deal]));
await writeFile(baseFile, JSON.stringify([...byId.values()], null, 2));
console.log(`已合併 ${normalized.length} 筆自動蒐集資料。`);
