/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Database,
  FileCode2,
  Globe,
  Layers,
  ShieldCheck,
  Workflow,
} from 'lucide-react';

export const ArchitectureDiagram: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(true);

  const archSteps = [
    { num: '01', title: 'Terraform Plan JSON', desc: 'Ingests compiled plan JSON containing resource_changes[]' },
    { num: '02', title: 'Resource Extractor', desc: 'Parses type, address, actions, and before/after configs' },
    { num: '03', title: 'Billable Resource Filter', desc: 'Filters out free resource groups, VNets, and subnets' },
    { num: '04', title: 'SKU + Region', desc: 'Extracts compute/storage SKUs and normalizes region (eastus)' },
    { num: '05', title: 'SQLite Cache', desc: 'Checks local cache (sku + region + currency); instant hit' },
    { num: '06', title: 'Azure Retail Prices API', desc: 'On miss, queries live prices.azure.com with OData filters' },
    { num: '07', title: 'Hourly Price', desc: 'Retrieves standard Consumption unit rate (Spot/Low Priority filtered)' },
    { num: '08', title: '× 730', desc: 'Multiplies hourly rate by 730 hours/month standard consumption' },
    { num: '09', title: 'Previous vs Proposed', desc: 'Evaluates baseline cost vs post-apply proposed cost' },
    { num: '10', title: 'Net Monthly Delta', desc: 'Calculates Proposed - Previous (or savings if negative)' },
    { num: '11', title: 'Budget Guardrail', desc: 'Compares Net Impact vs Maximum Allowed Monthly Increase' },
    { num: '12', title: 'PASS / BLOCK', desc: 'Exit code 0 (within budget) or exit code 1 (deployment blocked)' },
  ];

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden mb-6" id="architecture">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Workflow className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-sans">
              How CostGuard Works
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              9-step pre-deployment financial firewall pipeline from Terraform Plan to PASS/BLOCK verdict.
            </p>
          </div>
        </div>

        <div className="text-slate-500">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-800 p-5 bg-slate-950/40 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {archSteps.map((step) => (
              <div
                key={step.num}
                className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 text-xs flex gap-2.5"
              >
                <div className="w-6 h-6 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-mono font-bold flex items-center justify-center shrink-0">
                  {step.num}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200">{step.title}</h4>
                  <p className="text-slate-400 text-[11px] mt-0.5 leading-snug">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
