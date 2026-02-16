const fileInput = document.getElementById('fileInput');
const tableWrap = document.getElementById('tableWrap');
const stats = document.getElementById('stats');
const sampleBtn = document.getElementById('sampleBtn');

function parseTime(v) {
  if (v === null || v === undefined || v === '') return NaN;
  const s = String(v).trim();
  if (!s) return NaN;

  // If timezone is missing, treat as UTC.
  const hasTz = /[zZ]$/.test(s) || /[+\-]\d{2}:?\d{2}$/.test(s);
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const iso = hasTz ? normalized : `${normalized}Z`;
  return new Date(iso).getTime();
}

function formatDateLabel(v) {
  const ms = parseTime(v);
  if (!Number.isFinite(ms)) return String(v);
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: '2-digit' });
}

function uniqueSortedTimes(rows) {
  return [...new Set(rows.map((r) => r.generated_time))].sort((a, b) => parseTime(a) - parseTime(b));
}

function uniqueTickers(rows) {
  return [...new Set(rows.map((r) => r.ticker))].sort();
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

function formatUserDateTime(ms) {
  return new Date(ms).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function buildTickerHistory(rows) {
  const byTicker = new Map();
  rows.forEach((r) => {
    if (!byTicker.has(r.ticker)) byTicker.set(r.ticker, []);
    byTicker.get(r.ticker).push(r);
  });

  byTicker.forEach((arr) => {
    arr.sort((a, b) => parseTime(a.generated_time) - parseTime(b.generated_time));
  });

  return byTicker;
}

function latestInsightAtOrBefore(history, atMs) {
  let candidate = null;
  for (const row of history) {
    const g = parseTime(row.generated_time);
    if (!Number.isFinite(g) || g > atMs) break;
    candidate = row;
  }
  return candidate;
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
  const tickerHistory = buildTickerHistory(rows);
  const latestBucketTimeMs = Math.max(...times.map(parseTime).filter(Number.isFinite));
  const nowMs = Date.now();

  stats.textContent = `${rows.length} signals • ${tickers.length} tickers • ${times.length} time buckets • color scale: per-column min/max (percent view)`;

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const hrow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'sticky-col';
  corner.textContent = 'Ticker';
  hrow.appendChild(corner);

  times.forEach((t) => {
    const th = document.createElement('th');
    th.textContent = formatDateLabel(t);
    const { min, max } = colScales.get(t);
    th.title = `${t}\nColumn scale\nmin: ${min.toFixed(4)}\nmax: ${max.toFixed(4)}`;
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
    const history = tickerHistory.get(ticker) || [];

    times.forEach((t) => {
      const td = document.createElement('td');
      const row = byKey.get(`${ticker}__${t}`);
      const tMs = parseTime(t);
      const hasWeight = row && Number.isFinite(Number(row.weight));

      if (hasWeight) {
        const w = Number(row.weight);
        const { min, max } = colScales.get(t);
        td.style.background = weightToColor(w, min, max);

        const trend = trendSymbol(prevWeight, w);
        const wp = (w * 100).toFixed(2);
        const minp = (min * 100).toFixed(2);
        const maxp = (max * 100).toFixed(2);
        td.innerHTML = `<div class="cell-wrap"><span>${wp}</span><span class="trend ${trend.cls}">${trend.s}</span></div>`;
        td.title = `${ticker}\n${t}\nweight: ${wp}%\ncolumn min/max: ${minp}% / ${maxp}%\ntrend vs left: ${trend.s}`;
        prevWeight = w;
      } else {
        // Rule:
        // - For the latest week bucket, compare close_time to real current time.
        // - For historical buckets, compare close_time to that bucket's date/time.
        const isLatestBucket = Number.isFinite(tMs) && tMs === latestBucketTimeMs;
        const referenceMs = isLatestBucket ? nowMs : tMs;

        const candidate = latestInsightAtOrBefore(history, Number.isFinite(referenceMs) ? referenceMs : nowMs);
        const closeMs = candidate ? parseTime(candidate.close_time) : NaN;
        const isActive = Number.isFinite(closeMs) && Number.isFinite(referenceMs) && referenceMs < closeMs;

        if (isActive) {
          td.innerHTML = '<span class="active-icon" aria-label="Active insight" role="img">⏰</span>';
          td.title = `Insight active until ${formatUserDateTime(closeMs)} (close_time UTC source)`;
        } else {
          td.textContent = '';
          td.title = '';
        }

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
    { ticker: 'AAPL', generated_time: '2026-01-01 10:00:00', weight: 0.55, close_time: '2026-01-05 00:00:00' },
    { ticker: 'AAPL', generated_time: '2026-01-02 10:00:00', weight: 0.72, close_time: '2026-01-05 00:00:00' },
    { ticker: 'MSFT', generated_time: '2026-01-01 10:00:00', weight: 0.34, close_time: '2026-01-03 12:00:00' },
    { ticker: 'MSFT', generated_time: '2026-01-02 10:00:00', weight: 0.88, close_time: '2026-01-03 12:00:00' }
  ]);
});
