/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Database,
  DollarSign,
  Globe,
  Layers,
  Shield,
  Tag,
} from 'lucide-react';
import { CostAnalysisSummary } from '../types/costguard.ts';
import { formatCurrency } from '../lib/costAnalyzer.ts';

interface SummaryCardsProps {
  summary: CostAnalysisSummary;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  const currency = summary.currency;
  const isNetIncrease = summary.netMonthlyImpact > 0;
  const isNetSavings = summary.netMonthlyImpact < 0;
  const isNetZero = summary.netMonthlyImpact === 0;

  return (
    <div className="space-y-3">
      {/* 4 Primary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Previous Monthly Cost */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Previous Monthly Cost</span>
            <DollarSign className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-white">
              {formatCurrency(summary.priorMonthlyCost, currency)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Existing infrastructure run rate</p>
          </div>
        </div>

        {/* 2. Proposed Monthly Cost */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Proposed Monthly Cost</span>
            <DollarSign className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-indigo-200">
              {formatCurrency(summary.projectedMonthlyCost, currency)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Projected post-apply run rate</p>
          </div>
        </div>

        {/* 3. Net Monthly Impact */}
        <div
          className={`border rounded-xl p-4 flex flex-col justify-between ${
            isNetZero
              ? 'bg-slate-900/70 border-slate-800'
              : isNetSavings
              ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-100'
              : summary.deploymentBlocked
              ? 'bg-rose-950/25 border-rose-500/40 text-rose-100'
              : 'bg-amber-950/20 border-amber-500/40 text-amber-100'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Net Monthly Impact</span>
            {isNetZero ? (
              <span className="text-slate-400 font-mono text-xs">±$0</span>
            ) : isNetSavings ? (
              <ArrowDownRight className="w-4 h-4 text-emerald-400" />
            ) : (
              <ArrowUpRight
                className={`w-4 h-4 ${summary.deploymentBlocked ? 'text-rose-400' : 'text-amber-400'}`}
              />
            )}
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold font-mono tabular-nums ${
                isNetZero
                  ? 'text-slate-200'
                  : isNetSavings
                  ? 'text-emerald-300'
                  : summary.deploymentBlocked
                  ? 'text-rose-300'
                  : 'text-amber-300'
              }`}
            >
              {summary.netMonthlyImpact > 0 ? '+' : ''}
              {formatCurrency(summary.netMonthlyImpact, currency)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isNetZero
                ? 'No cost difference'
                : isNetSavings
                ? `${formatCurrency(Math.abs(summary.netMonthlyImpact), currency)} monthly savings`
                : 'Projected monthly cost increase'}
            </p>
          </div>
        </div>

        {/* 4. Maximum Allowed Increase */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Maximum Allowed Increase</span>
            <Shield className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-white">
              +{formatCurrency(summary.budgetThreshold, currency)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Approved cost ceiling</p>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 text-xs">
        <div className="flex items-center gap-2 px-2 py-1">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-400">Resources Analyzed:</span>
          <span className="font-mono font-bold text-white tabular-nums">
            {summary.totalResourcesAnalyzed}
          </span>
        </div>

        <div className="flex items-center gap-2 px-2 py-1">
          <Tag className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-slate-400">Billable:</span>
          <span className="font-mono font-bold text-indigo-300 tabular-nums">
            {summary.billableResourcesCount}
          </span>
        </div>

        <div className="flex items-center gap-2 px-2 py-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-400">Skipped (Free):</span>
          <span className="font-mono font-bold text-slate-300 tabular-nums">
            {summary.skippedResourcesCount}
          </span>
        </div>

        <div className="flex items-center gap-2 px-2 py-1">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400">Cache Hits:</span>
          <span className="font-mono font-bold text-emerald-300 tabular-nums">
            {summary.cacheHits}
          </span>
        </div>

        <div className="flex items-center gap-2 px-2 py-1">
          <Globe className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-slate-400">API Lookups:</span>
          <span className="font-mono font-bold text-sky-300 tabular-nums">
            {summary.apiLookups}
          </span>
        </div>
      </div>
    </div>
  );
};
