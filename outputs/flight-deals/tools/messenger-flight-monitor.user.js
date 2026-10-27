// ==UserScript==
// @name         ✈️ 飛行便宜・Messenger 清艙機票即時監聽外掛（對話/廣播專區全支援版）
// @namespace    https://james9612.github.io/flight-deals/
// @version      1.5.0
// @description  專注即時監聽 Facebook Messenger 聊天室與廣播專區（如飛趣搶票專區）之清艙機票，支援整頁對話機票批次掃描與即時入庫！
// @author       飛行便宜
// @match        *://*.messenger.com/*
// @match        *://messenger.com/*
// @match        *://*.facebook.com/*
// @match        *://facebook.com/*
// @match        https://www.facebook.com/messages/*
// @match        https://www.facebook.com/messages/t/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        window.onurlchange
// @connect      localhost
// @connect      127.0.0.1
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
  let scanDebounceTimer = null;

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString();
  }

  // 檢查是否為機票相關訊息（精準識別，支援 comma 數字、飛趣特有格式、去除已讀等狀態雜訊）
  function isFlightMessage(rawText) {
    if (!rawText || rawText.length < 10) return false;

    // 清除時間戳記、已讀狀態標記與系統提示
    let text = rawText
      .replace(/(?:上午|下午)?\s*\d{1,2}:\d{2}(?:\s*·\s*已讀)?/g, '')
      .replace(/·\s*已讀/g, '')
      .replace(/端對端加密/g, '')
      .replace(/未讀訊息/g, '')
      .trim();

    // 排除純系統提示、導航、粉絲頁自介
    if (
      text.includes('請告訴我們該如何為你提供協助') ||
      text.includes('上線狀態指示燈') ||
      text.includes('萬位追蹤者') ||
      text.includes('正在追蹤') ||
      text.includes('營業時間') ||
      text.includes('撥打電話') ||
      text.includes('語音通話') ||
      text.includes('發送訊息') ||
      (text.match(/Facebook/gi) || []).length >= 3 ||
      /^(?:已讀|已傳送|未讀訊息)$/.test(text)
    ) {
      return false;
    }

    // 必須含有價格特徵（支援 7,888、5988、NT$、TWD、$、特價、費用、：7888 等）
    const hasPrice = 
      /(?:NT\$|TWD|\$|特價|只要|機票|一口價|費用|💵|票價|：|:)\s*([0-9]{1,2}[,\.][0-9]{3}|[3-9][0-9]{3}|[1-5][0-9]{4})/i.test(text) ||
      /\b([3-9][0-9]{3}|[1-5][0-9]{4})\b/.test(text) ||
      /\b[0-9]{1,2},[0-9]{3}\b/.test(text);

    // 航點與航空關鍵字
    const destKeywords = [
      '東京', '成田', '羽田', '大阪', '關西', '沖繩', '那霸', '首爾', '仁川', '釜山', '曼谷', '富國島',
      '名古屋', '福岡', '北海道', '札幌', '新千歲', '函館', '高松', '岡山', '大分', '佐賀', '福島',
      '廣島', '高知', '石垣島', '仙台', '小松', '峴港', '清邁', '濟州', '大邱', '清州'
    ];
    const flightKeywords = [
      '機票', '清艙', '出清', '湊票', '特價', '機位', '含稅', '出發', '去回', '直飛', '搭', '航班',
      '虎航', '樂桃', '酷航', '華航', '長榮', '星宇', '泰亞航', '亞航', '越捷', '濟州航'
    ];

    let hasDest = destKeywords.some(c => text.includes(c));
    let hasFlightKw = flightKeywords.some(k => text.includes(k)) || text.includes('✈') || text.includes('◤');
    let hasDate = /[0-1]?[0-9]\/[0-3]?[0-9]/.test(text) || /[0-9]月[0-9]日/.test(text) || /[0-9]日機票/.test(text) || /[0-9]天機票/.test(text) || text.includes('🗓');

    // 判定條件
    if (hasDest && (hasPrice || hasDate) && hasFlightKw) return true;
    if (hasPrice && hasDate && (hasDest || hasFlightKw)) return true;
    if (text.includes('✈') && (hasPrice || hasDate)) return true;

    return false;
  }

  // 快速本機解析預覽文字
  function quickParsePreview(text) {
    let dest = '精選航點';
    for (const c of ['東京', '大阪', '沖繩', '札幌', '北海道', '福岡', '名古屋', '函館', '高松', '岡山', '大分', '佐賀', '福島', '廣島', '高知', '石垣島', '首爾', '釜山', '曼谷', '富國島']) {
      if (text.includes(c)) { dest = c; break; }
    }
    let price = '特惠價';
    const priceMatch = text.match(/(?:NT\$|TWD|\$|特價|只要|機票|費用|一口價|💵|：|:)\s*([0-9]{1,2}[,\.][0-9]{3}|[0-9]{4,5})/i) || text.match(/\$\s*([0-9]{4,5})/) || text.match(/\b([0-9]{1,2},[0-9]{3})\b/);
    if (priceMatch) price = 'NT$ ' + (priceMatch[1] || priceMatch[0]);

    let date = '';
    const dateMatch = text.match(/([0-1]?[0-9]\/[0-3]?[0-9])/);
    if (dateMatch) date = ` (${dateMatch[1]})`;

    return `${dest}${date} · ${price}`;
  }

  // 判定是否為對話視窗內的元素（嚴格排除左側聊天室列表、上方導航列與個人檔案右側欄）
  function isChatContext(element) {
    if (!element || typeof element.closest !== 'function') return false;

    // 嚴格排除側邊欄、導航列、頂部 Header、資訊欄與貼文牆
    if (element.closest('[role="navigation"], [aria-label="聊天室"], [aria-label="Chats"], [aria-label="對話列表"], [aria-label="對話清單"], [data-pagelet="LeftRail"], [role="complementary"], [role="feed"], header, [role="banner"]')) {
      return false;
    }

    // 接受對話主畫面中的元素
    if (element.closest('[role="main"], [aria-label*="訊息"], [data-pagelet*="Chat"], [data-pagelet*="Messages"], [role="gridcell"], [data-scope="messages_table"]')) {
      return true;
    }

    // 若在 /messages/ 路由下，且不在側邊欄，亦視為聊天主畫面
    if (window.location.pathname.includes('/messages/')) {
      return true;
    }

    return false;
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
      timeout: 5000,
      onload: function(response) {
        if (response.status === 200) {
          const res = JSON.parse(response.responseText);
          showToast(`🎉 成功同步！【${quickParsePreview(text)}】已即時寫入飛行便宜比價網！`, '#10b981');
          if (callback) callback(true, res);
        } else {
          showToast(`⚠️ 伺服器回傳 (${response.status})，已暫存至外掛本機庫`, '#f59e0b');
          if (callback) callback(false);
        }
      },
      onerror: function() {
        showToast(`🟡 本機接收伺服器未連線 (localhost:3500)，已安全暫存`, '#64748b');
        if (callback) callback(false);
      }
    });
  }

  // 檢查伺服器連線
  function checkServerHealth() {
    GM_xmlhttpRequest({
      method: 'GET',
      url: HEALTH_API,
      timeout: 2500,
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
        position: fixed; bottom: 85px; right: 25px; z-index: 9999999;
        background: ${bg}; color: white; padding: 12px 18px; border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.35); font-size: 14px; font-weight: 700;
        transition: all 0.3s; opacity: 0; transform: translateY(10px);
        max-width: 400px; line-height: 1.5; pointer-events: none;
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

  // 搜尋當前畫面上所有機票訊息
  function extractAllVisibleFlightMessages() {
    const mainContainer = document.querySelector('[role="main"]') || document.querySelector('[data-pagelet="Messages"]') || document.body;

    const selectors = [
      'div[dir="auto"]',
      'span[dir="auto"]',
      'div[role="gridcell"]',
      'div[role="row"]',
      'div[data-scope="messages_table"]'
    ];

    const elements = Array.from(mainContainer.querySelectorAll(selectors.join(', ')))
      .filter(el => isChatContext(el));

    const foundTexts = [];
    const seenTexts = new Set();

    for (const el of elements) {
      const text = (el.innerText || el.textContent || '').trim();
      if (!text || seenTexts.has(text) || text.length < 10) continue;

      if (isFlightMessage(text)) {
        // 去除子字串重複：若已存在更長的字串包含當前 text，則略過；反之若當前更完整則取代
        let shouldAdd = true;
        for (let i = 0; i < foundTexts.length; i++) {
          if (foundTexts[i].includes(text)) {
            shouldAdd = false;
            break;
          } else if (text.includes(foundTexts[i])) {
            foundTexts[i] = text;
            shouldAdd = false;
            break;
          }
        }
        if (shouldAdd) {
          foundTexts.push(text);
        }
        seenTexts.add(text);
      }
    }

    return foundTexts;
  }

  // 掃描並同步畫面中的機票（支援手動強制同步）
  function scanAllMessages(forceSync = false, isManual = false) {
    const messages = extractAllVisibleFlightMessages();

    if (messages.length === 0) {
      if (isManual) {
        showToast('🔍 目前畫面中未偵測到機票訊息（請確認是否已滾動至機票訊息處）', '#f59e0b');
      }
      return;
    }

    let newCount = 0;
    for (const text of messages) {
      const hash = simpleHash(text);
      if (forceSync || !seenHashes.has(hash)) {
        seenHashes.add(hash);
        newCount++;

        const summary = quickParsePreview(text);
        const time = new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });

        capturedDeals.unshift({ time, summary, text, url: window.location.href });
        if (capturedDeals.length > 50) capturedDeals.pop();

        if (isAutoSync || forceSync) {
          sendToServer(text);
        }
      }
    }

    GM_setValue('flight_deals_seen', JSON.stringify(Array.from(seenHashes)));
    GM_setValue('flight_deals_captured', JSON.stringify(capturedDeals));

    updateUIState();

    if (newCount > 0) {
      showToast(`⚡ 成功捕捉並同步 ${newCount} 筆機票快訊！`, '#10b981');
    } else if (isManual) {
      showToast(`ℹ️ 畫面中偵測到 ${messages.length} 筆機票，均已是最新收錄狀態！`, '#3b82f6');
    }
  }

  function updateUIState() {
    const countEl = document.getElementById('flight-count');
    if (countEl) countEl.textContent = capturedDeals.length;

    const histEl = document.getElementById('flight-history');
    if (histEl) {
      histEl.innerHTML = capturedDeals.length
        ? capturedDeals.map(d => `<div style="padding: 6px 0; border-bottom: 1px dashed #e2e8f0;"><b>${d.time}</b>：${d.summary}</div>`).join('')
        : '<div style="color: #94a3b8; text-align: center; padding: 12px;">尚無捕捉紀錄，正在背景即時監看中...</div>';
    }
  }

  // 建立浮動監聽控制面板 UI
  function createUI() {
    if (document.getElementById('flight-deals-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'flight-deals-widget';
    widget.style.cssText = `
      position: fixed; bottom: 25px; right: 25px; z-index: 9999998;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang TC", "Microsoft JhengHei", sans-serif;
    `;

    widget.innerHTML = `
      <!-- 主按鈕膠囊 -->
      <div id="flight-pill" style="
        background: #0f172a; color: white; padding: 11px 20px; border-radius: 30px;
        box-shadow: 0 8px 24px rgba(15,23,42,0.4); cursor: pointer; display: flex;
        align-items: center; gap: 9px; font-weight: 800; font-size: 14px;
        border: 2px solid #334155; transition: all 0.2s; user-select: none;
      ">
        <span id="flight-dot" style="width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; display: inline-block;"></span>
        <span>✈️ 飛行便宜・清艙監聽器</span>
        <span id="flight-count" style="background: #059669; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11.5px;">${capturedDeals.length}</span>
      </div>

      <!-- 展開控制面板 -->
      <div id="flight-panel" style="
        display: none; position: absolute; bottom: 58px; right: 0; width: 360px;
        background: #ffffff; border: 1px solid #cbd5e1; border-radius: 16px;
        box-shadow: 0 16px 36px rgba(15,23,42,0.25); padding: 18px; color: #0f172a;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          <b style="font-size: 15px;">📡 Messenger 清艙即時監聽器 v1.5</b>
          <button id="flight-close" style="background: none; border: 0; font-size: 16px; cursor: pointer; color: #64748b;">✕</button>
        </div>

        <div style="font-size: 12.5px; color: #475569; margin-bottom: 12px; line-height: 1.6;">
          <div>伺服器狀態：<b id="flight-status-text">連線偵測中...</b></div>
          <div style="margin-top: 3px;">接收端位址：<code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">localhost:3500</code></div>
          <div style="margin-top: 3px; font-size: 11.5px; color: #64748b;">專為飛趣官方頻道／廣播專區打造，支援自動滾動掃描</div>
        </div>

        <div style="display: flex; gap: 8px; margin-bottom: 10px;">
          <button id="btn-scan-all" style="
            flex: 1; background: #059669; color: white; border: 0; padding: 10px;
            border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;
          ">⚡ 掃描對話中所有機票</button>
          <button id="btn-force-sync" style="
            background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1;
            padding: 10px 12px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;
          ">🔄 強制同步</button>
        </div>

        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <button id="btn-copy-json" style="
            flex: 1; background: #f8fafc; color: #334155; border: 1px solid #cbd5e1;
            padding: 7px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;
          ">📋 複製已擷取 JSON</button>
          <button id="btn-clear-cache" style="
            background: #fff1f2; color: #e11d48; border: 1px solid #fecdd3;
            padding: 7px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;
          ">🗑️ 清除快取</button>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 8px 12px; border-radius: 8px; margin-bottom: 12px; font-size: 12.5px;">
          <span>新訊息自動同步至比價網</span>
          <input type="checkbox" id="chk-auto-sync" ${isAutoSync ? 'checked' : ''} style="cursor: pointer; transform: scale(1.2);">
        </div>

        <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px;">最近捕捉到的機票快訊 (${capturedDeals.length} 筆)：</div>
        <div id="flight-history" style="max-height: 160px; overflow-y: auto; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; background: #f8fafc;">
          ${capturedDeals.length ? capturedDeals.map(d => `<div style="padding: 6px 0; border-bottom: 1px dashed #e2e8f0;"><b>${d.time}</b>：${d.summary}</div>`).join('') : '<div style="color: #94a3b8; text-align: center; padding: 12px;">尚無捕捉紀錄，正在背景即時監看中...</div>'}
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    const pill = document.getElementById('flight-pill');
    const panel = document.getElementById('flight-panel');
    const closeBtn = document.getElementById('flight-close');
    const autoSyncChk = document.getElementById('chk-auto-sync');
    const scanBtn = document.getElementById('btn-scan-all');
    const forceBtn = document.getElementById('btn-force-sync');
    const copyBtn = document.getElementById('btn-copy-json');
    const clearBtn = document.getElementById('btn-clear-cache');

    pill.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      checkServerHealth();
      updateUIState();
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.style.display = 'none';
    });

    autoSyncChk.addEventListener('change', (e) => {
      isAutoSync = e.target.checked;
      GM_setValue('flight_deals_auto_sync', isAutoSync);
      showToast(isAutoSync ? '✅ 已開啟：偵測到新訊息自動同步' : '⏸️ 已關閉：切換為手動模式', '#3b82f6');
    });

    scanBtn.addEventListener('click', () => {
      scanAllMessages(false, true);
    });

    forceBtn.addEventListener('click', () => {
      scanAllMessages(true, true);
    });

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(JSON.stringify(capturedDeals, null, 2)).then(() => {
        showToast('📋 已將已擷取的機票 JSON 複製到剪貼簿！', '#10b981');
      });
    });

    clearBtn.addEventListener('click', () => {
      if (confirm('確定要清除外掛暫存的已看過機票紀錄嗎？')) {
        seenHashes.clear();
        capturedDeals = [];
        GM_setValue('flight_deals_seen', '[]');
        GM_setValue('flight_deals_captured', '[]');
        updateUIState();
        showToast('🗑️ 快取已清除完畢', '#64748b');
      }
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
      statusText.innerHTML = '<span style="color: #d97706;">🟡 伺服器未連線（請執行 啟動機票接收伺服器.bat）</span>';
    }
  }

  // DOM 變化監聽器（防抖自動觸發全畫面掃描）
  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      let hasRelevantChange = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          hasRelevantChange = true;
          break;
        }
      }

      if (hasRelevantChange) {
        if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
        scanDebounceTimer = setTimeout(() => {
          scanAllMessages(false, false);
        }, 1200);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 監聽單頁應用程式（SPA）路由切換
  function setupRouteWatcher() {
    const handleUrlChange = () => {
      console.log('✈️ [飛行便宜] 偵測到 Facebook 頁面切換：', window.location.href);
      createUI();
      setTimeout(() => scanAllMessages(false, false), 2500);
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);

    const origPush = history.pushState;
    history.pushState = function() {
      origPush.apply(this, arguments);
      handleUrlChange();
    };

    const origReplace = history.replaceState;
    history.replaceState = function() {
      origReplace.apply(this, arguments);
      handleUrlChange();
    };
  }

  // 啟動腳本
  function init() {
    createUI();
    setupObserver();
    setupRouteWatcher();
    console.log('✈️ [飛行便宜] Messenger 清艙即時監聽外掛 v1.5.0 已啟動！');

    // 延遲 2.5 秒自動執行初次全畫面掃描
    setTimeout(() => {
      scanAllMessages(false, false);
    }, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
  } else {
    setTimeout(init, 1000);
  }

  // 確保 SPA 切換頁面時浮動按鈕不被移除
  setInterval(() => {
    if (!document.getElementById('flight-deals-widget') && document.body) {
      createUI();
    }
  }, 4000);

})();
