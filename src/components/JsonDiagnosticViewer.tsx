/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertCircle, AlertTriangle, ArrowRight, CornerDownRight, Lightbulb, Wrench } from 'lucide-react';
import { JsonDiagnosticError } from '../lib/jsonDiagnostic.ts';

interface JsonDiagnosticViewerProps {
  error: JsonDiagnosticError;
  onJumpToLine?: (line: number) => void;
  onQuickFix?: () => void;
}

export const JsonDiagnosticViewer: React.FC<JsonDiagnosticViewerProps> = ({
  error,
  onJumpToLine,
  onQuickFix,
}) => {
  return (
    <div className="rounded-xl border border-rose-800/80 bg-rose-950/30 overflow-hidden shadow-lg shadow-rose-950/30 text-xs animate-fadeIn">
      {/* Top Banner */}
      <div className="bg-rose-950/80 border-b border-rose-800/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-rose-200 uppercase tracking-wide text-[11px]">
            {error.type === 'syntax' ? 'Malformed JSON Syntax' : 'Terraform Schema Validation Issue'}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-900/90 text-rose-200 border border-rose-700">
            Line {error.line}, Col {error.column}
          </span>
          {onJumpToLine && (
            <button
              onClick={() => onJumpToLine(error.line)}
              className="px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-800/70 transition-colors flex items-center gap-1"
            >
              <span>Jump to Line</span>
              <ArrowRight className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* Error Description */}
      <div className="px-4 py-3 border-b border-rose-900/40 space-y-1">
        <p className="font-mono text-rose-200 text-xs leading-relaxed font-medium">
          {error.message}
        </p>
      </div>

      {/* Code Snippet Context Preview */}
      {error.snippet && error.snippet.length > 0 && (
        <div className="bg-slate-950/90 px-4 py-3 font-mono text-[11px] overflow-x-auto border-b border-slate-900">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-sans flex items-center gap-1.5">
            <CornerDownRight className="w-3 h-3 text-rose-400" />
            <span>Code Context (Line {error.line}):</span>
          </div>

          <div className="space-y-1">
            {error.snippet.map((line) => {
              const isTarget = line.isError;
              return (
                <div key={line.lineNum} className="space-y-0.5">
                  <div
                    className={`flex items-stretch rounded transition-colors ${
                      isTarget
                        ? 'bg-rose-950/70 border border-rose-600/40 text-rose-100 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    {/* Line number gutter */}
                    <div
                      className={`w-12 shrink-0 py-0.5 px-2 text-right select-none font-mono text-[10px] border-r ${
                        isTarget
                          ? 'bg-rose-900/60 border-rose-700/60 text-rose-300 font-bold'
                          : 'border-slate-800/80 text-slate-600'
                      }`}
                    >
                      {isTarget ? `▶ ${line.lineNum}` : line.lineNum}
                    </div>

                    {/* Line text */}
                    <div className="py-0.5 px-3 whitespace-pre overflow-x-auto flex-1 font-mono">
                      {line.text || ' '}
                    </div>
                  </div>

                  {/* Character Pointer Indicator underneath target line */}
                  {isTarget && error.pointerCol > 0 && (
                    <div className="flex select-none text-rose-400 pl-14 text-[10px] font-mono leading-none py-0.5">
                      <span
                        style={{
                          paddingLeft: `${Math.max(0, error.pointerCol - 1)}ch`,
                        }}
                      >
                        ▲ Error detected near column {error.column}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggested Fix Hint */}
      {error.hint && (
        <div className="bg-slate-950/60 px-4 py-2.5 flex items-start gap-2.5 text-slate-300">
          <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 leading-snug">
            <span className="font-semibold text-amber-300 text-[11px] block">
              Suggested Fix:
            </span>
            <p className="text-[11px] text-slate-300">{error.hint}</p>
          </div>
          {onQuickFix && (
            <button
              onClick={onQuickFix}
              className="ml-auto px-2 py-1 rounded bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 border border-amber-800 text-[10px] font-medium shrink-0 flex items-center gap-1 transition-colors"
            >
              <Wrench className="w-3 h-3" />
              <span>Auto-Fix</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
