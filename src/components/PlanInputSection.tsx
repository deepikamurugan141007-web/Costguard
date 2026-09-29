/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileCode,
  Play,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react';
import { DEMO_PLAN_SPEC } from '../data/samplePlans.ts';
import { TerraformPlanJson } from '../types/costguard.ts';
import { validateTerraformPlanJson, JsonDiagnosticError } from '../lib/jsonDiagnostic.ts';
import { JsonDiagnosticViewer } from './JsonDiagnosticViewer.tsx';

interface PlanInputSectionProps {
  onAnalyze: (plan: TerraformPlanJson | string, budget: number, currency: string, isDemo: boolean) => void;
  onClear: () => void;
  isLoading: boolean;
  budgetThreshold: number;
  setBudgetThreshold: (val: number) => void;
  currency: string;
  setCurrency: (val: string) => void;
}

export const PlanInputSection: React.FC<PlanInputSectionProps> = ({
  onAnalyze,
  onClear,
  isLoading,
  budgetThreshold,
  setBudgetThreshold,
  currency,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('paste');
  const [jsonText, setJsonText] = useState<string>(() =>
    JSON.stringify(DEMO_PLAN_SPEC, null, 2)
  );
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<JsonDiagnosticError | null>(null);
  const [budgetInputError, setBudgetInputError] = useState<string | null>(null);

  // Synchronize gutter scrolling with textarea
  const handleTextareaScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Validate budget input
  const handleBudgetChange = (valStr: string) => {
    const num = Number(valStr);
    if (isNaN(num)) {
      setBudgetInputError('Must be a valid numeric amount.');
      return;
    }
    if (num < 0) {
      setBudgetInputError('Must be zero or greater.');
      return;
    }
    setBudgetInputError(null);
    setBudgetThreshold(num);
  };

  // Option A: Handle File Upload with granular error diagnostics
  const handleFileUpload = (file: File) => {
    setErrorMessage(null);
    setUploadSuccessMsg(null);
    setDiagnosticError(null);

    if (!file.name.endsWith('.json')) {
      setErrorMessage('✕ Invalid Terraform Plan JSON: Please upload a .json Terraform plan file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      setUploadedFileName(file.name);
      setJsonText(text);

      const validation = validateTerraformPlanJson(text);
      if (!validation.valid && validation.error) {
        setDiagnosticError(validation.error);
        setErrorMessage(
          `✕ Invalid Terraform Plan JSON: ${validation.error.message}`
        );
        return;
      }

      setUploadSuccessMsg(
        `✓ Terraform Plan JSON validated: "${file.name}" (${validation.totalResources} resource changes detected, ${validation.totalLines} lines)`
      );
      // Automatically analyze validated uploaded file
      onAnalyze(validation.parsed, budgetThreshold, currency, false);
    };
    reader.onerror = () => {
      setErrorMessage('✕ Invalid Terraform Plan JSON: Failed to read file. Please try again.');
    };
    reader.readAsText(file);
  };

  // Option B: Load Demo Plan
  const handleLoadDemoPlan = (plan: TerraformPlanJson = DEMO_PLAN_SPEC) => {
    setErrorMessage(null);
    setDiagnosticError(null);
    setUploadSuccessMsg(null);
    setUploadedFileName(null);
    const formatted = JSON.stringify(plan, null, 2);
    setJsonText(formatted);
    // Automatically trigger analysis
    onAnalyze(plan, budgetThreshold, currency, true);
  };

  // Handle manual Analyze Plan click with granular line number validation
  const handleAnalyzeClick = () => {
    setErrorMessage(null);
    setDiagnosticError(null);

    const validation = validateTerraformPlanJson(jsonText);
    if (!validation.valid && validation.error) {
      setDiagnosticError(validation.error);
      setErrorMessage(
        `✕ Invalid Terraform Plan JSON: ${validation.error.message}`
      );
      return;
    }

    setUploadSuccessMsg(
      `✓ Terraform Plan JSON validated (${validation.totalResources} resource changes detected, ${validation.totalLines} lines)`
    );
    onAnalyze(validation.parsed, budgetThreshold, currency, false);
  };

  // Jump to specific line in textarea
  const handleJumpToLine = (targetLine: number) => {
    if (!textareaRef.current) return;
    const lines = jsonText.split('\n');
    let charOffset = 0;
    for (let i = 0; i < targetLine - 1 && i < lines.length; i++) {
      charOffset += lines[i].length + 1;
    }
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(charOffset, charOffset + (lines[targetLine - 1]?.length || 0));

    // Scroll to the line
    const lineHeight = 20; // approximate px per line
    textareaRef.current.scrollTop = Math.max(0, (targetLine - 4) * lineHeight);
  };

  // Quick fix for common mistakes: single quotes or trailing commas
  const handleQuickFix = () => {
    let fixed = jsonText;
    // Replace trailing commas before } or ]
    fixed = fixed.replace(/,(\s*[\}\]])/g, '$1');
    // Replace single quotes surrounding keys or strings
    fixed = fixed.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

    setJsonText(fixed);
    const recheck = validateTerraformPlanJson(fixed);
    if (recheck.valid) {
      setDiagnosticError(null);
      setErrorMessage(null);
      setUploadSuccessMsg('✓ Common syntax issues automatically corrected.');
    } else if (recheck.error) {
      setDiagnosticError(recheck.error);
      setErrorMessage(`✕ Invalid Terraform Plan JSON: ${recheck.error.message}`);
    }
  };

  const handleClearAll = () => {
    setJsonText('');
    setUploadedFileName(null);
    setUploadSuccessMsg(null);
    setErrorMessage(null);
    setDiagnosticError(null);
    onClear();
  };

  // Compute lines for gutter
  const textLines = jsonText.split('\n');
  const errorLineNumber = diagnosticError?.line;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5" id="input-section">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-base font-bold text-white font-sans tracking-tight">
            Infrastructure Cost Check
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Provide your compiled Terraform Plan JSON to predict monthly cost impact before deployment.
          </p>
        </div>

        {/* Input Mode Selector Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('paste')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'paste'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Option B – Paste JSON
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'upload'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Option A – Upload File
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Option A (Upload) or Option B (Paste) */}
        <div className="lg:col-span-2 space-y-3">
          {activeTab === 'upload' ? (
            /* Option A: Upload */
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500/80 bg-slate-950/60 rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-md shadow-indigo-600/20"
                  >
                    Upload Plan JSON
                  </button>
                  <p className="text-xs text-slate-400 mt-2">
                    Accepts compiled <code className="text-slate-300 font-mono">.json</code> files containing <code className="text-slate-300 font-mono">resource_changes[]</code>
                  </p>
                </div>
              </div>

              {uploadedFileName && (
                <div className="flex items-center justify-between text-xs font-mono text-slate-300 bg-slate-950 px-3 py-2 rounded border border-slate-800">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-indigo-400" />
                    <span>File: <strong>{uploadedFileName}</strong></span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {textLines.length} lines · {(jsonText.length / 1024).toFixed(1)} KB
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Option B: Paste with Line Numbers Gutter */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Paste your Terraform Plan JSON here
                </label>
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                  <span>{textLines.length} lines</span>
                  <span>·</span>
                  <span>{(jsonText.length / 1024).toFixed(1)} KB</span>
                </div>
              </div>

              {/* Editor Container with Synchronized Line Numbers Gutter */}
              <div className={`relative flex rounded-lg border overflow-hidden bg-slate-950 ${
                diagnosticError
                  ? 'border-rose-700/80 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                  : 'border-slate-700/80 focus-within:border-indigo-500'
              }`}>
                {/* Left Gutter: Line Numbers */}
                <div
                  ref={gutterRef}
                  className="w-11 py-3 bg-slate-900/90 border-r border-slate-800 select-none overflow-hidden text-right font-mono text-[11px] leading-[20px] text-slate-600"
                >
                  {textLines.map((_, i) => {
                    const lineNum = i + 1;
                    const isError = lineNum === errorLineNumber;
                    return (
                      <div
                        key={lineNum}
                        className={`px-1.5 transition-colors ${
                          isError
                            ? 'bg-rose-900/80 text-rose-300 font-bold'
                            : 'hover:text-slate-400'
                        }`}
                        title={isError ? `Error at line ${lineNum}` : `Line ${lineNum}`}
                      >
                        {isError ? '✕' : lineNum}
                      </div>
                    );
                  })}
                </div>

                {/* Right: Code Textarea */}
                <textarea
                  ref={textareaRef}
                  value={jsonText}
                  onScroll={handleTextareaScroll}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    if (diagnosticError) {
                      // Dynamically revalidate to clear error as user fixes it
                      const check = validateTerraformPlanJson(e.target.value);
                      if (check.valid) {
                        setDiagnosticError(null);
                        setErrorMessage(null);
                      }
                    }
                  }}
                  placeholder='Paste your Terraform Plan JSON here (e.g. { "format_version": "1.2", "resource_changes": [...] })'
                  className="w-full h-64 p-3 bg-transparent text-slate-200 font-mono text-xs focus:outline-none resize-y leading-[20px] whitespace-pre"
                  spellCheck={false}
                />
              </div>
            </div>
          )}

          {/* Granular Malformed JSON Diagnostic Viewer */}
          {diagnosticError && (
            <JsonDiagnosticViewer
              error={diagnosticError}
              onJumpToLine={activeTab === 'paste' ? handleJumpToLine : undefined}
              onQuickFix={activeTab === 'paste' ? handleQuickFix : undefined}
            />
          )}

          {/* Fallback Error Message if no diagnostic error */}
          {!diagnosticError && errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-300 flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Validation Message */}
          {uploadSuccessMsg && !diagnosticError && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{uploadSuccessMsg}</span>
            </div>
          )}
        </div>

        {/* Right 1 Col: Budget & Actions */}
        <div className="flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-800 lg:pl-6 pt-4 lg:pt-0 space-y-4">
          <div className="space-y-4">
            {/* Maximum Allowed Monthly Increase Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Maximum Allowed Monthly Increase
                </label>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={budgetThreshold}
                  onChange={(e) => handleBudgetChange(e.target.value)}
                  className="w-full pl-7 pr-14 py-2 rounded-md bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                  USD
                </span>
              </div>
              {budgetInputError && (
                <p className="text-[11px] text-rose-400 mt-1">{budgetInputError}</p>
              )}
              <p className="text-[11px] text-slate-400 mt-1">
                Any net monthly increase exceeding this threshold blocks deployment.
              </p>
            </div>

            {/* Currency Selector (Fixed USD per prompt requirement) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Currency
              </label>
              <div className="px-3 py-2 rounded-md bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 flex items-center justify-between">
                <span>USD ($) — US Dollar</span>
                <span className="text-[10px] text-slate-400 font-sans">Active</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex flex-col gap-2.5">
            <button
              onClick={handleAnalyzeClick}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-md font-bold text-xs tracking-wider uppercase bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Calculating Azure Costs...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Analyze Plan</span>
                </>
              )}
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => handleLoadDemoPlan(DEMO_PLAN_SPEC)}
                className="flex-1 py-2 px-3 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Load Demo Plan</span>
              </button>

              <button
                onClick={handleClearAll}
                className="py-2 px-3 rounded-md text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors flex items-center justify-center gap-1"
                title="Clear input and results"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
