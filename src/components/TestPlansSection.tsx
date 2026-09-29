/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Download,
  Layers,
  Play,
} from 'lucide-react';
import {
  TEST_PLAN_1_NEW_VM,
  TEST_PLAN_2_VM_DELETION,
  TEST_PLAN_3_VM_UPGRADE,
  TEST_PLAN_4_HOSTILE_NON_BILLABLE,
} from '../data/samplePlans.ts';
import { CostAnalysisSummary, TerraformPlanJson } from '../types/costguard.ts';
import { formatCurrency } from '../lib/costAnalyzer.ts';

interface TestPlansSectionProps {
  onLoadAndRun: (plan: TerraformPlanJson, planName: string) => void;
  summary: CostAnalysisSummary | null;
  currentPlanName?: string;
}

export const TestPlansSection: React.FC<TestPlansSectionProps> = ({
  onLoadAndRun,
  summary,
  currentPlanName,
}) => {
  const testPlans = [
    {
      id: 'plan_1',
      name: 'Plan 1: Net-New VM Creation',
      badge: 'New Compute',
      badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-800',
      desc: 'Provisions a new azurerm_linux_virtual_machine (Standard_B2s in East US).',
      expected: 'Positive delta (+$30.37/mo). Within $50 budget → PASSED',
      icon: <ArrowUpRight className="w-4 h-4 text-emerald-400" />,
      plan: TEST_PLAN_1_NEW_VM,
      fileName: 'test-plan-1-new-vm.json',
    },
    {
      id: 'plan_2',
      name: 'Plan 2: VM Deletion / Savings',
      badge: 'Cost Savings',
      badgeColor: 'bg-sky-950 text-sky-300 border-sky-800',
      desc: 'Deletes high-tier azurerm_linux_virtual_machine (Standard_D4s_v5 in East US).',
      expected: 'Negative delta / savings (-$140.16/mo). Always → PASSED',
      icon: <ArrowDownRight className="w-4 h-4 text-sky-400" />,
      plan: TEST_PLAN_2_VM_DELETION,
      fileName: 'test-plan-2-vm-deletion.json',
    },
    {
      id: 'plan_3',
      name: 'Plan 3: In-Place VM Upgrade',
      badge: 'Partial Delta',
      badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
      desc: 'Upgrades web VM from Standard_B1s ($7.59) to Standard_B2s ($30.37).',
      expected: 'Partial positive delta (+$22.78/mo). Within $50 budget → PASSED',
      icon: <Layers className="w-4 h-4 text-indigo-400" />,
      plan: TEST_PLAN_3_VM_UPGRADE,
      fileName: 'test-plan-3-vm-upgrade.json',
    },
    {
      id: 'plan_4',
      name: 'Plan 4: Hostile Non-Billable Plan',
      badge: 'Resilience Test',
      badgeColor: 'bg-amber-950 text-amber-300 border-amber-800',
      desc: 'Contains 8 non-billable resources (Resource Groups, VNets, Subnets, NSGs, Route Tables) + 1 VM.',
      expected: '8 resources skipped without crashing, 1 VM priced (+$7.59/mo) → PASSED',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
      plan: TEST_PLAN_4_HOSTILE_NON_BILLABLE,
      fileName: 'test-plan-4-hostile-non-billable.json',
    },
  ];

  const handleDownloadJson = (plan: TerraformPlanJson, fileName: string) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(plan, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', fileName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 mb-6" id="test-plans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white font-sans">
              Test Plans & Verification Suite
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
              4 Distinct Scenarios
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluate CostGuard against the four required test plans: VM creation, VM deletion, in-place upgrade, and hostile non-billable plans.
          </p>
        </div>
      </div>

      {/* Cards for each test plan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        {testPlans.map((item) => {
          const isActive = currentPlanName === item.name;
          return (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                isActive
                  ? 'bg-indigo-950/20 border-indigo-500/60 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-slate-900 border border-slate-800 flex items-center justify-center">
                      {item.icon}
                    </div>
                    <span className="font-semibold text-xs text-slate-200">{item.name}</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-1 leading-snug">{item.desc}</p>

                <div className="mt-2.5 p-2 rounded bg-slate-900/80 border border-slate-800/80 text-[11px] font-mono text-slate-300">
                  <span className="text-slate-500 font-sans block text-[10px]">Expected Outcome:</span>
                  {item.expected}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2">
                <button
                  onClick={() => onLoadAndRun(item.plan, item.name)}
                  className="flex-1 py-1.5 px-3 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Load & Run Test</span>
                </button>

                <button
                  onClick={() => handleDownloadJson(item.plan, item.fileName)}
                  className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
                  title="Download test plan JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Test Results Summary Section (Section 25) */}
      {summary && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Calculated Test Result: {currentPlanName || 'Active Test Plan'}</span>
            </h4>
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                summary.verdict === 'PASSED'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}
            >
              {summary.verdict} (exit code: {summary.exitCode})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-mono">
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 font-sans block">Resources Found</span>
              <span className="text-sm font-bold text-white tabular-nums">{summary.totalResourcesAnalyzed}</span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 font-sans block">Billable Resources</span>
              <span className="text-sm font-bold text-indigo-300 tabular-nums">{summary.billableResourcesCount}</span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 font-sans block">Skipped Resources</span>
              <span className="text-sm font-bold text-slate-400 tabular-nums">{summary.skippedResourcesCount}</span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 font-sans block">Prior Monthly Total</span>
              <span className="text-sm font-bold text-slate-300 tabular-nums">{formatCurrency(summary.priorMonthlyCost, summary.currency)}</span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 font-sans block">Projected Total</span>
              <span className="text-sm font-bold text-indigo-200 tabular-nums">{formatCurrency(summary.projectedMonthlyCost, summary.currency)}</span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 font-sans block">Net Impact</span>
              <span className={`text-sm font-bold tabular-nums ${summary.netMonthlyImpact <= 0 ? 'text-emerald-400' : summary.deploymentBlocked ? 'text-rose-400' : 'text-amber-400'}`}>
                {summary.netMonthlyImpact > 0 ? '+' : ''}{formatCurrency(summary.netMonthlyImpact, summary.currency)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
