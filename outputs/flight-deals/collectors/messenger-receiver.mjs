import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseSocialDeal } from './parse-social-deal.mjs';
import { mergeCollected } from './merge-collected.mjs';

const PORT = process.env.PORT || 3500;
const outputFile = new URL('../data/collected/goflytrip-deals.json', import.meta.url);

async function loadExistingDeals() {
  try {
    const raw = await readFile(outputFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed.deals || []);
  } catch {
    return [];
  }
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Health check
  if (req.method === 'GET' && url.pathname === '/api/health') {
    const deals = await loadExistingDeals();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok', service: 'Messenger Ingestion Server', currentDealsCount: deals.length }));
    return;
  }

  // Ingestion endpoint
  if (req.method === 'POST' && url.pathname === '/api/ingest') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const rawText = payload.text || '';
        const sourceUrl = payload.url || 'https://www.messenger.com/channel/goflytripTW';

        if (!rawText.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Text content is required' }));
          return;
        }

        console.log('\n[Messenger 監聽器收到新訊息]');
        console.log('來源：', sourceUrl);
        console.log('原文：', rawText.slice(0, 100), rawText.length > 100 ? '...' : '');

        const deal = parseSocialDeal(rawText, sourceUrl);
        if (!deal) {
          res.writeHead(422, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '無法解析為有效機票資訊' }));
          return;
        }

        console.log(`[成功解析] ${deal.from} ➔ ${deal.city} | ${deal.airline} | NT$ ${deal.price.toLocaleString()} | ${deal.date}`);

        const existing = await loadExistingDeals();
        // 檢查是否已有相同內容防重複
        const isDuplicate = existing.some(d => d.rawMessage && d.rawMessage === deal.rawMessage);

        if (!isDuplicate) {
          existing.unshift(deal);
          // 最多保留最新 50 筆突發清艙
          const trimmed = existing.slice(0, 50);
          await mkdir(new URL('../data/collected/', import.meta.url), { recursive: true });
          await writeFile(outputFile, JSON.stringify(trimmed, null, 2));

          // 自動執行聚合管線更新 deals.json
          await mergeCollected();
          console.log('[聚合完成] 已自動將新機票同步寫入 deals.json！');
        } else {
          console.log('[略過重複] 此則訊息先前已收錄過。');
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, deal, duplicate: isDuplicate }));
      } catch (err) {
        console.error('[接收錯誤]', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`✈️  飛行便宜・Messenger 清艙接收端伺服器已啟動！`);
  console.log(`📡 接收監聽網址：http://localhost:${PORT}/api/ingest`);
  console.log(`💚 狀態健康檢查：http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});
