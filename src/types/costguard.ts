/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TerraformAction = 'create' | 'delete' | 'update' | 'replace' | 'no-op';

export interface TerraformResourceChange {
  address: string;
  module_address?: string;
  mode: string;
  type: string;
  name: string;
  provider_name: string;
  change: {
    actions: string[];
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    after_unknown?: Record<string, unknown> | null;
    before_sensitive?: Record<string, unknown> | boolean;
    after_sensitive?: Record<string, unknown> | boolean;
  };
}

export interface TerraformPlanJson {
  format_version?: string;
  terraform_version?: string;
  resource_changes?: TerraformResourceChange[];
  planned_values?: {
    root_module?: {
      resources?: Array<{
        address: string;
        mode: string;
        type: string;
        name: string;
        provider_name: string;
        values?: Record<string, unknown>;
      }>;
    };
  };
  prior_state?: unknown;
  configuration?: unknown;
}

export interface ExtractedResource {
  address: string;
  type: string;
  name: string;
  action: TerraformAction;
  rawActions: string[];
  region: string;
  isBillable: boolean;
  skipReason?: string;
  isMetadataOnlyChange?: boolean;
  beforeSku?: string;
  afterSku?: string;
  beforeTier?: string;
  afterTier?: string;
  serviceCategory: 'compute' | 'storage' | 'network' | 'database' | 'other';
  rawDetails: {
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  };
}

export interface PriceLookupResult {
  sku: string;
  region: string;
  currency: string;
  unitPrice: number; // hourly rate or unit rate
  monthlyPrice: number; // usually unitPrice * 730 or direct monthly rate
  unitOfMeasure: string;
  meterName: string;
  productName: string;
  serviceName: string;
  source: 'Azure Retail Prices API' | 'SQLite Cache' | 'Demo Data' | 'Fallback Baseline';
  fromCache: boolean;
  rawApiItem?: unknown;
}

export interface AnalyzedResourceCost {
  address: string;
  type: string;
  name: string;
  action: TerraformAction;
  region: string;
  displaySku: string;
  oldSku?: string;
  newSku?: string;
  oldHourlyCost: number;
  newHourlyCost: number;
  oldMonthlyCost: number;
  newMonthlyCost: number;
  monthlyDelta: number;
  isBillable: boolean;
  skipReason?: string;
  pricingSource: string;
  fromCache: boolean;
  details: string;
}

export interface CostAnalysisSummary {
  priorMonthlyCost: number;
  projectedMonthlyCost: number;
  netMonthlyImpact: number;
  budgetThreshold: number;
  currency: string;
  currencySymbol: string;
  verdict: 'PASSED' | 'FAILED';
  verdictTitle: string;
  verdictSubtitle: string;
  deploymentBlocked: boolean;
  exitCode: 0 | 1;
  cacheHits: number;
  apiLookups: number;
  totalResourcesAnalyzed: number;
  billableResourcesCount: number;
  skippedResourcesCount: number;
  analyzedAt: string;
  resources: AnalyzedResourceCost[];
  skippedResources: AnalyzedResourceCost[];
  isDemoData: boolean;
}

export interface SqliteCacheEntry {
  sku: string;
  region: string;
  currency: string;
  service_name: string;
  hourly_price: number;
  monthly_price: number;
  unit: string;
  meter_name: string;
  product_name: string;
  source: string;
  hits: number;
  cached_at: string;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalLookups: number;
  hitRatio: number;
  engine: 'SQLite (node:sqlite)' | 'Client Memory Cache';
}
