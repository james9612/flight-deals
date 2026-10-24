async function loadSources() {
  const container = document.getElementById("sources");
  const labels = {
    "plan-clearance": "旅行社計畫／清艙票",
    "airline-promo": "航空公司 0 元／促銷特報",
    "metasearch": "外部交叉查核比價"
  };

  try {
    const res = await fetch("data/sources.json", { cache: "no-store" });
    const sources = await res.json();
    container.innerHTML = sources.map(s => `
      <article class="source-card">
        <span class="status ${s.status.includes('已上線') ? 'online' : ''}">${s.status}</span>
        <div class="source-type">${labels[s.type] || s.type}</div>
        <h2>${s.name}</h2>
        <p>${s.access}</p>
        <p><b>檢查頻率：</b>${s.frequency}</p>
        <p>${s.notes}</p>
        <a href="${s.url}" target="_blank" rel="noopener noreferrer">開啟官方來源 ↗</a>
      </article>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p class="meta">資料載入中或無法讀取 sources.json</p>';
  }
}

loadSources();
