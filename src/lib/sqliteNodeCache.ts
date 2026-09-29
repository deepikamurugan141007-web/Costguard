/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { PriceLookupResult, SqliteCacheEntry, CacheStats } from '../types/costguard.ts';
import { IPricingCache } from './sqliteCache.ts';

const dbPath = path.resolve(process.cwd(), 'costguard_cache.sqlite');
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS pricing_cache (
    sku TEXT NOT NULL,
    region TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    hourly_rate REAL NOT NULL,
    cached_at INTEGER NOT NULL,
    service_name TEXT,
    monthly_price REAL,
    unit TEXT,
    meter_name TEXT,
    product_name TEXT,
    source TEXT,
    hits INTEGER DEFAULT 0,
    PRIMARY KEY (sku, region, currency)
  );
`);

export class NodeSqlitePricingCache implements IPricingCache {
  private stmtGet = db.prepare(
    'SELECT * FROM pricing_cache WHERE sku = ? COLLATE NOCASE AND region = ? COLLATE NOCASE AND currency = ? COLLATE NOCASE'
  );
  private stmtIncrementHit = db.prepare(
    'UPDATE pricing_cache SET hits = hits + 1 WHERE sku = ? COLLATE NOCASE AND region = ? COLLATE NOCASE AND currency = ? COLLATE NOCASE'
  );
  private stmtInsert = db.prepare(`
    INSERT INTO pricing_cache (
      sku, region, currency, hourly_rate, cached_at, service_name, monthly_price, unit, meter_name, product_name, source, hits
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(sku, region, currency) DO UPDATE SET
      hourly_rate = excluded.hourly_rate,
      monthly_price = excluded.monthly_price,
      cached_at = excluded.cached_at;
  `);

  async get(sku: string, region: string, currency: string): Promise<PriceLookupResult | null> {
    const row = this.stmtGet.get(sku, region, currency) as Record<string, unknown> | undefined;
    if (row) {
      this.stmtIncrementHit.run(sku, region, currency);
      return {
        sku: String(row.sku),
        region: String(row.region),
        currency: String(row.currency),
        unitPrice: Number(row.hourly_rate),
        monthlyPrice: Number(row.monthly_price || (Number(row.hourly_rate) * 730)),
        unitOfMeasure: String(row.unit || '1 Hour'),
        meterName: String(row.meter_name || ''),
        productName: String(row.product_name || ''),
        serviceName: String(row.service_name || 'Azure'),
        source: 'SQLite Cache',
        fromCache: true,
      };
    }
    return null;
  }

  async set(res: PriceLookupResult): Promise<void> {
    this.stmtInsert.run(
      res.sku,
      res.region,
      res.currency,
      res.unitPrice,
      Date.now(),
      res.serviceName || 'Azure',
      res.monthlyPrice,
      res.unitOfMeasure,
      res.meterName,
      res.productName,
      res.source
    );
  }

  async getAll(): Promise<SqliteCacheEntry[]> {
    const rows = db.prepare('SELECT * FROM pricing_cache ORDER BY cached_at DESC').all();
    return rows.map((r: any) => ({
      sku: r.sku,
      region: r.region,
      currency: r.currency,
      service_name: r.service_name || 'Azure',
      hourly_price: r.hourly_rate,
      monthly_price: r.monthly_price || (r.hourly_rate * 730),
      unit: r.unit || '1 Hour',
      meter_name: r.meter_name || '',
      product_name: r.product_name || '',
      source: r.source || 'Azure Retail Prices API',
      hits: r.hits || 0,
      cached_at: new Date(r.cached_at).toISOString(),
    }));
  }

  async clear(): Promise<void> {
    db.exec('DELETE FROM pricing_cache;');
  }

  async getStats(): Promise<CacheStats> {
    const rows = await this.getAll();
    const totalHits = rows.reduce((acc, row) => acc + (row.hits || 0), 0);
    return {
      totalEntries: rows.length,
      totalHits,
      totalLookups: totalHits,
      hitRatio: rows.length > 0 ? Number((totalHits / Math.max(1, totalHits + rows.length)).toFixed(2)) : 0,
      engine: 'SQLite (node:sqlite)',
    };
  }
}

export const nodeSqlitePricingCache = new NodeSqlitePricingCache();
