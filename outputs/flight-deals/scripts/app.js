// Ensure page opens at the top on initial load or refresh
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

// If URL contains an old hash from testing like #zero-fare, clean it up so reloads start at top
if (window.location.hash) {
  try {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch (e) {}
}

let deals = [];
let promos = [];
let activeFilter = 'all';
let currentPage = 1;
const PAGE_SIZE = 20;

const agencyClassMap = {
  '雄獅旅遊': 'agency-lion',
  '雄獅旅遊（Lion Travel）': 'agency-lion',
  '飛遊網': 'agency-plynet',
  '飛遊網特價清艙': 'agency-plynet',
  '易飛網': 'agency-ezfly',
  '易飛網（ezfly）': 'agency-ezfly',
  'KKday': 'agency-kkday',
  'KKday 機票自由行專區': 'agency-kkday',
  '東森旅遊': 'agency-ehs',
  '東森購物網・東森旅遊館': 'agency-ehs',
  'FunTime': 'agency-funtime',
  '飛趣旅遊': 'agency-goflytrip',
  '飛趣旅遊官方粉絲專頁': 'agency-goflytrip',
  '飛趣旅遊 Messenger 清艙': 'agency-goflytrip',
  '燦星旅遊': 'agency-startravel',
  '燦星旅遊官方網站': 'agency-startravel',
  '旅天下': 'agency-ugotravel',
  '旅天下官方網站': 'agency-ugotravel',
  '山富旅遊': 'agency-richmond',
  '山富旅遊機票網': 'agency-richmond',
  '喜鴻假期': 'agency-besttour',
  '喜鴻假期官網': 'agency-besttour',
  'momo購物網': 'agency-momo',
  'momo購物網・旅遊館': 'agency-momo'
};

// ==========================================
// 機票追蹤／我的最愛（Favorites & Wishlist）模組
// ==========================================
const FAVORITES_STORAGE_KEY = 'flight_favorites_v1';

function getFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    console.warn('讀取追蹤清單失敗:', e);
    return new Set();
  }
}

function saveFavorites(favSet) {
  try {
    const arr = Array.from(favSet);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn('儲存追蹤清單失敗:', e);
  }
}

function getDealId(d) {
  if (d.id) return String(d.id);
  const src = d.agency || d.source || '';
  const city = d.city || '';
  const date = d.date || d.depart || '';
  const price = d.price || '';
  return `${src}-${city}-${date}-${price}`.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_');
}

function updateFavoriteCount() {
  const count = getFavorites().size;
  const countEl = document.getElementById('fav-count');
  if (countEl) countEl.textContent = count;
  const navCountEl = document.getElementById('nav-fav-count');
  if (navCountEl) navCountEl.textContent = count;
}

window.toggleDealFavorite = function(dealId, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const favs = getFavorites();
  const isNowFav = !favs.has(dealId);
  if (isNowFav) {
    favs.add(dealId);
  } else {
    favs.delete(dealId);
  }
  saveFavorites(favs);
  updateFavoriteCount();

  if (activeFilter === 'favorites') {
    renderDeals();
  } else {
    // 即時更新畫面上所有具備相同 dealId 的愛心按鈕
    document.querySelectorAll('button.heart').forEach(btn => {
      if (btn.dataset.dealId === dealId) {
        btn.classList.toggle('active', isNowFav);
        btn.textContent = isNowFav ? '♥' : '♡';
        btn.title = isNowFav ? '已在追蹤清單（點擊取消）' : '加入追蹤清單';
        btn.setAttribute('aria-label', isNowFav ? '已在追蹤清單（點擊取消）' : '加入追蹤清單');
        btn.classList.add('heart-pop');
        setTimeout(() => btn.classList.remove('heart-pop'), 350);
      }
    });
  }
};

