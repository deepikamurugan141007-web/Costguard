/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AnalyzedResourceCost,
  CostAnalysisSummary,
  PriceLookupResult,
  TerraformPlanJson,
} from '../types/costguard.ts';
import { CURRENCY_SYMBOLS, fetchLiveAzurePrice, getFallbackPrice } from './azurePricing.ts';
import { IPricingCache, clientPricingCache } from './sqliteCache.ts';
import { parseTerraformPlan } from './terraformParser.ts';

export interface AnalyzeOptions {
  planJson: TerraformPlanJson | string;
  budgetThreshold?: number;
  currency?: string;
  cache?: IPricingCache;
  onProgress?: (message: string, current: number, total: number) => void;
  isDemo?: boolean;
}

/**
 * Format currency with 2 decimal places
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbol = CURRENCY_SYMBOLS[currency] || '$';
  const isNegative = amount < 0;
  const abs = Math.abs(amount).toFixed(2);
  return `${isNegative ? '-' : ''}${symbol}${abs}`;
}

/**
 * Core CostGuard analyzer pipeline
 */
export async function analyzeTerraformCost(options: AnalyzeOptions): Promise<CostAnalysisSummary> {
  const budgetThreshold = options.budgetThreshold ?? 50.0;
  const currency = options.currency || 'USD';
  const cache = options.cache || clientPricingCache;
  const currencySymbol = CURRENCY_SYMBOLS[currency] || '$';

  let planObj: TerraformPlanJson;
  if (typeof options.planJson === 'string') {
    try {
      planObj = JSON.parse(options.planJson);
    } catch (e) {
      throw new Error(`Invalid JSON format: ${(e as Error).message}`);
    }
  } else {
    planObj = options.planJson;
  }

  const extractedResources = parseTerraformPlan(planObj);
  const billableList = extractedResources.filter((r) => r.isBillable);
  const skippedList = extractedResources.filter((r) => !r.isBillable);

  let cacheHits = 0;
  let apiLookups = 0;

  const analyzedResources: AnalyzedResourceCost[] = [];
  const analyzedSkipped: AnalyzedResourceCost[] = [];

  // Helper to fetch price with cache-first strategy
  async function resolvePrice(
    sku: string | undefined,
    region: string,
    category: 'compute' | 'storage' | 'network' | 'database' | 'other',
    type: string
  ): Promise<PriceLookupResult | null> {
    if (!sku) return null;

    // 1. Check SQLite Cache
    const cached = await cache.get(sku, region, currency);
    if (cached) {
      cacheHits++;
      return cached;
    }

    // 2. Cache miss -> Query Azure Retail Prices API
    apiLookups++;
    const isLinux = !type.includes('windows');
    const livePrice = await fetchLiveAzurePrice({
      sku,
      region,
      currency,
      serviceCategory: category,
      resourceType: type,
      isLinux,
    });

    if (livePrice) {
      // Save result to cache
      await cache.set(livePrice);
      return livePrice;
    }

    // Fallback baseline
    const fallback = getFallbackPrice(sku, region, currency);
    if (fallback) {
      await cache.set(fallback);
      return fallback;
    }

    return null;
  }

  // Process billable resources
  for (let i = 0; i < billableList.length; i++) {
    const res = billableList[i];
    options.onProgress?.(`Pricing ${res.name} (${res.type})...`, i + 1, billableList.length);

    let oldHourly = 0;
    let oldMonthly = 0;
    let newHourly = 0;
    let newMonthly = 0;
    let oldSku = res.beforeSku;
    let newSku = res.afterSku;
    let pricingSource = 'Azure Retail Prices API';
    let fromCache = false;
    let details = '';

    if (res.isMetadataOnlyChange) {
      // Rule 13: Metadata-only updates have $0 cost delta
      const sku = newSku || oldSku || 'Standard_B1s';
      const price = await resolvePrice(sku, res.region, res.serviceCategory, res.type);
      if (price) {
        oldHourly = price.unitPrice;
        oldMonthly = price.monthlyPrice;
        newHourly = price.unitPrice;
        newMonthly = price.monthlyPrice;
        pricingSource = price.source;
        fromCache = price.fromCache;
      }
      details = 'Metadata-only change (tags/rules); $0 cost delta';
    } else {
      // Resolve Old Cost (for UPDATE, DELETE, REPLACE)
      if (res.action === 'delete' || res.action === 'update' || res.action === 'replace') {
        const skuToFetch = oldSku || newSku;
        const oldPrice = await resolvePrice(skuToFetch, res.region, res.serviceCategory, res.type);
        if (oldPrice) {
          oldHourly = oldPrice.unitPrice;
          oldMonthly = oldPrice.monthlyPrice;
          pricingSource = oldPrice.source;
          fromCache = oldPrice.fromCache;
        } else {
          details += `Warning: SKU '${skuToFetch}' pricing lookup not found; `;
        }
      }

      // Resolve New Cost (for CREATE, UPDATE, REPLACE)
      if (res.action === 'create' || res.action === 'update' || res.action === 'replace') {
        const skuToFetch = newSku || oldSku;
        const newPrice = await resolvePrice(skuToFetch, res.region, res.serviceCategory, res.type);
        if (newPrice) {
          newHourly = newPrice.unitPrice;
          newMonthly = newPrice.monthlyPrice;
          pricingSource = newPrice.source;
          if (newPrice.fromCache) fromCache = true;
        } else {
          details += `Warning: SKU '${skuToFetch}' pricing lookup not found; `;
        }
      }
    }

    // Calculate Delta strictly per rules
    let monthlyDelta = 0;
    if (res.action === 'create') {
      oldMonthly = 0;
      oldHourly = 0;
      monthlyDelta = newMonthly;
    } else if (res.action === 'delete') {
      newMonthly = 0;
      newHourly = 0;
      monthlyDelta = -oldMonthly;
    } else if (res.action === 'update' || res.action === 'replace') {
      if (res.isMetadataOnlyChange) {
        monthlyDelta = 0;
      } else {
        monthlyDelta = Number((newMonthly - oldMonthly).toFixed(2));
      }
    }

    // Display SKU representation
    let displaySku = newSku || oldSku || 'Default';
    if (res.action === 'update' && oldSku && newSku && oldSku !== newSku) {
      displaySku = `${oldSku} → ${newSku}`;
    }

    analyzedResources.push({
      address: res.address,
      type: res.type,
      name: res.name,
      action: res.action,
      region: res.region,
      displaySku,
      oldSku,
      newSku,
      oldHourlyCost: oldHourly,
      newHourlyCost: newHourly,
      oldMonthlyCost: oldMonthly,
      newMonthlyCost: newMonthly,
      monthlyDelta: Number(monthlyDelta.toFixed(2)),
      isBillable: true,
      pricingSource,
      fromCache,
      details: details.trim() || 'Calculated using 730 hours/month',
    });
  }

  // Process skipped non-billable resources
  for (const s of skippedList) {
    analyzedSkipped.push({
      address: s.address,
      type: s.type,
      name: s.name,
      action: s.action,
      region: s.region,
      displaySku: 'N/A (Free)',
      oldHourlyCost: 0,
      newHourlyCost: 0,
      oldMonthlyCost: 0,
      newMonthlyCost: 0,
      monthlyDelta: 0,
      isBillable: false,
      skipReason: s.skipReason || 'Non-billable resource skipped',
      pricingSource: 'Azure Non-Billable Catalog',
      fromCache: false,
      details: 'Free infrastructure resource (control plane / virtual network / grouping)',
    });
  }

  // Calculate totals
  const priorMonthlyCost = Number(
    analyzedResources.reduce((acc, curr) => acc + (curr.oldMonthlyCost || 0), 0).toFixed(2)
  );
  const projectedMonthlyCost = Number(
    analyzedResources.reduce((acc, curr) => acc + (curr.newMonthlyCost || 0), 0).toFixed(2)
  );

  // Net Monthly Impact = Total Proposed Cost - Total Prior Cost
  const netMonthlyImpact = Number((projectedMonthlyCost - priorMonthlyCost).toFixed(2));

  // Budget Guardrail Check
  const passed = netMonthlyImpact <= budgetThreshold;
  const verdict = passed ? 'PASSED' : 'FAILED';
  const verdictTitle = passed ? 'PASSED' : 'FAILED';
  const verdictSubtitle = passed
    ? netMonthlyImpact < 0
      ? `${formatCurrency(Math.abs(netMonthlyImpact), currency)} monthly savings. Deployment approved — cost increase is within budget.`
      : 'Deployment approved — cost increase is within budget.'
    : 'Deployment blocked — monthly cost increase exceeds the allowed budget.';
  const deploymentBlocked = !passed;
  const exitCode: 0 | 1 = passed ? 0 : 1;

  return {
    priorMonthlyCost,
    projectedMonthlyCost,
    netMonthlyImpact,
    budgetThreshold,
    currency,
    currencySymbol,
    verdict,
    verdictTitle,
    verdictSubtitle,
    deploymentBlocked,
    exitCode,
    cacheHits,
    apiLookups,
    totalResourcesAnalyzed: extractedResources.length,
    billableResourcesCount: billableList.length,
    skippedResourcesCount: skippedList.length,
    analyzedAt: new Date().toISOString(),
    resources: analyzedResources,
    skippedResources: analyzedSkipped,
    isDemoData: Boolean(options.isDemo),
  };
}
