import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3040;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const LATEST_FILE = path.join(DATA_DIR, 'latest.json');
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || '';

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.insights)) return payload.insights;
  if (payload && Array.isArray(payload.rows)) return payload.rows;
  return null;
}

function looksLikeInsightRow(row) {
  return row && typeof row === 'object' && 'ticker' in row && 'generated_time' in row;
}

async function readLatestInsights() {
  const raw = await fs.readFile(LATEST_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return normalizeRows(parsed) || [];
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'insights-heatmap' });
});

app.get('/api/insights/latest', async (_req, res) => {
  try {
    const rows = await readLatestInsights();
    res.json({ ok: true, rows, count: rows.length });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ ok: false, error: 'No insights uploaded yet' });
    }
    return res.status(500).json({ ok: false, error: 'Failed to read latest insights' });
  }
});

app.post('/api/insights', async (req, res) => {
  try {
    if (WEBHOOK_TOKEN) {
      const provided = req.get('x-webhook-token') || '';
      if (provided !== WEBHOOK_TOKEN) {
        return res.status(401).json({ ok: false, error: 'Invalid webhook token' });
      }
    }

    const rows = normalizeRows(req.body);
    if (!rows || !rows.length) {
      return res.status(400).json({ ok: false, error: 'Payload must include a non-empty insights array' });
    }

    if (!rows.every(looksLikeInsightRow)) {
      return res.status(400).json({ ok: false, error: 'Each row must include ticker and generated_time' });
    }

    await fs.mkdir(DATA_DIR, { recursive: true });
    const payload = {
      receivedAt: new Date().toISOString(),
      count: rows.length,
      rows
    };
    await fs.writeFile(LATEST_FILE, JSON.stringify(payload, null, 2), 'utf8');

    return res.json({ ok: true, count: rows.length, receivedAt: payload.receivedAt });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to store insights' });
  }
});

app.listen(PORT, () => {
  console.log(`insights-heatmap running on http://localhost:${PORT}`);
  console.log(`latest insights endpoint: http://localhost:${PORT}/api/insights/latest`);
});
