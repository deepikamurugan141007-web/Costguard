/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Database, FileText, ShieldCheck, Terminal } from 'lucide-react';

interface HeaderProps {
  onOpenCache: () => void;
  onOpenCicd: () => void;
  onOpenReport: () => void;
  cacheCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCache,
  onOpenCicd,
  onOpenReport,
  cacheCount,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Zone */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-lg font-bold tracking-tight text-white font-sans">CostGuard</span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Pre-Deployment Financial Protection
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans hidden sm:block">
              Azure Infrastructure Cost Impact Predictor
            </p>
          </div>
        </div>

        {/* Center / Navigation Links */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400 font-medium">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-slate-300 text-[11px] font-mono">
            Pricing: <span className="text-sky-400 font-sans font-medium">Azure Retail Prices API</span>
          </span>
          <a
            href="#architecture"
            className="text-slate-400 hover:text-white px-2 py-1 rounded text-xs transition-colors"
          >
            Architecture
          </a>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenReport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-colors"
            title="Generate & download hackathon engineering report (REPORT.md)"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">REPORT.md</span>
          </button>

          <button
            onClick={onOpenCache}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-colors"
            title="Inspect embedded SQLite pricing cache"
          >
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span>SQLite Cache</span>
            {cacheCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                {cacheCount}
              </span>
            )}
          </button>

          <button
            onClick={onOpenCicd}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-colors"
            title="View CI/CD pipeline & CLI exit code simulation"
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">CLI / CI Guard</span>
          </button>
        </div>
      </div>
    </header>
  );
};