function renderPromos() {
  const container = document.getElementById('promos-grid');
  if (!container || !promos.length) return;

  container.innerHTML = promos.map(p => {
    const isZero = p.promoType === 'zero-fare';
    const routesHtml = p.routes.map(r => `<span class="route-tag">${r.from} ➔ ${r.to}</span>`).join('');
    return `
      <article class="promo-card">
        <div>
          <span class="promo-badge ${isZero ? 'zero' : ''}">
            ${isZero ? '🔥 0 元機票大促' : '⚡ 限時超低價閃購'} · ${p.badge}
          </span>
          <div class="promo-head">
            <span class="promo-airline">${p.airline}</span>
            <h3>${p.title}</h3>
          </div>

          <div class="promo-pricing">
            <div class="price-row">
              <span>促銷基本票價</span>
              <b>${p.baseFare === 0 ? 'NT$ 0 (免票價)' : `NT$ ${p.baseFare.toLocaleString()} 起`}</b>
            </div>
            <div class="price-row">
              <span>預估單程機場稅與手續費</span>
              <span>約 NT$ ${p.estTax.toLocaleString()}</span>
            </div>
            <div class="price-row total">
              <span>預估來回含稅到手總價</span>
              <span class="sum ${isZero ? 'zero-sum' : ''}">NT$ ${p.estTotalRoundtrip.toLocaleString()} 起</span>
            </div>
          </div>

          <div class="promo-routes">
            <div class="promo-routes-title">涵蓋熱門航線：</div>
            <div class="route-tags">${routesHtml}</div>
          </div>

          <div class="promo-period">
            <b>開搶時間：</b>${p.salesPeriod}<br>
            <b>搭乘期間：</b>${p.travelPeriod}
          </div>

          <div class="promo-tips">
            💡 <b>搶票秘訣：</b>${p.promoTips}
          </div>
        </div>

        <a class="promo-btn" href="${p.sourceUrl}" target="_blank" rel="noopener noreferrer">
          前往官網搶票公告 ↗
        </a>
      </article>
    `;
  }).join('');
}

