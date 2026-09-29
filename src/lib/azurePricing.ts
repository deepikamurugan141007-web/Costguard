/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PriceLookupResult } from '../types/costguard.ts';
import { normalizeRegion } from './terraformParser.ts';

export interface AzureApiItem {
  currencyCode: string;
  tierMinimumUnits: number;
  retailPrice: number;
  unitPrice: number;
  armRegionName: string;
  location: string;
  meterId: string;
  meterName: string;
  productId: string;
  skuId: string;
  productName: string;
  skuName: string;
  serviceName: string;
  serviceId: string;
  serviceFamily: string;
  unitOfMeasure: string;
  type: string;
  isPrimaryMeterRegion: boolean;
  armSkuName: string;
}

export interface AzurePricingResponse {
  BillingCurrency: string;
  CustomerEntityId?: string;
  CustomerEntityType?: string;
  Items: AzureApiItem[];
  NextPageLink?: string;
  Count: number;
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'A$',
  INR: '₹',
};

/**
 * Standard baseline prices for well-known Azure SKUs as reference fallback
 * if network is unavailable or rate-limited.
 */
const BASELINE_PRICES_USD: Record<string, { hourly: number; monthly: number; unit: string; service: string }> = {
  // VMs
  'Standard_B1s': { hourly: 0.0104, monthly: 7.59, unit: '1 Hour', service: 'Virtual Machines' },
  'Standard_B2s': { hourly: 0.0416, monthly: 30.37, unit: '1 Hour', service: 'Virtual Machines' },
  'Standard_B4ms': { hourly: 0.166, monthly: 121.18, unit: '1 Hour', service: 'Virtual Machines' },
  'Standard_D2s_v3': { hourly: 0.096, monthly: 70.08, unit: '1 Hour', service: 'Virtual Machines' },
  'Standard_D2s_v5': { hourly: 0.096, monthly: 70.08, unit: '1 Hour', service: 'Virtual Machines' },
  'Standard_D4s_v5': { hourly: 0.192, monthly: 140.16, unit: '1 Hour', service: 'Virtual Machines' },
  'Standard_D8s_v5': { hourly: 0.384, monthly: 280.32, unit: '1 Hour', service: 'Virtual Machines' },
  'Standard_F2s_v2': { hourly: 0.085, monthly: 62.05, unit: '1 Hour', service: 'Virtual Machines' },

  // Disks (Monthly)
  'P4': { hourly: 0.0066, monthly: 4.81, unit: '1/Month', service: 'Storage' },
  'P6': { hourly: 0.0125, monthly: 9.13, unit: '1/Month', service: 'Storage' },
  'P10': { hourly: 0.027, monthly: 19.71, unit: '1/Month', service: 'Storage' },
  'P15': { hourly: 0.052, monthly: 37.96, unit: '1/Month', service: 'Storage' },
  'P20': { hourly: 0.099, monthly: 72.27, unit: '1/Month', service: 'Storage' },
  'P30': { hourly: 0.185, monthly: 135.05, unit: '1/Month', service: 'Storage' },

  // App Service / Web
  'B1': { hourly: 0.018, monthly: 13.14, unit: '1 Hour', service: 'Azure App Service' },
  'B2': { hourly: 0.075, monthly: 54.75, unit: '1 Hour', service: 'Azure App Service' },
  'P1v2': { hourly: 0.10, monthly: 73.00, unit: '1 Hour', service: 'Azure App Service' },
  'S1': { hourly: 0.095, monthly: 69.35, unit: '1 Hour', service: 'Azure App Service' },
};

/**
 * Build OData filter for Azure Retail Prices API
 */
