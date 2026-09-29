/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { analyzeTerraformCost } from './src/lib/costAnalyzer.ts';
import { fetchLiveAzurePrice, getFallbackPrice } from './src/lib/azurePricing.ts';
import { nodeSqlitePricingCache } from './src/lib/sqliteNodeCache.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '10mb' }));

const serverCache = nodeSqlitePricingCache;

// ----------------- API ROUTES ----------------- //

// POST /api/analyze - Main CostGuard analysis endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { planJson, budgetThreshold, currency, isDemo } = req.body;
    if (!planJson) {
      return res.status(400).json({ error: 'Missing planJson payload' });
    }

    const summary = await analyzeTerraformCost({
      planJson,
      budgetThreshold: Number(budgetThreshold) || 50.0,
      currency: currency || 'USD',
      cache: serverCache,
      isDemo: Boolean(isDemo),
    });

    res.json(summary);
  } catch (error: any) {
    console.error('Error analyzing plan:', error);
    res.status(500).json({ error: error.message || 'Analysis error' });
  }
});

// GET /api/cache - View cached entries
app.get('/api/cache', async (_req, res) => {
  try {
    const entries = await serverCache.getAll();
    const stats = await serverCache.getStats();
    res.json({ entries, stats, engine: 'node:sqlite DatabaseSync' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/cache/clear - Clear SQLite cache
app.post('/api/cache/clear', async (_req, res) => {
  try {
    await serverCache.clear();
    res.json({ success: true, message: 'SQLite pricing cache cleared' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/price-lookup - Direct live price test
app.get('/api/price-lookup', async (req, res) => {
  try {
    const sku = String(req.query.sku || 'Standard_B1s');
    const region = String(req.query.region || 'eastus');
    const currency = String(req.query.currency || 'USD');

    // Check cache first
    const cached = await serverCache.get(sku, region, currency);
    if (cached) {
      return res.json({ result: cached, fromCache: true });
    }

    const live = await fetchLiveAzurePrice({ sku, region, currency });
    if (live) {
      await serverCache.set(live);
      return res.json({ result: live, fromCache: false });
    }

    const fallback = getFallbackPrice(sku, region, currency);
    res.json({ result: fallback, fromCache: false, isFallback: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start Express server and mount Vite
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CostGuard server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