function renderPagination(totalItems, totalPages) {
  const container = document.getElementById('pagination');
  if (!container) return;

  if (totalItems <= PAGE_SIZE) {
    container.innerHTML = '';
    return;
  }

  const startItem = (currentPage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(currentPage * PAGE_SIZE, totalItems);

  let html = `
    <div class="pagination-inner">
      <div class="page-info">
        第 <b>${currentPage}</b> / <b>${totalPages}</b> 頁（顯示第 ${startItem} – ${endItem} 筆，共 ${totalItems} 筆）
      </div>
      <div class="page-controls">
  `;

  // Previous button
  const isFirst = currentPage <= 1;
  html += `
    <button type="button" class="page-btn page-nav" ${isFirst ? 'disabled' : ''} data-page="1" title="第一頁">« 首頁</button>
    <button type="button" class="page-btn page-nav" ${isFirst ? 'disabled' : ''} data-page="${currentPage - 1}" title="上一頁">‹ 上一頁</button>
  `;

  // Numeric page buttons
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  if (startPage > 1) {
    html += `<button type="button" class="page-btn" data-page="1">1</button>`;
    if (startPage > 2) html += `<span class="page-ellipsis">…</span>`;
  }

  for (let p = startPage; p <= endPage; p++) {
    html += `<button type="button" class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="page-ellipsis">…</span>`;
    html += `<button type="button" class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  // Next button
  const isLast = currentPage >= totalPages;
  html += `
    <button type="button" class="page-btn page-nav" ${isLast ? 'disabled' : ''} data-page="${currentPage + 1}" title="下一頁">下一頁 ›</button>
    <button type="button" class="page-btn page-nav" ${isLast ? 'disabled' : ''} data-page="${totalPages}" title="最末頁">末頁 »</button>
  `;

  html += `</div></div>`;
  container.innerHTML = html;

  container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = Number(btn.dataset.page);
      if (p && p !== currentPage && p >= 1 && p <= totalPages) {
        currentPage = p;
        renderDeals();
        const dealsSection = document.getElementById('deals');
        if (dealsSection) {
          dealsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
}

function formatReleaseTime(d) {
  const tsStr = d.collectedAt || d.updatedAt || (d.checked ? `${d.checked}T00:00:00.000Z` : '');
  if (!tsStr) return { label: d.checked || '近期釋出', isRecent: false, isToday: false, isVeryFresh: false };

  const date = new Date(tsStr);
  if (isNaN(date.getTime())) return { label: d.checked || '近期釋出', isRecent: false, isToday: false, isVeryFresh: false };

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  const pad = n => String(n).padStart(2, '0');
  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const monthDayStr = `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;

  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (diffHours >= 0 && diffHours < 1) {
    const mins = Math.max(1, Math.floor(diffMs / 60000));
    return { label: `⚡ ${mins} 分鐘前釋出`, isRecent: true, isToday: true, isVeryFresh: true, timeStr };
  } else if (isToday) {
    return { label: `🟢 今日 ${timeStr} 釋出`, isRecent: true, isToday: true, isVeryFresh: false, timeStr };
  } else if (isYesterday) {
    return { label: `昨日 ${timeStr}`, isRecent: false, isToday: false, isVeryFresh: false, timeStr };
  } else {
    return { label: `${monthDayStr} ${timeStr}`, isRecent: false, isToday: false, isVeryFresh: false, timeStr };
  }
}

function cleanBaggageText(baggage) {
  if (!baggage) return '含來回託運';
  let s = baggage.replace(/^🧳\s*/, '').trim();
  if (s.includes('20公斤') || s.includes('20kg') || s.includes('20KG')) return '含來回託運 20kg';
  if (s.includes('23公斤') || s.includes('23kg') || s.includes('23KG')) return '含來回託運 23kg';
  if (s.length > 18) return s.slice(0, 16) + '...';
  return s;
}

function renderDeals() {
  const container = document.getElementById('cards');
  if (!container) return;

  const originVal = document.getElementById('origin')?.value || '';
  const destVal = document.getElementById('dest')?.value || '';
  const budgetVal = Number(document.getElementById('budget')?.value) || 999999;
  const departVal = document.getElementById('depart')?.value || '';
  const returnVal = document.getElementById('return')?.value || '';
  const sortVal = document.getElementById('sort')?.value || 'updated';

  const currentFavs = getFavorites();

  let filtered = deals.filter(deal => {
    const src = (deal.source || '').toLowerCase();
    const agn = (deal.agency || '').toLowerCase();

    // Agency / Type filtering
    if (activeFilter === 'favorites' && !currentFavs.has(getDealId(deal))) return false;
    if (activeFilter === 'lion' && !deal.source.includes('雄獅') && !deal.agency?.includes('雄獅')) return false;
    if (activeFilter === 'plynet' && !deal.source.includes('飛遊網') && !deal.agency?.includes('飛遊網')) return false;
    if (activeFilter === 'ezfly' && !deal.source.includes('易飛網') && !deal.agency?.includes('易飛網')) return false;
    if (activeFilter === 'kkday' && !src.includes('kkday') && !agn.includes('kkday')) return false;
    if (activeFilter === 'ehs' && !deal.source.includes('東森') && !deal.agency?.includes('東森')) return false;
    if (activeFilter === 'funtime' && !src.includes('funtime') && !agn.includes('funtime')) return false;
    if (activeFilter === 'goflytrip' && !src.includes('飛趣') && !agn.includes('飛趣')) return false;
    if (activeFilter === 'startravel' && !src.includes('燦星') && !agn.includes('燦星')) return false;
    if (activeFilter === 'ugotravel' && !src.includes('旅天下') && !agn.includes('旅天下')) return false;
    if (activeFilter === 'richmond' && !src.includes('山富') && !agn.includes('山富')) return false;
    if (activeFilter === 'besttour') {
      if (agn.includes('momo') || src.includes('momo')) return false; // MOMO販售喜鴻假期的部分分類一樣放在MOMO
      if (!src.includes('喜鴻') && !agn.includes('喜鴻') && !(deal.detail || '').includes('喜鴻') && !(deal.tag || '').includes('喜鴻')) return false;
    }
    if (activeFilter === 'momo' && !src.includes('momo') && !agn.includes('momo')) return false;
    if (['japan', 'korea', 'asia'].includes(activeFilter) && deal.country !== activeFilter) return false;

    // 過期機票自動過濾：出發日期已過（小於今天）自動排除
    const todayStr = new Date().toLocaleDateString('en-CA');
    if (deal.depart && deal.depart < todayStr) return false;

    // Form criteria
    if (originVal && deal.from !== originVal) return false;
    if (destVal && !deal.city.includes(destVal)) return false;
    if (deal.price > budgetVal) return false;
    if (departVal && deal.depart && deal.depart < departVal) return false;
    if (returnVal && deal.return && deal.return > returnVal) return false;

    return true;
  });

  if (sortVal === 'updated') {
    // 依即時釋出時間排序：最新釋出的機票排在最前面
    filtered.sort((a, b) => {
      const timeA = new Date(a.collectedAt || a.updatedAt || a.checked || 0).getTime();
      const timeB = new Date(b.collectedAt || b.updatedAt || b.checked || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return a.price - b.price;
    });
  } else if (sortVal === 'update-date') {
    // 依資料更新日期排序（由新到舊）：同一天內價格由低到高
    filtered.sort((a, b) => {
      const dateA = a.checked || (a.collectedAt ? a.collectedAt.slice(0, 10) : '0000-00-00');
      const dateB = b.checked || (b.collectedAt ? b.collectedAt.slice(0, 10) : '0000-00-00');
      if (dateB !== dateA) return dateB.localeCompare(dateA);
      return a.price - b.price;
    });
  } else if (sortVal === 'update-date-asc') {
    // 依資料更新日期排序（由舊到新）：同一天內價格由低到高
    filtered.sort((a, b) => {
      const dateA = a.checked || (a.collectedAt ? a.collectedAt.slice(0, 10) : '9999-99-99');
      const dateB = b.checked || (b.collectedAt ? b.collectedAt.slice(0, 10) : '9999-99-99');
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return a.price - b.price;
    });
  } else if (sortVal === 'price') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortVal === 'price-desc') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sortVal === 'date') {
    filtered.sort((a, b) => (a.depart || '9999-99-99').localeCompare(b.depart || '9999-99-99'));
  } else if (sortVal === 'date-desc') {
    filtered.sort((a, b) => (b.depart || '0000-00-00').localeCompare(a.depart || '0000-00-00'));
  }

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const searchCountEl = document.querySelector('.search-count');
  if (searchCountEl) {
    searchCountEl.textContent = `共 ${totalItems} 筆計畫票`;
  }

  const emptyEl = document.getElementById('empty');
  if (emptyEl) {
    if (totalItems > 0) {
      emptyEl.style.display = 'none';
    } else {
      emptyEl.style.display = 'block';
      if (activeFilter === 'favorites') {
        emptyEl.innerHTML = `
          <div style="font-size:36px;margin-bottom:8px;">❤️</div>
          <div style="font-size:18px;font-weight:700;color:#1e293b;margin-bottom:6px;">目前尚未有追蹤的機票</div>
          <div style="color:#64748b;font-size:14px;max-width:440px;margin:0 auto 16px;line-height:1.6;">
            瀏覽機票卡片時，點擊右上角 ♡ 愛心符號，即可將心儀機票加入追蹤清單，方便隨時比價與掌握釋出動態！
          </div>
          <button type="button" onclick="document.querySelector('[data-filter=\\'all\\']').click()" style="background:#e11d48;color:#fff;border:none;padding:9px 20px;border-radius:20px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(225,29,72,0.25);">瀏覽全部機票 ✈️</button>
        `;
      } else {
        emptyEl.textContent = '目前沒有符合該條件的計畫票，建議放寬預算或目的地。';
      }
    }
  }

  // 30 items per page pagination
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  container.innerHTML = paginated.map(d => {
    const agencyClass = agencyClassMap[d.agency] || agencyClassMap[d.source] || 'agency-lion';
    const datesPreview = d.availableDates ? `<div class="dates-preview"><b>可售出發日預覽：</b>${d.availableDates}</div>` : '';

    // Direct booking button text
    let btnText = `前往 ${d.agency || '旅行社'} 商品頁預訂 ↗`;
    let directUrl = d.sourceUrl || '#';

    if ((d.agency || '').includes('飛遊網') || (d.source || '').includes('飛遊網')) {
      btnText = `前往 飛遊網官網查看清艙機票 ↗`;
      directUrl = 'https://www.plynet.com.tw/';
    } else if ((d.agency || '').includes('FunTime')) {
      if (d.priceSaved > 0) {
        btnText = `前往 ${d.comparedAgency || '原廠'} 預訂（現省 $${d.priceSaved.toLocaleString()}）↗`;
      } else if (d.sourceUrl && d.sourceUrl.includes('liontravel.com')) {
        btnText = `前往 雄獅旅遊 預訂（FunTime特惠）↗`;
      } else if (d.sourceUrl && d.sourceUrl.includes('gounitravel.com')) {
        btnText = `前往 旅天下 預訂（FunTime特惠）↗`;
      } else if (d.sourceUrl && d.sourceUrl.includes('kkday.com')) {
        btnText = `前往 KKday 預訂（FunTime特惠）↗`;
      } else {
        btnText = `前往 FunTime 機票特惠預訂 ↗`;
      }
    } else if ((d.agency || '').includes('KKday')) {
      btnText = `前往 KKday 官方機票預訂 ↗`;
    } else if ((d.agency || '').includes('東森')) {
      btnText = `前往 東森旅遊官方商品頁 ↗`;
    } else if ((d.agency || '').includes('易飛網')) {
      btnText = `前往 易飛網商品頁（直達本張票訂購）↗`;
    } else if ((d.agency || '').includes('飛趣') || (d.source || '').includes('飛趣')) {
      btnText = `前往 飛趣旅遊清艙（LINE: @flynow01）↗`;
      directUrl = 'https://line.me/R/ti/p/%40flynow01';
    } else if ((d.agency || '').includes('燦星')) {
      btnText = `前往 燦星旅遊官方包機商品頁 ↗`;
    } else if ((d.agency || '').includes('旅天下')) {
      btnText = `前往 旅天下官方商品頁 ↗`;
    } else if ((d.agency || '').includes('山富')) {
      btnText = `前往 山富旅遊官方商品頁 ↗`;
    } else if ((d.agency || '').includes('喜鴻') || (d.source || '').includes('喜鴻')) {
      btnText = `前往 喜鴻假期官方商品頁 ↗`;
    } else if ((d.agency || '').includes('momo')) {
      btnText = `前往 momo 購物網搶票 ↗`;
    }

    // Besttour URL 格式自動修正：將喜鴻舊版有 crash bug 的 e_web/travel 網址轉成直接開啟的新版 /itinerary/ 網址
    if (directUrl && directUrl.includes('besttour.com.tw/e_web/travel')) {
      const vMatch = directUrl.match(/[?&]v=([A-Za-z0-9_-]+)/);
      if (vMatch) {
        directUrl = `https://www.besttour.com.tw/itinerary/${vMatch[1]}`;
      }
    }

    // Safety fallback: ensure 飛遊網 never links to LINE
    if (((d.agency || '').includes('飛遊網') || (d.source || '').includes('飛遊網')) && directUrl.includes('line.me')) {
      directUrl = 'https://www.plynet.com.tw/';
    }

    // 精簡標籤：避免左上角旅行社與標籤文字重複
    let tagHtml = '';
    if (d.priceSaved > 0) {
      tagHtml = `<span class="tag tag-savings">🔥 比價現省 $${d.priceSaved.toLocaleString()}</span>`;
    } else if ((d.agency || '').includes('FunTime') && d.sourceUrl) {
      let subAgency = '';
      if (d.sourceUrl.includes('liontravel.com')) subAgency = '雄獅開票';
      else if (d.sourceUrl.includes('gounitravel.com')) subAgency = '旅天下開票';
      else if (d.sourceUrl.includes('kkday.com')) subAgency = 'KKday開票';
      if (subAgency) tagHtml = `<span class="tag tag-sub">${subAgency}</span>`;
    } else if (d.tag && !d.tag.includes(d.agency) && d.tag !== '旅行社計畫票') {
      tagHtml = `<span class="tag">${d.tag}</span>`;
    }

    // Extract flight schedule/times if available
    let flightTime = d.flightTime || '';
    if (!flightTime) {
      const text = `${d.title || ''} ${d.detail || ''}`;
      const timeKeywords = ['早去晚回', '早去午回', '午去晚回', '早去早回', '晚去晚回', '午去午回'];
      for (const kw of timeKeywords) {
        if (text.includes(kw)) {
          flightTime = kw;
          break;
        }
      }
    }

    const relTime = formatReleaseTime(d);
    const freshBadge = relTime.isRecent
      ? `<span class="badge-fresh-deal ${relTime.isVeryFresh ? 'pulse' : ''}">${relTime.isVeryFresh ? '⚡ 剛剛釋出' : '🟢 今日釋出'}</span>`
      : '';

    const dealId = getDealId(d);
    const isFav = currentFavs.has(dealId);

    return `
      <article class="card">
        <div class="card-body">
          <div class="cardtop">
            <div class="cardtop-left">
              <span class="agency-badge ${agencyClass}">${d.agency || d.source}</span>
              ${tagHtml}
              ${freshBadge}
            </div>
            <button type="button" class="heart ${isFav ? 'active' : ''}" data-deal-id="${dealId}" onclick="window.toggleDealFavorite('${dealId}', event)" title="${isFav ? '已在追蹤清單（點擊取消）' : '加入追蹤清單'}" aria-label="${isFav ? '已在追蹤清單（點擊取消）' : '加入追蹤清單'}">${isFav ? '♥' : '♡'}</button>
          </div>

          <div class="card-route-hero">
            <div class="route-city-group origin">
              <div class="route-city-name">${d.from || '台北'}</div>
              <div class="route-iata-code">${d.fc || 'TPE'}</div>
            </div>
            <div class="route-flight-divider">
              <span class="route-duration-pill">${d.duration || '5 天'}</span>
              <div class="route-flight-line">
                <span class="route-flight-icon">✈</span>
              </div>
              <span class="route-flight-type">來回直飛</span>
            </div>
            <div class="route-city-group destination">
              <div class="route-city-name dest-highlight">${d.city}</div>
              <div class="route-iata-code">${d.code || 'INT'}</div>
            </div>
          </div>

          <div class="card-specs-row">
            <div class="spec-pill">
              <span>📅</span>
              <span>${d.date}</span>
            </div>
            <div class="spec-pill">
              <span>✈</span>
              <span class="airline-highlight">${d.airline || d.air}</span>
            </div>
            <div class="spec-pill">
              <span>🧳</span>
              <span>${cleanBaggageText(d.baggage)}</span>
            </div>
          </div>

          ${flightTime ? `
          <div class="card-flight-time-box">
            <span>🕒</span>
            <span>班機時間：<b>${flightTime}</b></span>
          </div>` : ''}

          ${datesPreview}
        </div>

        <div class="card-footer-box">
          <div class="card-price-row">
            <div class="price-type-col">
              <span class="price-type-title">${d.depart ? '固定日期計畫機票' : '特惠湊票／清艙'}</span>
              <span class="price-type-sub">全額含稅與託運行李</span>
            </div>
            <div class="fare-price-box">
              ${d.priceSaved ? `<div class="original-price-del">${d.comparedAgency || '原廠'} NT$ ${(d.originalPrice || 0).toLocaleString()}</div>` : ''}
              <span class="fare-currency">NT$</span>
              <span class="fare-amount">${d.price.toLocaleString()}</span>
              <span class="fare-suffix">起</span>
            </div>
          </div>

          <div class="card-meta-status">
            <span class="card-update-time">
              <span class="update-dot ${relTime.isToday ? 'dot-active' : ''}"></span>
              <span>釋出更新：<b class="${relTime.isToday ? 'text-fresh' : ''}">${relTime.label}</b></span>
            </span>
            ${d.priceSaved ? `<span class="deal-savings-badge">已省 $${d.priceSaved.toLocaleString()}</span>` : ''}
          </div>

          <a class="card-booking-btn" href="${directUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
            <span class="btn-text-content">${btnText.replace(/↗$/, '').trim()}</span>
            <span class="btn-arrow" aria-hidden="true">↗</span>
          </a>
        </div>
      </article>
    `;
  }).join('');

  renderPagination(totalItems, totalPages);

  const countEl = document.querySelector('.search-count');
  if (countEl) {
    countEl.textContent = `已聚合 ${deals.length} 筆旅行社計畫票（符合條件 ${totalItems} 筆 · 第 ${currentPage}/${totalPages} 頁）`;
  }
}

function populateDestinationDropdown() {
  const destSelect = document.getElementById('dest');
  if (!destSelect || !deals.length) return;

  const currentVal = destSelect.value;
  const cityCounts = {};
  for (const deal of deals) {
    if (deal.city && deal.city !== '精選航點' && deal.city !== '其他城市') {
      cityCounts[deal.city] = (cityCounts[deal.city] || 0) + 1;
    }
  }

  const sortedCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);

  let html = `<option value="">所有航點 (${deals.length})</option>`;
  for (const [city, count] of sortedCities) {
    const selected = city === currentVal ? 'selected' : '';
    html += `<option value="${city}" ${selected}>${city} (${count})</option>`;
  }

  destSelect.innerHTML = html;
  if (currentVal && cityCounts[currentVal]) {
    destSelect.value = currentVal;
  }
}

