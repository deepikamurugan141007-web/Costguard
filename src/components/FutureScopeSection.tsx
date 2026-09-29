/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Compass } from 'lucide-react';

export const FutureScopeSection: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const roadmapItems = [
    { title: 'Currency switcher', desc: 'Real-time billing currency selector for EUR, GBP, CAD, AUD, and INR' },
    { title: '--clear-cache', desc: 'Direct CLI flag and webhook command to purge stale SQLite pricing cache entries' },
    { title: 'Tag-based cost attribution', desc: 'Policy checks attributing costs by cost_center, project, and team tags' },
    { title: 'GitHub Pull Request Markdown output', desc: 'Automated GitHub/GitLab PR commentary with formatted markdown delta tables' },
    { title: 'CI/CD integration', desc: 'Native pipeline step support in GitHub Actions, GitLab CI, and Azure Pipelines' },
    { title: 'GitHub Actions integration', desc: 'Pre-packaged Marketplace Action to gate pull requests before merge' },
    { title: 'Additional Azure resource pricing', desc: 'Expanding coverage to Azure Functions, CosmosDB, Event Hubs, and App Gateways' },
    { title: 'Multi-region cost analysis', desc: 'Comparing deployment costs across Azure regions (e.g. East US vs West Europe)' },
    { title: 'Data egress pricing', desc: 'Predicting internet egress and cross-region VNet peering bandwidth costs' },
    { title: 'AWS cross-cloud pricing', desc: 'Extending parser to support AWS EC2, EBS, and RDS via AWS Price List API' },
  ];

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-sans">
              Future Scope & Planned Roadmap
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Enterprise features planned for subsequent CostGuard releases.
            </p>
          </div>
        </div>

        <div className="text-slate-500">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-800 p-5 bg-slate-950/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {roadmapItems.map((item) => (
              <div
                key={item.title}
                className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 text-xs"
              >
                <div className="font-semibold text-slate-200">{item.title}</div>
                <p className="text-slate-400 text-[11px] mt-1 leading-snug">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
