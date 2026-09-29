/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CacheStats, PriceLookupResult, SqliteCacheEntry } from '../types/costguard.ts';

/**
 * Interface for pricing cache
 */
export interface IPricingCache {
  get(sku: string, region: string, currency: string): Promise<PriceLookupResult | null>;
  set(result: PriceLookupResult): Promise<void>;
  getAll(): Promise<SqliteCacheEntry[]>;
  clear(): Promise<void>;
  getStats(): Promise<CacheStats>;
}

/**
 * Client-side in-memory & localStorage pricing cache
 */
class ClientPricingCache implements IPricingCache {
  private storageKey = 'costguard_sqlite_pricing_cache';
  private hits = 0;
  private lookups = 0;

  private loadStore(): Record<string, SqliteCacheEntry> {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // ignore
    }
    return {};
  }

  private saveStore(store: Record<string, SqliteCacheEntry>): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(store));
    } catch {
      // ignore
    }
  }

  private makeKey(sku: string, region: string, currency: string): string {
    return `${sku.toLowerCase()}::${region.toLowerCase()}::${currency.toUpperCase()}`;
  }

  async get(sku: string, region: string, currency: string): Promise<PriceLookupResult | null> {
    this.lookups++;
    const key = this.makeKey(sku, region, currency);
    const store = this.loadStore();
    const entry = store[key];

    if (entry) {
      this.hits++;
      entry.hits = (entry.hits || 0) + 1;
      store[key] = entry;
      this.saveStore(store);

      return {
        sku: entry.sku,
        region: entry.region,
        currency: entry.currency,
        unitPrice: entry.hourly_price,
        monthlyPrice: entry.monthly_price,
        unitOfMeasure: entry.unit,
        meterName: entry.meter_name,
        productName: entry.product_name,
        serviceName: entry.service_name,
        source: 'SQLite Cache',
        fromCache: true,
      };
    }

    return null;
  }

  async set(result: PriceLookupResult): Promise<void> {
    const key = this.makeKey(result.sku, result.region, result.currency);
    const store = this.loadStore();
    store[key] = {
      sku: result.sku,
      region: result.region,
      currency: result.currency,
      service_name: result.serviceName,
      hourly_price: result.unitPrice,
      monthly_price: result.monthlyPrice,
      unit: result.unitOfMeasure,
      meter_name: result.meterName,
      product_name: result.productName,
      source: result.source,
      hits: 0,
      cached_at: new Date().toISOString(),
    };
    this.saveStore(store);
  }

  async getAll(): Promise<SqliteCacheEntry[]> {
    const store = this.loadStore();
    return Object.values(store);
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // ignore
    }
    this.hits = 0;
    this.lookups = 0;
  }

  async getStats(): Promise<CacheStats> {
    const all = await this.getAll();
    const totalHits = all.reduce((sum, item) => sum + (item.hits || 0), 0) + this.hits;
    return {
      totalEntries: all.length,
      totalHits,
      totalLookups: this.lookups,
      hitRatio: this.lookups > 0 ? Number((totalHits / this.lookups).toFixed(2)) : 0,
      engine: 'Client Memory Cache',
    };
  }
}

export const clientPricingCache = new ClientPricingCache();
