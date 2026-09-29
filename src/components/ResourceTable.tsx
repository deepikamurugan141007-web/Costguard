/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Database,
  Globe,
  Info,
} from 'lucide-react';
import { AnalyzedResourceCost } from '../types/costguard.ts';
import { formatCurrency } from '../lib/costAnalyzer.ts';

interface ResourceTableProps {
  resources: AnalyzedResourceCost[];
  skippedResources?: AnalyzedResourceCost[];
  currency: string;
}

export const ResourceTable: React.FC<ResourceTableProps> = ({
  resources,
  skippedResources = [],
  currency,
}) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'billable' | 'skipped'>('all');

  const toggleRow = (address: string) => {
    setExpandedRow((prev) => (prev === address ? null : address));
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'create':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 font-mono">
            create
          </span>
        );
      case 'delete':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-950/70 text-rose-400 border border-rose-800/60 font-mono">
            delete
          </span>
        );
      case 'update':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-950/70 text-indigo-400 border border-indigo-800/60 font-mono">
            update
          </span>
        );
      case 'replace':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-950/70 text-amber-400 border border-amber-800/60 font-mono">
            replace
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-800">
            {action}
          </span>
        );
    }
  };

  const allItems = [
    ...resources,
    ...skippedResources.map((s) => ({
      ...s,
      isSkipped: true,
    })),
  ];

  const displayedItems =
    filter === 'billable'
      ? resources
      : filter === 'skipped'
      ? skippedResources
      : allItems;

  return (
    <div className="bg-slate-900/60 border border-slate-800/90 rounded-xl overflow-hidden" id="breakdown">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white font-sans flex items-center gap-2">
            <span>Resource Cost Breakdown</span>
            <span className="text-xs font-normal text-slate-400">
              ({resources.length} billable, {skippedResources.length} skipped)
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Non-billable resources were skipped from cost calculation.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded transition-colors ${
              filter === 'all'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({allItems.length})
          </button>
          <button
            onClick={() => setFilter('billable')}
            className={`px-2.5 py-1 rounded transition-colors ${
              filter === 'billable'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Billable ({resources.length})
          </button>
          <button
            onClick={() => setFilter('skipped')}
            className={`px-2.5 py-1 rounded transition-colors ${
              filter === 'skipped'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Skipped ({skippedResources.length})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-medium font-sans">
              <th className="py-3 px-4 w-8"></th>
              <th className="py-3 px-4">Resource</th>
              <th className="py-3 px-3">Action</th>
              <th className="py-3 px-3">Region</th>
              <th className="py-3 px-4">SKU</th>
              <th className="py-3 px-4 text-right">Previous Monthly Cost</th>
              <th className="py-3 px-4 text-right">Proposed Monthly Cost</th>
              <th className="py-3 px-4 text-right">Delta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {displayedItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  No resources in this view.
                </td>
              </tr>
            ) : (
              displayedItems.map((item) => {
                const isSkipped = !item.isBillable;
                const isExpanded = expandedRow === item.address;
                const isIncrease = item.monthlyDelta > 0;
                const isDecrease = item.monthlyDelta < 0;
                const isZero = item.monthlyDelta === 0;

                return (
                  <React.Fragment key={item.address}>
                    <tr
                      onClick={() => !isSkipped && toggleRow(item.address)}
                      className={`transition-colors ${
                        isSkipped
                          ? 'bg-slate-950/20 text-slate-400'
                          : 'hover:bg-slate-800/40 cursor-pointer group'
                      } ${isExpanded ? 'bg-slate-800/30' : ''}`}
                    >
                      <td className="py-3 px-4 text-slate-500">
                        {!isSkipped ? (
                          isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                          )
                        ) : null}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-200">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{item.address}</span>
                          {!isSkipped && item.fromCache && (
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-sans font-medium bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 flex items-center gap-1"
                              title="Price retrieved from embedded SQLite cache"
                            >
                              <Database className="w-2.5 h-2.5" />
                              Cached
                            </span>
                          )}
                          {!isSkipped && !item.fromCache && (
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-sans font-medium bg-sky-950/80 text-sky-300 border border-sky-800/60 flex items-center gap-1"
                              title="Price retrieved live from Azure Retail Prices API"
                            >
                              <Globe className="w-2.5 h-2.5" />
                              Azure Live
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">{getActionBadge(item.action)}</td>
                      <td className="py-3 px-3 font-mono text-slate-400">{item.region}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{item.displaySku}</td>

                      {isSkipped ? (
                        <>
                          <td colSpan={3} className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                              Skipped – Non-billable
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400">
                            {formatCurrency(item.oldMonthlyCost, currency)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200 font-medium">
                            {formatCurrency(item.newMonthlyCost, currency)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                            {isZero ? (
                              <span className="text-slate-400">±$0.00</span>
                            ) : isIncrease ? (
                              <span className="text-amber-400 inline-flex items-center gap-0.5 justify-end">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                +{formatCurrency(item.monthlyDelta, currency)}
                              </span>
                            ) : (
                              <span className="text-emerald-400 inline-flex items-center gap-0.5 justify-end">
                                <ArrowDownRight className="w-3.5 h-3.5" />
                                {formatCurrency(item.monthlyDelta, currency)}
                              </span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>

                    {/* Expandable Details for Billable Row */}
                    {!isSkipped && isExpanded && (
                      <tr className="bg-slate-950/80">
                        <td colSpan={8} className="p-4 pl-12 border-y border-slate-800/60">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                              <span className="text-slate-400 block text-[11px] mb-1">
                                Pricing Source & Cache Status
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                {item.fromCache ? (
                                  <div className="flex items-center gap-1.5 text-indigo-400 font-medium">
                                    <Database className="w-3.5 h-3.5" />
                                    <span>SQLite Cache (Instant Hit)</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-sky-400 font-medium">
                                    <Globe className="w-3.5 h-3.5" />
                                    <span>Azure Retail Prices API (Live Query)</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 mt-2">
                                Region: {item.region} | SKU: {item.newSku || item.oldSku}
                              </p>
                            </div>

                            <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                              <span className="text-slate-400 block text-[11px] mb-1">
                                730 Hours/Month Formula
                              </span>
                              <div className="space-y-1 font-mono text-[11px] text-slate-300">
                                <div className="flex justify-between">
                                  <span>Previous Rate:</span>
                                  <span>${item.oldHourlyCost.toFixed(4)}/hr</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Proposed Rate:</span>
                                  <span>${item.newHourlyCost.toFixed(4)}/hr</span>
                                </div>
                                <div className="flex justify-between pt-1 border-t border-slate-800 text-slate-400">
                                  <span>Monthly Multiplier:</span>
                                  <span>730 hours</span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                              <span className="text-slate-400 block text-[11px] mb-1">
                                Resource Notes
                              </span>
                              <p className="text-slate-300 text-[11px] leading-relaxed">
                                {item.details}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-slate-950/60 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          Non-billable resources were skipped from cost calculation.
        </span>
        <span className="text-slate-400">
          Showing {displayedItems.length} resources
        </span>
      </div>
    </div>
  );
};