function populateOriginDropdown() {
  const originSelect = document.getElementById('origin');
  if (!originSelect || !deals.length) return;

  const currentVal = originSelect.value;
  const originCounts = {};
  for (const deal of deals) {
    const from = deal.from || '台北';
    originCounts[from] = (originCounts[from] || 0) + 1;
  }

  let html = `<option value="">不限出發 (${deals.length})</option>`;
  for (const [orig, count] of Object.entries(originCounts)) {
    const selected = orig === currentVal ? 'selected' : '';
    html += `<option value="${orig}" ${selected}>${orig} (${count})</option>`;
  }

  originSelect.innerHTML = html;
  if (currentVal && originCounts[currentVal]) {
    originSelect.value = currentVal;
  }
}

async function syncLiveLocalDeals() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const localRes = await fetch(`http://localhost:3500/api/deals?v=${Date.now()}`, {
      cache: 'no-store',
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!localRes.ok) return false;
    const localDeals = await localRes.json();
    if (!Array.isArray(localDeals) || !localDeals.length) return false;

    const mergedMap = new Map();
    for (const d of deals) mergedMap.set(d.id, d);
    let hasChanges = false;
    for (const ld of localDeals) {
      const existing = mergedMap.get(ld.id);
      if (!existing || (ld.collectedAt && ld.collectedAt > (existing.collectedAt || '')) || (!existing.flightTime && ld.flightTime)) {
        mergedMap.set(ld.id, ld);
        hasChanges = true;
      }
    }
    if (hasChanges || localDeals.length !== deals.length) {
      deals = [...mergedMap.values()];
      populateDestinationDropdown();
      populateOriginDropdown();
      renderDeals();
      return true;
    }
  } catch {
    // 本機接收伺服器未開啟時靜默略過，使用線上 GitHub Pages 資料
  }
  return false;
}

