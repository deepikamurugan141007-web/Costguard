#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { analyzeTerraformCost } from './src/lib/costAnalyzer.ts';
import { formatCurrency } from './src/lib/costAnalyzer.ts';
import { nodeSqlitePricingCache } from './src/lib/sqliteNodeCache.ts';

// Parse command line arguments
const args = process.argv.slice(2);

let planPath: string | null = null;
let maxIncrease = 50.0;
let currency = 'USD';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--plan' && args[i + 1]) {
    planPath = args[++i];
  } else if ((arg === '--max-increase' || arg === '--budget') && args[i + 1]) {
    maxIncrease = Number(args[++i]) || 50.0;
  } else if (arg === '--currency' && args[i + 1]) {
    currency = args[++i];
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
CostGuard: Azure Infrastructure Cost Impact Predictor (CLI)

Usage:
  terraform show -json tfplan.binary | costguard --max-increase <amount>
  costguard --plan <path-to-tfplan.json> --max-increase <amount>

Options:
  --plan <path>           Path to Terraform plan JSON file
  --max-increase <num>    Maximum allowed monthly increase (default: 50)
  --currency <code >      Billing currency code (default: USD)
  --help, -h              Show this help message

Exit Codes:
  0: Within budget (Deployment Approved)
  1: Budget threshold breached (Deployment Blocked)
  2: Invalid JSON or missing required arguments
`);
    process.exit(0);
  }
}

async function readInput(): Promise<string> {
  if (planPath) {
    const resolved = path.resolve(process.cwd(), planPath);
    if (!fs.existsSync(resolved)) {
      console.error(`[CostGuard ERROR] File not found: ${resolved}`);
      process.exit(2);
    }
    return fs.readFileSync(resolved, 'utf-8');
  }

  // Check if stdin has data
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  console.error('[CostGuard ERROR] No plan provided. Use --plan <file> or pipe via stdin.');
  process.exit(2);
}

async function main() {
  const rawInput = await readInput();
  if (!rawInput.trim()) {
    console.error('[CostGuard ERROR] Input plan is empty.');
    process.exit(2);
  }

  let planJson: any;
  try {
    planJson = JSON.parse(rawInput);
    if (!planJson.resource_changes || !Array.isArray(planJson.resource_changes)) {
      console.error('[CostGuard ERROR] Invalid Terraform Plan JSON: Missing "resource_changes" array.');
      process.exit(2);
    }
  } catch (err: any) {
    console.error(`[CostGuard ERROR] Failed to parse JSON: ${err.message}`);
    process.exit(2);
  }

  console.log(`[CostGuard v1.0.0] Initializing Azure Cost Impact Predictor...`);
  console.log(`[CostGuard] Maximum Allowed Monthly Increase: +$${maxIncrease.toFixed(2)}/mo`);

  try {
    const summary = await analyzeTerraformCost({
      planJson,
      budgetThreshold: maxIncrease,
      currency,
      cache: nodeSqlitePricingCache,
    });

    console.log(`
================================================================================
COSTGUARD: Azure Infrastructure Cost Impact Report
================================================================================
Pricing Source: Azure Retail Prices API
Cache Engine:   Embedded SQLite
Consumption:    730 Hours / Month

--------------------------------------------------------------------------------
RESOURCE COST BREAKDOWN
--------------------------------------------------------------------------------`);

    for (const r of summary.resources) {
      const deltaStr =
        r.monthlyDelta >= 0
          ? `+${formatCurrency(r.monthlyDelta, currency)}`
          : formatCurrency(r.monthlyDelta, currency);
      console.log(
        `  • ${r.address.padEnd(38)} [${r.action.toUpperCase()}] ${deltaStr.padStart(10)} (${r.fromCache ? 'cache' : 'azure_api'})`
      );
    }

    for (const s of summary.skippedResources) {
      console.log(`  • ${s.address.padEnd(38)} [${s.action.toUpperCase()}] Skipped – Non-billable`);
    }

    const prior = formatCurrency(summary.priorMonthlyCost, currency);
    const projected = formatCurrency(summary.projectedMonthlyCost, currency);
    const net =
      summary.netMonthlyImpact < 0
        ? `-${formatCurrency(Math.abs(summary.netMonthlyImpact), currency)} (${formatCurrency(Math.abs(summary.netMonthlyImpact), currency)} monthly savings)`
        : `+${formatCurrency(summary.netMonthlyImpact, currency)}`;

    console.log(`
--------------------------------------------------------------------------------
FINANCIAL SUMMARY
--------------------------------------------------------------------------------
  Prior Monthly Total:      ${prior}
  Projected Monthly Total:  ${projected}
  Net Monthly Impact:       ${net}

  Cache:                    ${summary.cacheHits} hits
  API:                      ${summary.apiLookups} lookups

--------------------------------------------------------------------------------
POLICY VERDICT
--------------------------------------------------------------------------------
  Budget Threshold:         +${formatCurrency(summary.budgetThreshold, currency)}/mo
  Status:                   ${summary.verdict === 'PASSED' ? 'PASSED (Deployment Within Budget)' : 'FAILED (Deployment Blocked)'}
  Exit Code:                ${summary.exitCode}`);

    if (summary.deploymentBlocked) {
      console.log(`
  [CIRCUIT BREAKER]
  CostGuard: Budget threshold breached.
  Deployment blocked.
`);
    }

    console.log(`================================================================================`);
    process.exit(summary.exitCode);
  } catch (err: any) {
    console.error(`[CostGuard RUNTIME ERROR] ${err.message}`);
    process.exit(2);
  }
}

main();
