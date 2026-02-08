import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3040;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'insights-heatmap' }));

app.listen(PORT, () => {
  console.log(`insights-heatmap running on http://localhost:${PORT}`);
});