async function loadData() {
  try {
    const ts = Date.now();
    const [dealsRes, promosRes] = await Promise.all([
      fetch(`data/deals.json?v=${ts}`, { cache: 'no-store' }),
      fetch(`data/promos.json?v=${ts}`, { cache: 'no-store' })
    ]);

    if (dealsRes.ok) {
      deals = await dealsRes.json();
    }
    if (promosRes.ok) {
      promos = await promosRes.json();
    }

    populateDestinationDropdown();
    populateOriginDropdown();
    renderPromos();
    renderDeals();

    // 若本機油猴接收伺服器 (localhost:3500) 有開啟，立即載入 0 秒差最新機票並每 15 秒自動同步
    await syncLiveLocalDeals();
    setInterval(syncLiveLocalDeals, 15000);
  } catch (err) {
    console.warn('載入資料發生問題，保留預設展示:', err);
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  updateFavoriteCount();
  loadData();

  // Filter pills
  document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('on'));
      pill.classList.add('on');
      activeFilter = pill.dataset.filter || 'all';
      currentPage = 1; // Always reset to page 1

      // 當點選區域分類快捷按鈕（日本航線、韓國航線、東南亞／澳門）時：
      // 自動清空「目的地航點」下拉選單（跳脫先前指定的單一城市，呈現該地區所有航點）
      if (['japan', 'korea', 'asia'].includes(activeFilter)) {
        const destEl = document.getElementById('dest');
        if (destEl) destEl.value = '';
      }

      // 當點選特定旅行社或追蹤清單時，清空衝突篩選，讓使用者完整查看商品
      if (activeFilter === 'favorites' || ['kkday', 'lion', 'ezfly', 'ehs', 'plynet', 'funtime', 'goflytrip', 'startravel', 'ugotravel', 'richmond', 'besttour', 'momo'].includes(activeFilter)) {
        const destEl = document.getElementById('dest');
        if (destEl) destEl.value = '';
        const departEl = document.getElementById('depart');
        if (departEl) departEl.value = '';
        const returnEl = document.getElementById('return');
        if (returnEl) returnEl.value = '';
        const originEl = document.getElementById('origin');
        if (originEl) originEl.value = ''; // Show all departure cities
        const budgetEl = document.getElementById('budget');
        if (budgetEl) budgetEl.value = '999999';
      }

      renderDeals();

      // Smoothly scroll down to the deals section so user immediately sees cards change!
      const dealsSection = document.getElementById('deals');
      if (dealsSection) {
        dealsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Search form
  const form = document.getElementById('form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      currentPage = 1;
      renderDeals();
      document.getElementById('deals')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Inputs
  ['origin', 'dest', 'depart', 'return', 'budget', 'sort'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        currentPage = 1;
        renderDeals();
      });
    }
  });

  // Quick examples
  const examples = {
    all: { origin: '', dest: '', depart: '', return: '', filter: 'all' },
    osaka: { origin: '台北', dest: '大阪', depart: '', return: '', filter: 'all' },
    okinawa: { origin: '台北', dest: '沖繩', depart: '', return: '', filter: 'all' },
    seoul: { origin: '台北', dest: '首爾', depart: '', return: '', filter: 'all' },
    kkday: { origin: '', dest: '', depart: '', return: '', filter: 'kkday' },
    ehs: { origin: '', dest: '', depart: '', return: '', filter: 'ehs' },
    funtime: { origin: '', dest: '', depart: '', return: '', filter: 'funtime' }
  };
  document.querySelectorAll('[data-example]').forEach(button => {
    button.addEventListener('click', () => {
      const ex = examples[button.dataset.example];
      if (!ex) return;
      currentPage = 1;
      Object.entries(ex).forEach(([k, v]) => {
        if (k === 'filter') {
          activeFilter = v;
          document.querySelectorAll('.pill').forEach(p => {
            p.classList.toggle('on', p.dataset.filter === v);
          });
        } else {
          const input = document.getElementById(k);
          if (input) input.value = v;
        }
      });
      renderDeals();
      document.getElementById('deals')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Zero Fare Alert form
  const zeroFareForm = document.getElementById('zeroFareForm');
  if (zeroFareForm) {
    zeroFareForm.addEventListener('submit', event => {
      event.preventDefault();
      const origin = document.getElementById('zeroOrigin').value;
      const destination = document.getElementById('zeroDestination').value || '所有航線';
      const type = document.getElementById('zeroType').value === 'base' ? '基本票價 0 元／免機票大促' : '含稅總價超低價';
      const result = document.getElementById('zeroFareResult');
      result.innerHTML = `<strong>✔ 已建立 0 元機票快報條件：${origin} ➔ ${destination}</strong><br>追蹤類型：${type}<br><span class="meta">💡 此為【介面功能預覽】，正式版將串接 LINE Notify 與瀏覽器即時推播，當越捷、AirAsia、虎航開賣時立即發送提醒！</span>`;
      result.hidden = false;
    });
  }

  // Mistake Fare form
  const mistakeForm = document.getElementById('mistakeFareForm');
  if (mistakeForm) {
    mistakeForm.addEventListener('submit', event => {
      event.preventDefault();
      const origin = document.getElementById('mistakeOrigin').value;
      const destination = document.getElementById('mistakeDestination').value.trim() || '全球／不限目的地';
      const threshold = document.getElementById('mistakeThreshold').value;
      const result = document.getElementById('mistakeFareResult');
      result.innerHTML = `<strong>✔ 已建立異常票價偵測條件：${origin} ➔ ${destination}</strong><br>判定門檻：低於常態中位價 ${threshold}% 以上<br><span class="meta">💡 此為【介面功能預覽】，正式版將自動對接歷史中位價與人工二度核驗機制！</span>`;
      result.hidden = false;
    });
  }

  // In-page navigation: auto-expand accordions and smooth-scroll without polluting URL bar
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    const hash = a.getAttribute('href');
    if (!hash || hash === '#') return;
    a.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(hash);
      if (!target) return;
      if (target.tagName.toLowerCase() === 'details') {
        target.open = true;
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
});
