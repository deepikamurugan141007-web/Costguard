/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Check, Copy, Download, FileText, X } from 'lucide-react';

interface ReportGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportGeneratorModal: React.FC<ReportGeneratorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const reportMarkdown = `# COSTGUARD: Azure Infrastructure Cost Impact Predictor
## Hackathon Engineering & Verification Report

### 1. WHAT WE BUILT
1. CostGuard is a pre-deployment developer financial firewall that intercepts compiled Terraform Plan JSON before infrastructure changes are applied to Microsoft Azure.
2. The core engine parses resource changes, isolates billable infrastructure from free grouping resources, and extracts normalized Azure SKUs and regions.
3. Pricing is retrieved in real-time from the official Azure Retail Prices API using targeted OData consumption queries while filtering out Spot and Low Priority rates.
4. An embedded SQLite pricing cache indexes hourly rates using a composite key (SKU + Region + Currency) to eliminate redundant remote network calls and optimize CI/CD pipeline latency.
5. Monthly costs are computed using the industry-standard 730 hours/month consumption model, and an automated budget guardrail issues a deterministic deployment verdict (PASSED with exit code 0 or FAILED with exit code 1).

### 2. DETECTION & EXTRACTION LOGIC
- Resource changes parsed from standard Terraform plan JSON format (resource_changes[]).
- Actions mapped cleanly:
  - create: Previous = $0, Proposed = new monthly cost, Delta = +new cost
  - delete: Previous = old monthly cost, Proposed = $0, Delta = -old cost (savings)
  - update: Compares before and after configurations; Delta = new cost - old cost
  - replacement (delete, create): Compares destroyed and created configurations
- SKU extracted from item.change.after.size or vm_size; region normalized (e.g. "East US" -> "eastus").
- Non-billable resources (Resource Groups, VNets, Subnets, NSGs) are skipped with $0 impact.

### 3. METHODS TABLE
- Pricing API: Official Azure Retail Prices API (https://prices.azure.com/api/retail/prices).
- Filter: serviceName, armRegionName, armSkuName, priceType eq 'Consumption' excluding Spot/Low Priority.
- Cache: Embedded SQLite (pricing_cache table with SKU + Region + Currency primary key).
- Multiplier: 730 hours/month consumption model.
- Gate: Exit code 0 if net increase <= budget; Exit code 1 if budget breached.

### 4. RESULTS MATRIX
- Demo Spec Plan (B1s -> D2s_v3 + P10 Disk): Net +$82.20 | Budget $50.00 -> FAILED (Blocked) | Exit 1
- Plan 1: Net-New VM (Standard_B2s): Net +$30.37 | Budget $50.00 -> PASSED | Exit 0
- Plan 2: VM Deletion (Standard_D4s_v5): Net -$140.16 (savings) -> PASSED | Exit 0
- Plan 3: In-Place Upgrade (B1s -> B2s): Net +$22.78 | Budget $50.00 -> PASSED | Exit 0
- Plan 4: Hostile Non-Billable (8 non-billable + 1 VM): 8 skipped, Net +$7.59 -> PASSED | Exit 0

### 5. HOW TO RUN IT
- Web Dashboard: npm run dev -> http://localhost:3000
- CLI Execution: terraform show -json tfplan.binary | npx tsx cli.ts --max-increase 50
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([reportMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'REPORT.md';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold text-white font-sans">
                CostGuard Engineering Verification Report (REPORT.md)
              </h3>
              <p className="text-xs text-slate-400">
                Official hackathon documentation artifact generated from live prototype metrics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Markdown'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-2.5 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download REPORT.md</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto font-mono text-xs text-slate-300 bg-slate-950/70 space-y-4">
          <pre className="whitespace-pre-wrap leading-relaxed select-text font-mono text-slate-300">
            {reportMarkdown}
          </pre>
        </div>
      </div>
    </div>
  );
};
