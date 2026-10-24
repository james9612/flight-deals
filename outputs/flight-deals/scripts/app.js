let deals = [];
let promos = [];
let activeFilter = 'all';

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
  'KKday 機票自由行專區': 'agency-kkday'
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

function renderDeals() {
  const container = document.getElementById('cards');
  if (!container) return;

  const originVal = document.getElementById('origin')?.value || '';
  const destVal = document.getElementById('dest')?.value || '';
  const budgetVal = Number(document.getElementById('budget')?.value) || 999999;
  const departVal = document.getElementById('depart')?.value || '';
  const returnVal = document.getElementById('return')?.value || '';
  const sortVal = document.getElementById('sort')?.value || 'price';

  let filtered = deals.filter(deal => {
    // Agency / Type filtering
    if (activeFilter === 'lion' && !deal.source.includes('雄獅')) return false;
    if (activeFilter === 'plynet' && !deal.source.includes('飛遊網')) return false;
    if (activeFilter === 'cola' && !deal.source.includes('可樂')) return false;
    if (activeFilter === 'ezfly' && !deal.source.includes('易飛網')) return false;
    if (activeFilter === 'kkday' && !deal.source.includes('KKday') && !deal.agency?.includes('KKday')) return false;
    if (['japan', 'korea', 'asia'].includes(activeFilter) && deal.country !== activeFilter) return false;

    // Form criteria
    if (originVal && deal.from !== originVal) return false;
    if (destVal && !deal.city.includes(destVal)) return false;
    if (deal.price > budgetVal) return false;
    if (departVal && deal.depart && deal.depart < departVal) return false;
    if (returnVal && deal.return && deal.return > returnVal) return false;

    return true;
  });

  if (sortVal === 'price') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortVal === 'date') {
    filtered.sort((a, b) => (a.depart || '').localeCompare(b.depart || ''));
  }

  const emptyEl = document.getElementById('empty');
  if (emptyEl) emptyEl.style.display = filtered.length ? 'none' : 'block';

  container.innerHTML = filtered.map(d => {
    const agencyClass = agencyClassMap[d.agency] || agencyClassMap[d.source] || 'agency-lion';
    const datesPreview = d.availableDates ? `<div class="dates-preview"><b>可售出發日預覽：</b>${d.availableDates}</div>` : '';

    return `
      <article class="card">
        <div>
          <div class="cardtop">
            <div>
              <span class="agency-badge ${agencyClass}">${d.agency || d.source}</span>
              <span class="tag">${d.tag}</span>
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
              <b>固定日期計畫機票</b>
              含稅金與行李額度
            </div>
            <div class="fare-price-box">
              <span class="fare-currency">NT$</span>
              <span class="fare-amount">${d.price.toLocaleString()}</span>
              <span class="fare-suffix">起</span>
            </div>
          </div>

          <div class="detail-section">
            <p class="detail-text">${d.detail}</p>
            <div class="source-info-bar">
              <span>來源：<b>${d.source}</b></span>
              <span>更新：${d.checked}</span>
            </div>
            <a class="card-booking-btn" href="${d.sourceUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
              前往 ${d.agency || '旅行社'} 官網預訂 ↗
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');

  const countEl = document.querySelector('.search-count');
  if (countEl) countEl.textContent = `已聚合 ${deals.length} 筆旅行社計畫票（符合條件 ${filtered.length} 筆）`;
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
      renderDeals();
    });
  });

  // Search form
  const form = document.getElementById('form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      renderDeals();
      document.getElementById('deals')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Inputs
  ['origin', 'dest', 'depart', 'return', 'budget', 'sort'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', renderDeals);
  });

  // Quick examples
  const examples = {
    all: { origin: '', dest: '', depart: '', return: '' },
    osaka: { origin: '台北', dest: '大阪', depart: '', return: '' },
    okinawa: { origin: '台北', dest: '沖繩', depart: '', return: '' },
    seoul: { origin: '台北', dest: '首爾', depart: '', return: '' }
  };
  document.querySelectorAll('[data-example]').forEach(button => {
    button.addEventListener('click', () => {
      const ex = examples[button.dataset.example];
      if (!ex) return;
      Object.entries(ex).forEach(([k, v]) => {
        const input = document.getElementById(k);
        if (input) input.value = v;
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
      const type = document.getElementById('zeroType').value === 'base' ? '基本票價 0 元／超低價' : '含稅總價超低價';
      const result = document.getElementById('zeroFareResult');
      result.innerHTML = `<strong>已建立 0 元機票快報條件：${origin} ➔ ${destination}</strong><br>追蹤類型：${type}<br><span class="meta">當越捷、AirAsia、虎航發布該航線 0 元大促時將自動推播；搶購時需備妥護照中英文名。</span>`;
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
      result.innerHTML = `<strong>已建立異常票價偵測條件：${origin} ➔ ${destination}</strong><br>判定門檻：低於常態中位價 ${threshold}% 以上<br><span class="meta">偵測命中後需確認票規與是否包含稅金，並回到航空公司或出票方核驗。</span>`;
      result.hidden = false;
    });
  }
});
