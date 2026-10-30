import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseSocialDeals } from './parse-social-deal.mjs';
import { mergeCollected } from './merge-collected.mjs';

const PORT = process.env.PORT || 3500;
const outputFile = new URL('../data/collected/goflytrip-deals.json', import.meta.url);
const dealsFile = new URL('../data/deals.json', import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

let gitSyncTimer = null;

function scheduleGitSync(addedCount) {
  if (gitSyncTimer) clearTimeout(gitSyncTimer);
  gitSyncTimer = setTimeout(() => {
    const cmd = `git -C "${repoRoot}" add outputs/flight-deals/data/collected/goflytrip-deals.json outputs/flight-deals/data/deals.json && git -C "${repoRoot}" commit -m "chore(goflytrip): auto-sync ${addedCount} new Messenger clearance deals" && git -C "${repoRoot}" push origin main`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.warn('[Git 自動同步提示] 略過或尚無變更需推送:', stderr?.trim() || err.message);
      } else {
        console.log('🚀 [Git 自動推送成功] 最新飛趣旅遊清艙機票已同步發佈至 GitHub Pages 線上網站！');
      }
    });
  }, 6000);
}

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
  // CORS & Chrome Private Network Access Headers (允許線上 GitHub Pages 直接即時讀取 localhost:3500)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

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

  // Live deals endpoint for instant 0-second frontend sync
  if (req.method === 'GET' && url.pathname === '/api/deals') {
    try {
      const rawDeals = await readFile(dealsFile, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(rawDeals);
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end('[]');
    }
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
        const sourceUrl = 'https://line.me/R/ti/p/%40flynow01';

        if (!rawText.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Text content is required' }));
          return;
        }

        console.log('\n[Messenger 監聽器收到新訊息]');
        console.log('來源：', sourceUrl);
        console.log('原文：', rawText.slice(0, 100), rawText.length > 100 ? '...' : '');

        const newDeals = parseSocialDeals(rawText, sourceUrl);
        if (!newDeals.length) {
          res.writeHead(422, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '無法解析為有效機票資訊' }));
          return;
        }

        console.log(`[成功解析 ${newDeals.length} 筆清艙機票]`);

        const existing = await loadExistingDeals();
        let addedCount = 0;

        for (const deal of newDeals) {
          const existingIdx = existing.findIndex(d =>
            d.id === deal.id ||
            (d.city === deal.city && d.from === deal.from && d.depart === deal.depart && Number(d.price) === Number(deal.price))
          );
          if (existingIdx === -1) {
            existing.unshift(deal);
            addedCount++;
          } else {
            // 若已存在相同航線/日期/價格，但缺少航班時間則補齊航班時間
            if (!existing[existingIdx].flightTime && deal.flightTime) {
              existing[existingIdx].flightTime = deal.flightTime;
              addedCount++;
            }
          }
        }

        if (addedCount > 0) {
          // 最多保留最新 120 筆突發清艙
          const trimmed = existing.slice(0, 120);
          await mkdir(new URL('../data/collected/', import.meta.url), { recursive: true });
          await writeFile(outputFile, JSON.stringify(trimmed, null, 2));

          // 自動執行聚合管線更新 deals.json
          await mergeCollected();
          console.log(`[聚合完成] 成功寫入 ${addedCount} 筆新機票至 deals.json！`);

          // 自動同步推送至 GitHub Pages
          scheduleGitSync(addedCount);
        } else {
          console.log('[略過重複] 所有訊息先前已收錄過。');
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, addedCount, totalParsed: newDeals.length, deals: newDeals }));
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
