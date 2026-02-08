const fileInput = document.getElementById('fileInput');
const tableWrap = document.getElementById('tableWrap');
const stats = document.getElementById('stats');
const sampleBtn = document.getElementById('sampleBtn');

function parseTime(v) {
  return new Date(String(v).replace(' ', 'T') + 'Z').getTime();
}

function uniqueSortedTimes(rows) {
  return [...new Set(rows.map(r => r.generated_time))].sort((a, b) => parseTime(a) - parseTime(b));
}

function uniqueTickers(rows) {
  return [...new Set(rows.map(r => r.ticker))].sort();
}

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function weightToColor(weight, min, max) {
  const t = max === min ? 0.5 : clamp01((weight - min) / (max - min));
  const r = Math.round(185 * (1 - t) + 22 * t);
  const g = Math.round(28 * (1 - t) + 101 * t);
  const b = Math.round(28 * (1 - t) + 52 * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function columnMinMax(rows, times) {
  const out = new Map();
  times.forEach((t) => {
    const vals = rows
      .filter((r) => r.generated_time === t)
      .map((r) => Number(r.weight))
      .filter(Number.isFinite);
    out.set(t, {
      min: vals.length ? Math.min(...vals) : 0,
      max: vals.length ? Math.max(...vals) : 1
    });
  });
  return out;
}

function trendSymbol(prev, curr) {
  if (!Number.isFinite(prev) || !Number.isFinite(curr)) return { s: '•', cls: 'flat' };
  if (curr > prev) return { s: '▲', cls: 'up' };
  if (curr < prev) return { s: '▼', cls: 'down' };
  return { s: '•', cls: 'flat' };
}

function render(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    tableWrap.innerHTML = '<p class="muted" style="padding:12px">No rows found.</p>';
    stats.textContent = '';
    return;
  }

  const times = uniqueSortedTimes(rows);
  const tickers = uniqueTickers(rows);
  const byKey = new Map(rows.map((r) => [`${r.ticker}__${r.generated_time}`, r]));
  const colScales = columnMinMax(rows, times);

  stats.textContent = `${rows.length} signals • ${tickers.length} tickers • ${times.length} time buckets • color scale: per-column min/max`;

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const hrow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'sticky-col';
  corner.textContent = 'Ticker';
  hrow.appendChild(corner);

  times.forEach((t) => {
    const th = document.createElement('th');
    th.textContent = t;
    const { min, max } = colScales.get(t);
    th.title = `Column scale\nmin: ${min.toFixed(4)}\nmax: ${max.toFixed(4)}`;
    hrow.appendChild(th);
  });
  thead.appendChild(hrow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  tickers.forEach((ticker) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.className = 'sticky-col';
    th.textContent = ticker;
    tr.appendChild(th);

    let prevWeight = NaN;

    times.forEach((t) => {
      const td = document.createElement('td');
      const row = byKey.get(`${ticker}__${t}`);
      if (row && Number.isFinite(Number(row.weight))) {
        const w = Number(row.weight);
        const { min, max } = colScales.get(t);
        td.style.background = weightToColor(w, min, max);

        const trend = trendSymbol(prevWeight, w);
        td.innerHTML = `<div class="cell-wrap"><span>${w.toFixed(4)}</span><span class="trend ${trend.cls}">${trend.s}</span></div>`;
        td.title = `${ticker}\n${t}\nweight: ${w}\ncolumn min/max: ${min.toFixed(4)} / ${max.toFixed(4)}\ntrend vs left: ${trend.s}`;
        prevWeight = w;
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
