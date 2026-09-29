/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowRight } from 'lucide-react';

export const VisualFlow: React.FC = () => {
  const steps = [
    { label: 'Terraform Plan', sub: 'Input JSON' },
    { label: 'Resource Extraction', sub: 'SKU & Region' },
    { label: 'Azure Pricing', sub: 'Live & Cache' },
    { label: 'Cost Calculation', sub: '730 hrs/month' },
    { label: 'Budget Guardrail', sub: 'Allowed Increase' },
    { label: 'PASS / BLOCK', sub: 'Deployment Gate' },
  ];

  return (
    <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3.5 mb-6">
      <div className="flex items-center justify-between overflow-x-auto pb-1 gap-2">
        {steps.map((s, idx) => (
          <React.Fragment key={s.label}>
            <div className="flex flex-col items-center text-center shrink-0 min-w-[110px] px-2 py-1 rounded bg-slate-950/60 border border-slate-800">
              <span className="text-xs font-semibold text-slate-200">{s.label}</span>
              <span className="text-[10px] text-slate-500 font-mono">{s.sub}</span>
            </div>
            {idx < steps.length - 1 && (
              <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