export function buildODataFilter(options: {
  sku: string;
  region: string;
  serviceCategory: 'compute' | 'storage' | 'network' | 'database' | 'other';
  resourceType?: string;
  isLinux?: boolean;
}): string {
  const normRegion = normalizeRegion(options.region);
  const sku = options.sku;

  // Managed Disks
  if (options.serviceCategory === 'storage' || sku.startsWith('P')) {
    return `serviceName eq 'Storage' and armRegionName eq '${normRegion}' and priceType eq 'Consumption' and contains(meterName, '${sku} LRS Disk')`;
  }

  // Virtual Machines
  if (options.serviceCategory === 'compute' || options.resourceType?.includes('virtual_machine')) {
    return `serviceName eq 'Virtual Machines' and armRegionName eq '${normRegion}' and armSkuName eq '${sku}' and priceType eq 'Consumption'`;
  }

  // Default fallback
  return `armRegionName eq '${normRegion}' and armSkuName eq '${sku}' and priceType eq 'Consumption'`;
}

/**
 * Filter out Spot and Low Priority items, and handle Linux vs Windows matching
 */
export function selectBestPriceItem(
  items: AzureApiItem[],
  options: {
    sku: string;
    isLinux?: boolean;
    serviceCategory?: string;
  }
): AzureApiItem | null {
  if (!items || items.length === 0) return null;

  // Filter out Spot and Low Priority unless requested
  let candidates = items.filter((item) => {
    const meter = (item.meterName || '').toLowerCase();
    const product = (item.productName || '').toLowerCase();
    const sku = (item.skuName || '').toLowerCase();

    if (meter.includes('spot') || product.includes('spot') || sku.includes('spot')) {
      return false;
    }
    if (meter.includes('low priority') || product.includes('low priority') || sku.includes('low priority')) {
      return false;
    }
    if (meter.includes('reservation') || product.includes('reservation')) {
      return false;
    }
    return true;
  });

  if (candidates.length === 0) {
    candidates = items;
  }

  // For Linux VMs: prefer items without "Windows" in product name
  if (options.isLinux !== false) {
    const nonWindows = candidates.filter(
      (c) => !c.productName?.toLowerCase().includes('windows') && !c.meterName?.toLowerCase().includes('windows')
    );
    if (nonWindows.length > 0) {
      candidates = nonWindows;
    }
  }

  // Prefer primary meter region or exact armSkuName match
  const exactSku = candidates.filter((c) => c.armSkuName === options.sku);
  if (exactSku.length > 0) {
    candidates = exactSku;
  }

  // For Managed Disks: ignore mount fees, prefer standard LRS disk
  if (options.serviceCategory === 'storage' || options.sku.startsWith('P')) {
    const diskItems = candidates.filter(
      (c) =>
        !c.meterName?.toLowerCase().includes('mount') &&
        (c.meterName?.toLowerCase().includes('lrs disk') || c.meterName?.toLowerCase().includes('disk'))
    );
    if (diskItems.length > 0) {
      candidates = diskItems;
    }
  }

  // Pick candidate with minimum positive retailPrice
  candidates.sort((a, b) => a.retailPrice - b.retailPrice);
  return candidates[0] || null;
}

/**
 * Fetch price directly from Azure Retail Prices API
 */
