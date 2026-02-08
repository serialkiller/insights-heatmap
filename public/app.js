const fileInput = document.getElementById('fileInput');
const tableWrap = document.getElementById('tableWrap');
const stats = document.getElementById('stats');
const sampleBtn = document.getElementById('sampleBtn');

function parseTime(v) {
  return new Date(String(v).replace(' ', 'T') + 'Z').getTime();
}

function uniqueSortedTimes(rows) {
  return [...new Set(rows.map(r => r.generated_time))].sort((a,b) => parseTime(a) - parseTime(b));
}

function uniqueTickers(rows) {
  return [...new Set(rows.map(r => r.ticker))].sort();
}

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function weightToColor(weight, min, max) {
  const t = max === min ? 0.5 : clamp01((weight - min) / (max - min));
  const r = Math.round(185 * (1 - t) + 22 * t); // red -> green
  const g = Math.round(28 * (1 - t) + 101 * t);
  const b = Math.round(28 * (1 - t) + 52 * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function render(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    tableWrap.innerHTML = '<p class="muted" style="padding:12px">No rows found.</p>';
    stats.textContent = '';
    return;
  }

  const times = uniqueSortedTimes(rows);
  const tickers = uniqueTickers(rows);
  const byKey = new Map(rows.map(r => [`${r.ticker}__${r.generated_time}`, r]));
  const weights = rows.map(r => Number(r.weight)).filter(Number.isFinite);
  const min = Math.min(...weights);
  const max = Math.max(...weights);

  stats.textContent = `${rows.length} signals • ${tickers.length} tickers • ${times.length} time buckets • weight min ${min.toFixed(4)} max ${max.toFixed(4)}`;

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const hrow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'sticky-col';
  corner.textContent = 'Ticker';
  hrow.appendChild(corner);

  times.forEach(t => {
    const th = document.createElement('th');
    th.textContent = t;
    hrow.appendChild(th);
  });
  thead.appendChild(hrow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  tickers.forEach(ticker => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.className = 'sticky-col';
    th.textContent = ticker;
    tr.appendChild(th);

    times.forEach(t => {
      const td = document.createElement('td');
      const row = byKey.get(`${ticker}__${t}`);
      if (row && Number.isFinite(Number(row.weight))) {
        const w = Number(row.weight);
        td.textContent = w.toFixed(4);
        td.style.background = weightToColor(w, min, max);
        td.title = `${ticker}\n${t}\nweight: ${w}`;
      } else {
        td.textContent = '—';
        td.style.color = '#93a3b8';
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableWrap.innerHTML = '';
  tableWrap.appendChild(table);
}

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    render(json);
  } catch (err) {
    tableWrap.innerHTML = `<p class="muted" style="padding:12px">Failed to parse JSON: ${err.message}</p>`;
  }
});

sampleBtn.addEventListener('click', () => {
  render([
    { ticker: 'AAPL', generated_time: '2026-01-01 10:00:00', weight: 0.55 },
    { ticker: 'AAPL', generated_time: '2026-01-02 10:00:00', weight: 0.72 },
    { ticker: 'MSFT', generated_time: '2026-01-01 10:00:00', weight: 0.34 },
    { ticker: 'MSFT', generated_time: '2026-01-02 10:00:00', weight: 0.88 }
  ]);
});
