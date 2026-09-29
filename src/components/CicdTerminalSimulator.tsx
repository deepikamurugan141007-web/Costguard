/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Check, Copy, Terminal, X } from 'lucide-react';
import { CostAnalysisSummary } from '../types/costguard.ts';
import { formatCurrency } from '../lib/costAnalyzer.ts';

interface CicdTerminalSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  summary: CostAnalysisSummary | null;
}

export const CicdTerminalSimulator: React.FC<CicdTerminalSimulatorProps> = ({
  isOpen,
  onClose,
  summary,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'cli' | 'github_actions'>('cli');

  if (!isOpen) return null;

  const isPassed = summary?.verdict === 'PASSED';
  const exitCode = summary ? summary.exitCode : 0;
  const currency = summary?.currency || 'USD';
  const netImpact = summary ? formatCurrency(summary.netMonthlyImpact, currency) : '+$34.90';
  const budget = summary ? formatCurrency(summary.budgetThreshold, currency) : '$50.00';
  const prior = summary ? formatCurrency(summary.priorMonthlyCost, currency) : '$15.18';
  const projected = summary ? formatCurrency(summary.projectedMonthlyCost, currency) : '$50.08';

  const terminalOutput = summary
    ? `$ costguard scan --plan tfplan.json --budget ${summary.budgetThreshold} --currency ${currency}

[CostGuard v1.0.0] Initializing Azure Cost Impact Predictor...
[CostGuard] Reading plan from tfplan.json (format_version: 1.2)
[CostGuard] Resource Extractor: ${summary.totalResourcesAnalyzed} resources discovered
[CostGuard]   - Billable resources: ${summary.billableResourcesCount}
[CostGuard]   - Non-billable skipped: ${summary.skippedResourcesCount} (Resource Groups, VNets, Subnets)
[CostGuard] Embedded SQLite Cache: ${summary.cacheHits} hits, ${summary.apiLookups} live Azure Retail Prices API lookups

--------------------------------------------------------------------------------
RESOURCE COST IMPACT BREAKDOWN:
--------------------------------------------------------------------------------
${summary.resources
  .map(
    (r) =>
      `  • ${r.address.padEnd(36)} [${r.action.toUpperCase()}] ${
        r.monthlyDelta >= 0 ? '+' : ''
      }${formatCurrency(r.monthlyDelta, currency)} (${r.fromCache ? 'cache' : 'azure_api'})`
  )
  .join('\n')}

================================================================================
FINANCIAL FIREWALL VERDICT:
================================================================================
  Prior Monthly Cost:     ${prior}
  Projected Monthly Cost: ${projected}
  Net Monthly Impact:     ${summary.netMonthlyImpact >= 0 ? '+' : ''}${netImpact}
  Budget Threshold:       +${budget}

  Status: ${isPassed ? '✓ PASSED — Within Budget' : '✗ FAILED — Budget Threshold Breached'}
  Deployment: ${isPassed ? 'APPROVED TO PROCEED' : 'BLOCKED (Threshold Exceeded)'}
================================================================================
Process finished with exit code ${exitCode}`
    : '$ costguard --help';

  const githubActionsYaml = `name: Terraform Deployment Guard
on:
  pull_request:
    branches: [ main ]

jobs:
  cost-guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3

      - name: Terraform Plan
        run: |
          terraform init
          terraform plan -out=tfplan.binary
          terraform show -json tfplan.binary > tfplan.json

      - name: Run CostGuard Pre-Deployment Firewall
        run: |
          npx costguard scan \\
            --plan tfplan.json \\
            --budget 50.00 \\
            --fail-on-breach
        # Exits with 0 if within budget, exits with 1 if budget breached (blocking PR merge)`;

  const handleCopy = () => {
    const text = activeTab === 'cli' ? terminalOutput : githubActionsYaml;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-slate-950 border border-slate-800 rounded-xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden">
        {/* Terminal Header */}
        <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <span className="text-xs font-mono text-slate-300 ml-2 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-400" />
              costguard-cli · CI/CD Runner
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-950 rounded p-0.5 border border-slate-800 text-xs font-mono">
              <button
                onClick={() => setActiveTab('cli')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  activeTab === 'cli' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                CLI Output
              </button>
              <button
                onClick={() => setActiveTab('github_actions')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  activeTab === 'github_actions'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                GitHub Actions YAML
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Copy"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 bg-slate-950 font-mono text-xs text-slate-200 overflow-x-auto max-h-[60vh]">
          {activeTab === 'cli' ? (
            <pre className="whitespace-pre-wrap leading-relaxed text-slate-300 font-mono">
              {terminalOutput}
            </pre>
          ) : (
            <pre className="whitespace-pre-wrap leading-relaxed text-indigo-300 font-mono">
              {githubActionsYaml}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            Exit Code Behavior:{' '}
            <code className="text-emerald-400 font-mono">0 (pass)</code> /{' '}
            <code className="text-rose-400 font-mono">1 (fail/block)</code>
          </span>
          <span className="font-mono text-slate-400">
            Enforces strict pre-deployment gate in CI/CD
          </span>
        </div>
      </div>
    </div>
  );
};
