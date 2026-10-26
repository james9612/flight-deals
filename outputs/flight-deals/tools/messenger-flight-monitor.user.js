// ==UserScript==
// @name         ✈️ 飛行便宜・Messenger 清艙機票即時監聽外掛（純聊天室/廣播頻道）
// @namespace    https://james9612.github.io/flight-deals/
// @version      1.4.0
// @description  專注即時監聽 Messenger 廣播頻道與聊天室（如飛趣旅遊搶票專區）之清艙機票，已完全停用並排除 Facebook 粉絲頁與動態貼文牆！
// @author       飛行便宜
// @match        *://*.messenger.com/*
// @match        *://messenger.com/*
// @match        *://*.facebook.com/messages/*
// @match        *://facebook.com/messages/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        window.onurlchange
// @connect      localhost
// @run-at       document-end
// ==/UserScript==

(function() {
  'use strict';

  const INGEST_API = 'http://localhost:3500/api/ingest';
  const HEALTH_API = 'http://localhost:3500/api/health';

  // 儲存已看過的訊息避免重複處理
  let seenHashes = new Set(JSON.parse(GM_getValue('flight_deals_seen', '[]')));
  let capturedDeals = JSON.parse(GM_getValue('flight_deals_captured', '[]'));
  let isAutoSync = GM_getValue('flight_deals_auto_sync', true);
  let isServerConnected = false;

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString();
  }

  // 檢查是否為機票相關訊息（嚴格防偽，排除側邊欄一般聊天問候）
  function isFlightMessage(text) {
    if (!text || text.length < 10) return false;

    // 排除個人對話、未讀通知、系統提示、粉專自介與重複 Facebook 導航文字
    const noisePatterns = ['未讀訊息', '端對端加密', '請告訴我們該如何為你提供協助', '傳送了', '查看全部', '撥打電話', '語音通話', '已讀', '萬位追蹤者', '正在追蹤', '上線狀態指示燈', '營業時間', '發送訊息'];
    for (const np of noisePatterns) {
      if (text.includes(np)) return false;
    }
    if ((text.match(/Facebook/gi) || []).length >= 3) return false;


    // 必須含有價格特徵 或 ✈ 航班標記
    const hasPriceOrFlight = text.includes('✈') || /(?:NT\$|TWD|\$|特價|只要|機票|一口價)\s*([0-9]{4,5})/i.test(text) || /\b([3-9][0-9]{3}|[1-2][0-9]{4})\b/.test(text);
    if (!hasPriceOrFlight) return false;

    // 必須含有日期或清艙關鍵字
    const hasDateOrClearance = /[0-1]?[0-9]\/[0-3]?[0-9]/.test(text) || /[0-9]月[0-9]日/.test(text) || text.includes('清艙') || text.includes('機票') || text.includes('日機票');
    if (!hasDateOrClearance) return false;

    const keywords = ['機票', '清艙', '出清', '湊票', '特價', '機位', '含稅', '出發', '去回', '虎航', '樂桃', '酷航', '華航', '長榮', '星宇', '泰亞航', '亞航', '東京', '大阪', '沖繩', '首爾', '釜山', '曼谷', '富國島', '名古屋', '福岡', '北海道', '札幌', '函館', '高松', '岡山', '大分', '佐賀', '福島', '廣島', '高知', '石垣島'];
    let hitCount = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) hitCount++;
    }
    return hitCount >= 2;
  }

  // 快速本機解析預覽
  function quickParsePreview(text) {
    let dest = '精選航點';
    for (const c of ['東京', '大阪', '沖繩', '札幌', '北海道', '福岡', '名古屋', '函館', '高松', '岡山', '大分', '佐賀', '福島', '廣島', '高知', '石垣島', '首爾', '釜山', '曼谷', '富國島']) {
      if (text.includes(c)) { dest = c; break; }
    }
    let price = '特惠價';
    const priceMatch = text.match(/(?:NT\$|TWD|\$|特價|只要|機票|費用|一口價)\s*([0-9]{1,2}[,\.][0-9]{3}|[0-9]{4,5})/i) || text.match(/\$\s*([0-9]{4,5})/);
    if (priceMatch) price = 'NT$ ' + priceMatch[1];
    return `${dest} · ${price}`;
  }

  // 發送訊息至本地接收伺服器
  function sendToServer(text, callback) {
    const payload = {
      text: text,
      url: window.location.href,
      author: '飛趣旅遊 Messenger 官方頻道',
      timestamp: new Date().toISOString()
    };


    GM_xmlhttpRequest({
      method: 'POST',
      url: INGEST_API,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(payload),
      timeout: 4000,
      onload: function(response) {
        if (response.status === 200) {
          const res = JSON.parse(response.responseText);
          showToast(`🎉 成功同步！【${quickParsePreview(text)}】已即時寫入飛行便宜比價網！`, '#10b981');
          if (callback) callback(true, res);
        } else {
          showToast(`⚠️ 伺服器回傳錯誤 (${response.status})，已暫存至本機`, '#f59e0b');
          if (callback) callback(false);
        }
      },
      onerror: function() {
        showToast(`🟡 未偵測到本機接收端 (localhost:3500)，已自動暫存至外掛本機資料庫`, '#64748b');
        if (callback) callback(false);
      }
    });
  }

  // 檢查伺服器連線
  function checkServerHealth() {
    GM_xmlhttpRequest({
      method: 'GET',
      url: HEALTH_API,
      timeout: 2000,
      onload: function(r) {
        isServerConnected = r.status === 200;
        updateStatusDot();
      },
      onerror: function() {
        isServerConnected = false;
        updateStatusDot();
      }
    });
  }

  // 浮動提示 Toast
  function showToast(msg, bg = '#0f172a') {
    let toast = document.getElementById('flight-deals-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'flight-deals-toast';
      toast.style.cssText = `
        position: fixed; bottom: 85px; right: 25px; z-index: 999999;
        background: ${bg}; color: white; padding: 12px 18px; border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3); font-size: 14px; font-weight: 700;
        transition: all 0.3s; opacity: 0; transform: translateY(10px);
        max-width: 380px; line-height: 1.5; pointer-events: none;
      `;
      document.body.appendChild(toast);
    }
    toast.style.background = bg;
    toast.innerHTML = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, 4500);
  }

  // 建立浮動監聽控制面板 UI
  function createUI() {
    if (document.getElementById('flight-deals-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'flight-deals-widget';
    widget.style.cssText = `
      position: fixed; bottom: 25px; right: 25px; z-index: 999998;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    widget.innerHTML = `
      <!-- 主按鈕膠囊 -->
      <div id="flight-pill" style="
        background: #0f172a; color: white; padding: 10px 18px; border-radius: 30px;
        box-shadow: 0 8px 24px rgba(15,23,42,0.35); cursor: pointer; display: flex;
        align-items: center; gap: 8px; font-weight: 800; font-size: 13.5px;
        border: 2px solid #334155; transition: all 0.2s; user-select: none;
      ">
        <span id="flight-dot" style="width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; display: inline-block;"></span>
        <span>✈️ 飛行便宜・清艙監聽器</span>
        <span id="flight-count" style="background: #059669; padding: 2px 7px; border-radius: 10px; font-size: 11px;">${capturedDeals.length}</span>
      </div>

      <!-- 展開控制面板 -->
      <div id="flight-panel" style="
        display: none; position: absolute; bottom: 55px; right: 0; width: 340px;
        background: #ffffff; border: 1px solid #cbd5e1; border-radius: 16px;
        box-shadow: 0 16px 36px rgba(15,23,42,0.2); padding: 18px; color: #0f172a;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          <b style="font-size: 15px;">📡 Facebook 粉專 ＆ Messenger 監聽</b>
          <button id="flight-close" style="background: none; border: 0; font-size: 16px; cursor: pointer; color: #64748b;">✕</button>
        </div>

        <div style="font-size: 12.5px; color: #475569; margin-bottom: 12px; line-height: 1.6;">
          <div>目前狀態：<b id="flight-status-text">連線偵測中...</b></div>
          <div style="margin-top: 4px;">接收端：<code style="background: #f1f5f9; padding: 2px 5px; border-radius: 4px;">localhost:3500</code></div>
        </div>

        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <button id="btn-manual-capture" style="
            flex: 1; background: #059669; color: white; border: 0; padding: 9px;
            border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;
          ">⚡ 擷取目前最新訊息</button>
          <button id="btn-copy-json" style="
            background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1;
            padding: 9px 12px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;
          ">📋 複製 JSON</button>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 8px 12px; border-radius: 8px; margin-bottom: 12px; font-size: 12.5px;">
          <span>自動同步至網站比價庫</span>
          <input type="checkbox" id="chk-auto-sync" ${isAutoSync ? 'checked' : ''} style="cursor: pointer; transform: scale(1.2);">
        </div>

        <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px;">最近捕捉到的機票快訊 (${capturedDeals.length} 筆)：</div>
        <div id="flight-history" style="max-height: 160px; overflow-y: auto; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; background: #f8fafc;">
          ${capturedDeals.length ? capturedDeals.map(d => `<div style="padding: 5px 0; border-bottom: 1px dashed #e2e8f0;"><b>${d.time}</b>：${d.summary}</div>`).join('') : '<div style="color: #94a3b8; text-align: center; padding: 12px;">尚無捕捉紀錄，正在背景自動監看...</div>'}
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    const pill = document.getElementById('flight-pill');
    const panel = document.getElementById('flight-panel');
    const closeBtn = document.getElementById('flight-close');
    const autoSyncChk = document.getElementById('chk-auto-sync');
    const manualBtn = document.getElementById('btn-manual-capture');
    const copyBtn = document.getElementById('btn-copy-json');

    pill.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      checkServerHealth();
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.style.display = 'none';
    });

    autoSyncChk.addEventListener('change', (e) => {
      isAutoSync = e.target.checked;
      GM_setValue('flight_deals_auto_sync', isAutoSync);
      showToast(isAutoSync ? '✅ 已開啟：新訊息自動傳送上架' : '⏸️ 已關閉：切換為手動審核模式', '#3b82f6');
    });

    manualBtn.addEventListener('click', () => {
      captureLatestMessage(true);
    });

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(JSON.stringify(capturedDeals, null, 2)).then(() => {
        showToast('📋 已將已擷取之機票資料 JSON 複製到剪貼簿！', '#10b981');
      });
    });

    checkServerHealth();
    setInterval(checkServerHealth, 15000);
  }

  function updateStatusDot() {
    const dot = document.getElementById('flight-dot');
    const statusText = document.getElementById('flight-status-text');
    if (!dot || !statusText) return;

    if (isServerConnected) {
      dot.style.background = '#10b981';
      dot.style.boxShadow = '0 0 8px #10b981';
      statusText.innerHTML = '<span style="color: #059669;">🟢 本機伺服器連線正常（即時同步中）</span>';
    } else {
      dot.style.background = '#f59e0b';
      dot.style.boxShadow = 'none';
      statusText.innerHTML = '<span style="color: #d97706;">🟡 離線暫存模式（伺服器未啟動）</span>';
    }
  }

  // 擷取最新一則 Messenger 聊天或廣播頻道訊息（只鎖定對話主畫面，完全避開側邊欄聯絡人列表與非對話元素）
  function captureLatestMessage(isManual = false) {
    const selectors = [
      'div[role="main"] div[dir="auto"]',
      'div[aria-label="訊息"] div[dir="auto"]',
      'div[data-pagelet="Messages"] div[dir="auto"]',
      'div[role="gridcell"] div[dir="auto"]'
    ];
    const messages = Array.from(document.querySelectorAll(selectors.join(', ')))
      .filter(el => !el.closest('[role="navigation"]') && !el.closest('[aria-label*="Chats"]') && !el.closest('[aria-label*="對話"]'));
    let latestValid = null;

    for (let i = messages.length - 1; i >= 0; i--) {
      const text = messages[i].innerText || messages[i].textContent || '';
      if (isFlightMessage(text)) {
        latestValid = text.trim();
        break;
      }
    }

    if (!latestValid) {
      if (isManual) showToast('🔍 畫面上目前未偵測到包含機票/特價關鍵字的訊息', '#f59e0b');
      return;
    }

    processNewMessage(latestValid, isManual);
  }

  // 處理新訊息
  function processNewMessage(text, forceSend = false) {
    const hash = simpleHash(text);
    if (!forceSend && seenHashes.has(hash)) return;

    seenHashes.add(hash);
    GM_setValue('flight_deals_seen', JSON.stringify(Array.from(seenHashes)));

    const summary = quickParsePreview(text);
    const time = new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });

    capturedDeals.unshift({ time, summary, text, url: window.location.href });
    if (capturedDeals.length > 30) capturedDeals.pop();
    GM_setValue('flight_deals_captured', JSON.stringify(capturedDeals));

    // 更新計數
    const countEl = document.getElementById('flight-count');
    if (countEl) countEl.textContent = capturedDeals.length;

    // 更新列表
    const histEl = document.getElementById('flight-history');
    if (histEl) {
      histEl.innerHTML = capturedDeals.map(d => `<div style="padding: 5px 0; border-bottom: 1px dashed #e2e8f0;"><b>${d.time}</b>：${d.summary}</div>`).join('');
    }

    if (isAutoSync || forceSend) {
      sendToServer(text);
    } else {
      showToast(`📝 偵測到新機票：【${summary}】（目前為手動模式，已暫存）`, '#3b82f6');
    }
  }

  // DOM 變化監聽器（即時監看 Messenger 聊天視窗跳出新對話）
  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          for (const node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const text = node.innerText || node.textContent || '';
              if (isFlightMessage(text)) {
                processNewMessage(text.trim());
              }
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 啟動腳本
  function init() {
    createUI();
    setupObserver();
    console.log('✈️ [飛行便宜] Messenger 清艙即時監聽外掛已就緒！');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1500));
  } else {
    setTimeout(init, 1500);
  }

  // 監聽單頁應用程式（SPA）路由變化
  if (window.onurlchange === null) {
    window.addEventListener('urlchange', (info) => {
      console.log('✈️ [飛行便宜] 偵測到頁面網址變更：', info.url);
      createUI();
      setTimeout(() => captureLatestMessage(false), 2000);
    });
  }

  // 確保 SPA 切換頁面時浮動按鈕不被移除
  setInterval(() => {
    if (!document.getElementById('flight-deals-widget') && document.body) {
      createUI();
    }
  }, 4000);

})();
