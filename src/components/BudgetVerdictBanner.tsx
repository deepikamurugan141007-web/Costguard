/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertOctagon, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { CostAnalysisSummary } from '../types/costguard.ts';
import { formatCurrency } from '../lib/costAnalyzer.ts';

interface BudgetVerdictBannerProps {
  summary: CostAnalysisSummary;
}

export const BudgetVerdictBanner: React.FC<BudgetVerdictBannerProps> = ({ summary }) => {
  const isPassed = summary.verdict === 'PASSED';
  const currency = summary.currency;
  const netImpact = summary.netMonthlyImpact;
  const budget = summary.budgetThreshold;
  const isSavings = netImpact < 0;

  // Percentage of budget used (capped at 100% for bar)
  const budgetRatio = budget > 0 ? (netImpact / budget) * 100 : 100;
  const progressPercent = Math.min(100, Math.max(0, budgetRatio));

  return (
    <div
      className={`rounded-xl p-5 border transition-all duration-300 ${
        isPassed
          ? 'bg-emerald-950/25 border-emerald-500/50 text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.1)]'
          : 'bg-rose-950/30 border-rose-500/50 text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.15)]'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Left: Verdict Title & Status Message */}
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
              isPassed
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
            }`}
          >
            {isPassed ? <ShieldCheck className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border ${
                isPassed
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-rose-950 text-rose-300 border-rose-800'
              }`}>
                {summary.verdict}
              </span>

              {isPassed ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-emerald-500 text-white uppercase tracking-wider shadow-md shadow-emerald-950/40">
                  <CheckCircle2 className="w-4 h-4" />
                  Deployment Within Budget
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-rose-500 text-white uppercase tracking-wider shadow-md shadow-rose-950/40 animate-pulse">
                  <AlertOctagon className="w-4 h-4" />
                  Deployment Blocked
                </span>
              )}

              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-mono text-slate-300 bg-slate-900 border border-slate-700">
                Exit Code: <strong className={isPassed ? 'text-emerald-400' : 'text-rose-400'}>{summary.exitCode}</strong>
              </span>
            </div>

            {!isPassed && (
              <div className="mt-2.5 text-xs font-mono text-rose-300 bg-rose-950/60 border border-rose-800/80 px-3 py-1.5 rounded flex items-center gap-2">
                <span className="font-bold text-rose-400">[CIRCUIT BREAKER]</span>
                <span>Budget threshold breached. Deployment blocked.</span>
              </div>
            )}

            <p className="mt-2 text-sm text-slate-200 font-sans font-medium">
              {summary.verdictSubtitle}
            </p>
          </div>
        </div>

        {/* Right: Budget Utilization & Ceiling Comparison */}
        <div className="lg:w-80 shrink-0 bg-slate-950/80 rounded-lg p-3.5 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Budget Utilization</span>
            <span className="font-mono tabular-nums font-semibold text-slate-200">
              {isSavings ? '0% (Cost Savings)' : `${budgetRatio.toFixed(1)}% of Budget`}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isPassed ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{ width: `${isSavings ? 0 : progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-mono tabular-nums">
            <span>
              Net Impact:{' '}
              <strong className={isPassed ? 'text-emerald-400' : 'text-rose-400'}>
                {netImpact >= 0 ? `+${formatCurrency(netImpact, currency)}` : `-${formatCurrency(Math.abs(netImpact), currency)}`}
              </strong>
            </span>
            <span>
              Max Increase: <strong>+{formatCurrency(budget, currency)}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