export async function fetchLiveAzurePrice(options: {
  sku: string;
  region: string;
  currency?: string;
  serviceCategory?: 'compute' | 'storage' | 'network' | 'database' | 'other';
  resourceType?: string;
  isLinux?: boolean;
}): Promise<PriceLookupResult | null> {
  const currency = options.currency || 'USD';
  const filter = buildODataFilter({
    sku: options.sku,
    region: options.region,
    serviceCategory: options.serviceCategory || 'compute',
    resourceType: options.resourceType,
    isLinux: options.isLinux,
  });

  const url = `https://prices.azure.com/api/retail/prices?currencyCode=${encodeURIComponent(
    currency
  )}&$filter=${encodeURIComponent(filter)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`Azure Retail Prices API responded with status ${res.status}`);
      return getFallbackPrice(options.sku, options.region, currency);
    }

    const data: AzurePricingResponse = await res.json();
    const bestItem = selectBestPriceItem(data.Items, {
      sku: options.sku,
      isLinux: options.isLinux ?? true,
      serviceCategory: options.serviceCategory,
    });

    if (bestItem) {
      let hourlyPrice = bestItem.retailPrice;
      let monthlyPrice = 0;

      if (bestItem.unitOfMeasure?.toLowerCase().includes('month')) {
        // Direct monthly price (e.g. Managed Disks)
        monthlyPrice = Number(bestItem.retailPrice.toFixed(2));
        hourlyPrice = Number((monthlyPrice / 730).toFixed(4));
      } else {
        // Hourly rate * 730
        hourlyPrice = bestItem.retailPrice;
        monthlyPrice = Number((hourlyPrice * 730).toFixed(2));
      }

      return {
        sku: options.sku,
        region: options.region,
        currency,
        unitPrice: hourlyPrice,
        monthlyPrice,
        unitOfMeasure: bestItem.unitOfMeasure || '1 Hour',
        meterName: bestItem.meterName,
        productName: bestItem.productName,
        serviceName: bestItem.serviceName,
        source: 'Azure Retail Prices API',
        fromCache: false,
        rawApiItem: bestItem,
      };
    }

    // Try secondary broad query if SKU was not found with specific filter
    return await fetchBroadAzurePrice(options.sku, options.region, currency);
  } catch (err) {
    console.warn(`Live Azure API error for ${options.sku} in ${options.region}:`, err);
    return getFallbackPrice(options.sku, options.region, currency);
  }
}

/**
 * Broad fallback query if specific OData filter produced 0 results
 */
async function fetchBroadAzurePrice(
  sku: string,
  region: string,
  currency: string
): Promise<PriceLookupResult | null> {
  const normRegion = normalizeRegion(region);
  const broadFilter = `armRegionName eq '${normRegion}' and contains(armSkuName, '${sku}') and priceType eq 'Consumption'`;
  const url = `https://prices.azure.com/api/retail/prices?currencyCode=${encodeURIComponent(
    currency
  )}&$filter=${encodeURIComponent(broadFilter)}`;

  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return getFallbackPrice(sku, region, currency);

    const data: AzurePricingResponse = await res.json();
    const item = selectBestPriceItem(data.Items, { sku, isLinux: true });
    if (item) {
      const isMonthly = item.unitOfMeasure?.toLowerCase().includes('month');
      const monthly = isMonthly ? Number(item.retailPrice.toFixed(2)) : Number((item.retailPrice * 730).toFixed(2));
      const hourly = isMonthly ? Number((monthly / 730).toFixed(4)) : item.retailPrice;

      return {
        sku,
        region,
        currency,
        unitPrice: hourly,
        monthlyPrice: monthly,
        unitOfMeasure: item.unitOfMeasure || '1 Hour',
        meterName: item.meterName,
        productName: item.productName,
        serviceName: item.serviceName,
        source: 'Azure Retail Prices API',
        fromCache: false,
        rawApiItem: item,
      };
    }
  } catch {
    // ignore
  }

  return getFallbackPrice(sku, region, currency);
}

/**
 * Accurate baseline price lookup if live API is temporarily unreachable
 */
export function getFallbackPrice(sku: string, region: string, currency: string = 'USD'): PriceLookupResult | null {
  const base = BASELINE_PRICES_USD[sku];
  if (!base) return null;

  // Multiplier for rough currency conversion if not USD
  const currencyRate: Record<string, number> = {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.78,
    CAD: 1.36,
    AUD: 1.52,
    INR: 83.5,
  };
  const rate = currencyRate[currency] || 1.0;

  const hourly = Number((base.hourly * rate).toFixed(4));
  const monthly = Number((base.monthly * rate).toFixed(2));

  return {
    sku,
    region,
    currency,
    unitPrice: hourly,
    monthlyPrice: monthly,
    unitOfMeasure: base.unit,
    meterName: `${sku} Baseline`,
    productName: `${base.service} (${sku})`,
    serviceName: base.service,
    source: 'Azure Retail Prices API',
    fromCache: false,
  };
}
