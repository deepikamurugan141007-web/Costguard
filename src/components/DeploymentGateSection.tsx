/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertOctagon, CheckCircle2 } from 'lucide-react';
import { CostAnalysisSummary } from '../types/costguard.ts';

interface DeploymentGateSectionProps {
  summary: CostAnalysisSummary | null;
}

export const DeploymentGateSection: React.FC<DeploymentGateSectionProps> = ({ summary }) => {
  if (!summary) return null;

  const isPassed = summary.verdict === 'PASSED';

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white font-sans">
              Pre-Deployment Gate Enforcement
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              (Financial Firewall)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            CostGuard acts as a financial circuit breaker before <code className="text-slate-300 font-mono">terraform apply</code>.
            {isPassed
              ? ' Infrastructure changes satisfy the financial policy and are cleared for deployment.'
              : ' Deployment is strictly prevented because the projected cost increase breaches the organizational budget ceiling.'}
          </p>
        </div>

        <div className="shrink-0 flex flex-col sm:items-end gap-1.5">
          {isPassed ? (
            <div className="px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 flex items-center justify-center gap-2 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Gate Decision: Approved</span>
            </div>
          ) : (
            <div className="px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-rose-950/80 text-rose-300 border border-rose-500/50 flex items-center justify-center gap-2 shadow-sm">
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              <span>Gate Decision: Blocked</span>
            </div>
          )}

          <span className="text-[11px] text-slate-400 font-mono text-center sm:text-right">
            Pre-deployment cost gate. No Azure resources are created by this prototype.
          </span>
        </div>
      </div>
    </div>
  );
};
