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
  '可樂旅遊': 'agency-cola',
  '可樂旅遊（Colatour）': 'agency-cola',
  '易飛網': 'agency-ezfly',
  '易飛網（ezfly）': 'agency-ezfly',
  'KKday': 'agency-kkday',
  'KKday 機票自由行專區': 'agency-kkday',
  '東森旅遊': 'agency-ehs',
  '東森購物網・東森旅遊館': 'agency-ehs',
  '東南旅遊': 'agency-settour',
  '東南旅遊（SETtour）機票館': 'agency-settour',
  'FunTime': 'agency-funtime',
  'FunTime旅遊比價網（localtour）': 'agency-funtime',
  '飛趣旅遊': 'agency-goflytrip',
  '飛趣旅遊官方粉絲專頁': 'agency-goflytrip',
  '飛趣旅遊 Messenger 清艙': 'agency-goflytrip'
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

function renderDeals() {
  const container = document.getElementById('cards');
  if (!container) return;

  const originVal = document.getElementById('origin')?.value || '';
  const destVal = document.getElementById('dest')?.value || '';
  const budgetVal = Number(document.getElementById('budget')?.value) || 999999;
  const departVal = document.getElementById('depart')?.value || '';
  const returnVal = document.getElementById('return')?.value || '';
  const sortVal = document.getElementById('sort')?.value || 'updated';

  let filtered = deals.filter(deal => {
    const src = (deal.source || '').toLowerCase();
    const agn = (deal.agency || '').toLowerCase();

    // Agency / Type filtering
    if (activeFilter === 'lion' && !deal.source.includes('雄獅') && !deal.agency?.includes('雄獅')) return false;
    if (activeFilter === 'plynet' && !deal.source.includes('飛遊網') && !deal.agency?.includes('飛遊網')) return false;
    if (activeFilter === 'cola' && !deal.source.includes('可樂') && !deal.agency?.includes('可樂')) return false;
    if (activeFilter === 'ezfly' && !deal.source.includes('易飛網') && !deal.agency?.includes('易飛網')) return false;
    if (activeFilter === 'kkday' && !src.includes('kkday') && !agn.includes('kkday')) return false;
    if (activeFilter === 'ehs' && !deal.source.includes('東森') && !deal.agency?.includes('東森')) return false;
    if (activeFilter === 'settour' && !deal.source.includes('東南') && !deal.agency?.includes('東南')) return false;
    if (activeFilter === 'funtime' && !src.includes('funtime') && !agn.includes('funtime')) return false;
    if (activeFilter === 'goflytrip' && !deal.source.includes('飛趣') && !deal.agency?.includes('飛趣')) return false;
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

  const emptyEl = document.getElementById('empty');
  if (emptyEl) emptyEl.style.display = totalItems ? 'none' : 'block';

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
        btnText = `前往 ${d.comparedAgency || '原廠'} 預訂（比價現省 $${d.priceSaved.toLocaleString()}）↗`;
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
    } else if ((d.agency || '').includes('東南')) {
      btnText = `前往 東南旅遊官方機位預訂 ↗`;
    } else if ((d.agency || '').includes('東森')) {
      btnText = `前往 東森旅遊官方商品頁 ↗`;
    } else if ((d.agency || '').includes('易飛網')) {
      btnText = `前往 易飛網商品頁（直達本張票訂購）↗`;
    } else if ((d.agency || '').includes('飛趣') || (d.source || '').includes('飛趣')) {
      btnText = `前往 飛趣旅遊清艙（LINE: @flynow01）↗`;
      directUrl = 'https://line.me/R/ti/p/%40flynow01';
    }

    // Safety fallback: ensure 飛遊網 never links to LINE
    if (((d.agency || '').includes('飛遊網') || (d.source || '').includes('飛遊網')) && directUrl.includes('line.me')) {
      directUrl = 'https://www.plynet.com.tw/';
    }

    let tagText = d.tag;
    let tagClass = 'tag';
    if (d.priceSaved > 0) {
      tagText = `🔥 比價現省 $${d.priceSaved.toLocaleString()}`;
      tagClass = 'tag tag-savings';
    } else if ((d.agency || '').includes('FunTime') && d.sourceUrl) {
      if (d.sourceUrl.includes('liontravel.com')) tagText = 'FunTime彙整・雄獅開票';
      else if (d.sourceUrl.includes('gounitravel.com')) tagText = 'FunTime彙整・旅天下開票';
      else if (d.sourceUrl.includes('kkday.com')) tagText = 'FunTime彙整・KKday開票';
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
    const flightTimeHtml = flightTime ? `
      <div class="flight-time-row">
        <span class="flight-time-badge">🕒 班機時間：<b>${flightTime}</b></span>
      </div>` : '';

    const relTime = formatReleaseTime(d);
    const freshBadge = relTime.isRecent
      ? `<span class="badge-fresh-deal ${relTime.isVeryFresh ? 'pulse' : ''}">${relTime.isVeryFresh ? '⚡ 剛剛釋出' : '🟢 今日釋出'}</span>`
      : '';

    return `
      <article class="card">
        <div>
          <div class="cardtop">
            <div class="cardtop-left">
              <span class="agency-badge ${agencyClass}">${d.agency || d.source}</span>
              <span class="${tagClass}">${tagText}</span>
              ${freshBadge}
            </div>
            <button class="heart" onclick="event.stopPropagation();this.textContent=this.textContent==='♡'?'♥':'♡'">♡</button>
          </div>

          <div class="card-header-dest">
            <span class="dest-city-large">${d.city}</span>
            <span class="dest-duration-badge">${d.duration}</span>
          </div>

          <div class="flight-meta-row">
            <span>📅 ${d.date}</span>
            <span>·</span>
            <span class="airline-highlight">✈ ${d.airline || d.air}</span>
          </div>

          ${flightTimeHtml}

          <div><span class="baggage-pill">🧳 ${d.baggage || '含來回託運行李'}</span></div>

          <div class="route-box">
            <div class="route-endpoint">
              <div class="route-iata">${d.fc}</div>
              <div class="route-city-label">${d.from}</div>
            </div>
            <div class="route-center">
              <div class="route-line"></div>
              <span class="route-flight-type">來回直飛</span>
            </div>
            <div class="route-endpoint">
              <div class="route-iata">${d.code}</div>
              <div class="route-city-label">${d.city}</div>
            </div>
          </div>

          ${datesPreview}
        </div>

        <div>
          <div class="card-foot-pricing">
            <div class="foot-info">
              <b>${d.depart ? '固定日期計畫機票' : '多梯次特惠機票'}</b>
              含稅金與行李額度
            </div>
            <div class="fare-price-box">
              ${d.priceSaved ? `<div class="original-price-del">${d.comparedAgency || '原廠'} NT$ ${(d.originalPrice || 0).toLocaleString()}</div>` : ''}
              <span class="fare-currency">NT$</span>
              <span class="fare-amount">${d.price.toLocaleString()}</span>
              <span class="fare-suffix">起</span>
            </div>
          </div>

          <div class="detail-section">
            <p class="detail-text">${d.detail}</p>
            <div class="source-info-bar">
              <span>來源：<b>${d.source}</b></span>
              <span class="deal-update-time">🕒 釋出更新：<b class="${relTime.isToday ? 'text-fresh' : ''}">${relTime.label}</b></span>
            </div>
            <a class="card-booking-btn" href="${directUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
              ${btnText}
            </a>
          </div>
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

async function loadData() {
  try {
    const [dealsRes, promosRes] = await Promise.all([
      fetch('data/deals.json', { cache: 'no-store' }),
      fetch('data/promos.json', { cache: 'no-store' })
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
  } catch (err) {
    console.warn('載入資料發生問題，保留預設展示:', err);
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  // Filter pills
  document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('on'));
      pill.classList.add('on');
      activeFilter = pill.dataset.filter || 'all';
      currentPage = 1; // Always reset to page 1

      // When clicking a specific agency filter, clear conflicting inputs so user immediately sees that agency's complete inventory
      if (['kkday', 'lion', 'cola', 'ezfly', 'ehs', 'plynet', 'settour', 'funtime'].includes(activeFilter)) {
        const destEl = document.getElementById('dest');
        if (destEl) destEl.value = '';
        const departEl = document.getElementById('depart');
        if (departEl) departEl.value = '';
        const returnEl = document.getElementById('return');
        if (returnEl) returnEl.value = '';
        const originEl = document.getElementById('origin');
        if (originEl) originEl.value = ''; // Show all departure cities for this agency
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
    settour: { origin: '', dest: '', depart: '', return: '', filter: 'settour' },
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
