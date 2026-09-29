/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Database, RefreshCw, Trash2, X } from 'lucide-react';
import { CacheStats, SqliteCacheEntry } from '../types/costguard.ts';
import { clientPricingCache } from '../lib/sqliteCache.ts';

interface CacheInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCacheCleared: () => void;
}

export const CacheInspectorModal: React.FC<CacheInspectorModalProps> = ({
  isOpen,
  onClose,
  onCacheCleared,
}) => {
  const [entries, setEntries] = useState<SqliteCacheEntry[]>([]);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [backendEngine, setBackendEngine] = useState<string>('node:sqlite');

  const fetchCacheData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cache');
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
        setStats(data.stats || null);
        if (data.engine) setBackendEngine(data.engine);
      } else {
        // Fallback to client cache
        const clientEntries = await clientPricingCache.getAll();
        const clientStats = await clientPricingCache.getStats();
        setEntries(clientEntries);
        setStats(clientStats);
      }
    } catch {
      const clientEntries = await clientPricingCache.getAll();
      const clientStats = await clientPricingCache.getStats();
      setEntries(clientEntries);
      setStats(clientStats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCacheData();
    }
  }, [isOpen]);

  const handleClearCache = async () => {
    try {
      await fetch('/api/cache/clear', { method: 'POST' });
    } catch {
      // ignore
    }
    await clientPricingCache.clear();
    await fetchCacheData();
    onCacheCleared();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-sans flex items-center gap-2">
                <span>Embedded SQLite Pricing Cache</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                  {backendEngine}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Composite Key: <code className="font-mono text-slate-300">SKU + Region + Currency</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearCache}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 flex items-center gap-1.5 transition-colors"
              title="Clear SQLite table to test live cache miss"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Cache</span>
            </button>
            <button
              onClick={fetchCacheData}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 p-4 bg-slate-950/50 border-b border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Cached SKUs</span>
              <span className="font-mono text-base font-bold text-white tabular-nums">
                {stats.totalEntries}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Cumulative Hits</span>
              <span className="font-mono text-base font-bold text-indigo-300 tabular-nums">
                {stats.totalHits}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Cache Engine</span>
              <span className="font-mono text-xs font-semibold text-emerald-400 block truncate mt-1">
                {stats.engine}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Performance</span>
              <span className="font-mono text-xs text-slate-300 block mt-1">
                ~0.1ms read latency
              </span>
            </div>
          </div>
        )}

        {/* Entries Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {entries.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>The SQLite pricing cache is currently empty.</p>
              <p className="mt-1 text-slate-400">
                Run an analysis or load a demo plan to populate cache rows from the live Azure API.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="pb-2">SKU</th>
                  <th className="pb-2">Region</th>
                  <th className="pb-2">Currency</th>
                  <th className="pb-2 text-right">Hourly Rate</th>
                  <th className="pb-2 text-right">Monthly (730h)</th>
                  <th className="pb-2 text-center">Hits</th>
                  <th className="pb-2 text-right">Cached At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {entries.map((entry) => (
                  <tr key={`${entry.sku}-${entry.region}-${entry.currency}`} className="hover:bg-slate-800/30">
                    <td className="py-2.5 font-bold text-slate-200">{entry.sku}</td>
                    <td className="py-2.5 text-slate-400">{entry.region}</td>
                    <td className="py-2.5 text-slate-400">{entry.currency}</td>
                    <td className="py-2.5 text-right text-slate-300 tabular-nums">
                      ${entry.hourly_price.toFixed(4)}
                    </td>
                    <td className="py-2.5 text-right font-bold text-indigo-300 tabular-nums">
                      ${entry.monthly_price.toFixed(2)}
                    </td>
                    <td className="py-2.5 text-center">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800">
                        {entry.hits}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-slate-400 text-[10px]">
                      {new Date(entry.cached_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
