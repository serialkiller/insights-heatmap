# insights-heatmap

Heatmap UI for QuantConnect insights.

## New: Webhook ingestion (no manual upload needed)

This app now supports receiving the latest insights via webhook and auto-loading them in the UI.

### Endpoints

- `POST /api/insights` — ingest latest insights JSON
- `GET /api/insights/latest` — fetch latest stored insights
- `GET /api/health`

### Payload formats accepted

Any of these:

1. Raw array
```json
[
  { "ticker": "AAPL", "generated_time": "2026-02-22 10:00:00", "weight": 0.42, "close_time": "2026-02-24 00:00:00" }
]
```

2. Wrapped as `rows`
```json
{ "rows": [ ... ] }
```

3. Wrapped as `insights`
```json
{ "insights": [ ... ] }
```

### Security

Set `WEBHOOK_TOKEN` and send it in header `x-webhook-token`.

If `WEBHOOK_TOKEN` is not set, webhook is open (not recommended for production).

### Storage backend

- **Production (recommended):** Upstash Redis via Vercel env vars:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- **Local fallback:** if Upstash vars are missing, app stores to `data/latest.json`.

## Run

```bash
npm install
WEBHOOK_TOKEN=change-me npm start
```

Server defaults:
- Port: `3040` (override with `PORT`)
- Redis key: `insights:latest` (override with `INSIGHTS_LATEST_KEY`)
- Local fallback file: `./data/latest.json` (override with `DATA_DIR`)

## Test webhook

```bash
curl -X POST http://localhost:3040/api/insights \
  -H 'content-type: application/json' \
  -H 'x-webhook-token: change-me' \
  -d '[{"ticker":"AAPL","generated_time":"2026-02-22 10:00:00","weight":0.42,"close_time":"2026-02-24 00:00:00"}]'
```

Then open `http://localhost:3040` and it will auto-load latest webhook data.

## QuantConnect integration (concept)

From your algorithm runtime/process, POST newly generated insights JSON to:

`https://<your-host>/api/insights`

with header:

`x-webhook-token: <your-secret>`

and body containing your latest insights array.
