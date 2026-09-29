/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';
import { CostAnalysisSummary } from '../types/costguard.ts';
import { formatCurrency } from '../lib/costAnalyzer.ts';

interface TerminalReportProps {
  summary: CostAnalysisSummary | null;
}

export const TerminalReport: React.FC<TerminalReportProps> = ({ summary }) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!summary) return null;

  const currency = summary.currency;
  const isPassed = summary.verdict === 'PASSED';
  const isSavings = summary.netMonthlyImpact < 0;

  const prior = formatCurrency(summary.priorMonthlyCost, currency);
  const projected = formatCurrency(summary.projectedMonthlyCost, currency);
  const net = isSavings
    ? `-${formatCurrency(Math.abs(summary.netMonthlyImpact), currency)} (${formatCurrency(
        Math.abs(summary.netMonthlyImpact),
        currency
      )} monthly savings)`
    : summary.netMonthlyImpact > 0
    ? `+${formatCurrency(summary.netMonthlyImpact, currency)}`
    : '±$0.00';
  const budget = formatCurrency(summary.budgetThreshold, currency);

  const reportText = `================================================================================
COSTGUARD: Azure Infrastructure Cost Impact Report
================================================================================
Pricing Source: Azure Retail Prices API (Consumption)
Cache Engine:   Embedded SQLite (node:sqlite)
Multiplier:     730 Hours / Month
Timestamp:      ${summary.analyzedAt}

--------------------------------------------------------------------------------
RESOURCE COST BREAKDOWN
--------------------------------------------------------------------------------
Resource Address                         Action   Region   SKU/Meter         Old ($/mo)  New ($/mo)  Delta ($/mo)
--------------------------------------------------------------------------------
${summary.resources
  .map((r) => {
    const addr = r.address.padEnd(39).slice(0, 39);
    const act = r.action.toUpperCase().padEnd(8);
    const reg = r.region.padEnd(8);
    const sku = r.displaySku.padEnd(17).slice(0, 17);
    const oldC = formatCurrency(r.oldMonthlyCost, currency).padStart(11);
    const newC = formatCurrency(r.newMonthlyCost, currency).padStart(11);
    const delta = (r.monthlyDelta >= 0 ? `+${formatCurrency(r.monthlyDelta, currency)}` : formatCurrency(r.monthlyDelta, currency)).padStart(13);
    return `${addr}  ${act} ${reg} ${sku} ${oldC} ${newC} ${delta}`;
  })
  .join('\n')}
${summary.skippedResources
  .map((s) => {
    const addr = s.address.padEnd(39).slice(0, 39);
    const act = s.action.toUpperCase().padEnd(8);
    const reg = s.region.padEnd(8);
    return `${addr}  ${act} ${reg} Skipped – Non-billable`;
  })
  .join('\n')}

--------------------------------------------------------------------------------
FINANCIAL SUMMARY
--------------------------------------------------------------------------------
  Prior Monthly Total:      ${prior}
  Projected Monthly Total:  ${projected}
  Net Monthly Impact:       ${net}

  Cache:                    ${summary.cacheHits} hits
  API:                      ${summary.apiLookups} lookups
  Resources Analyzed:       ${summary.totalResourcesAnalyzed} (${summary.billableResourcesCount} billable, ${summary.skippedResourcesCount} skipped)

--------------------------------------------------------------------------------
POLICY VERDICT
--------------------------------------------------------------------------------
  Budget Threshold:         +${budget}/mo
  Status:                   ${isPassed ? 'PASSED' : 'FAILED'}
  Deployment:               ${isPassed ? 'Deployment Within Budget' : 'Deployment Blocked'}
  Exit Code:                ${summary.exitCode}
${
  !isPassed
    ? `
  [CIRCUIT BREAKER]
  CostGuard: Budget threshold breached.
  Deployment blocked.
`
    : ''
}================================================================================`;

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden mb-6" id="terminal-report">
      {/* Header */}
      <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold text-slate-200">
            Terminal CostGuard Report (CLI Output)
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="px-2.5 py-1 rounded text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5"
          title="Copy raw terminal output"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied!' : 'Copy Report'}</span>
        </button>
      </div>

      {/* Terminal View */}
      <div className="p-4 bg-slate-950 font-mono text-xs text-slate-300 overflow-x-auto max-h-96">
        <pre className="whitespace-pre leading-relaxed select-text font-mono">
          {reportText}
        </pre>
      </div>
    </div>
  );
};
