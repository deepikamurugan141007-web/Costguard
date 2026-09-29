/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ArchitectureDiagram } from './components/ArchitectureDiagram.tsx';
import { BudgetVerdictBanner } from './components/BudgetVerdictBanner.tsx';
import { CacheInspectorModal } from './components/CacheInspectorModal.tsx';
import { CicdTerminalSimulator } from './components/CicdTerminalSimulator.tsx';
import { DeploymentGateSection } from './components/DeploymentGateSection.tsx';
import { FutureScopeSection } from './components/FutureScopeSection.tsx';
import { Header } from './components/Header.tsx';
import { PlanInputSection } from './components/PlanInputSection.tsx';
import { ReportGeneratorModal } from './components/ReportGeneratorModal.tsx';
import { ResourceTable } from './components/ResourceTable.tsx';
import { SummaryCards } from './components/SummaryCards.tsx';
import { TerminalReport } from './components/TerminalReport.tsx';
import { TestPlansSection } from './components/TestPlansSection.tsx';
import { VisualFlow } from './components/VisualFlow.tsx';
import { DEMO_PLAN_SPEC } from './data/samplePlans.ts';
import { analyzeTerraformCost } from './lib/costAnalyzer.ts';
import { CostAnalysisSummary, TerraformPlanJson } from './types/costguard.ts';

export default function App() {
  const [activePlan, setActivePlan] = useState<TerraformPlanJson | null>(DEMO_PLAN_SPEC);
  const [activePlanName, setActivePlanName] = useState<string>('Demo Spec Plan');
  const [summary, setSummary] = useState<CostAnalysisSummary | null>(null);
  const [budgetThreshold, setBudgetThreshold] = useState<number>(50.0);
  const [currency, setCurrency] = useState<string>('USD');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [cacheCount, setCacheCount] = useState<number>(0);

  // Modals
  const [isCacheModalOpen, setIsCacheModalOpen] = useState<boolean>(false);
  const [isCicdModalOpen, setIsCicdModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // Fetch cache stats for badge
  const refreshCacheCount = async () => {
    try {
      const res = await fetch('/api/cache');
      if (res.ok) {
        const data = await res.json();
        setCacheCount(data.stats?.totalEntries || data.entries?.length || 0);
      }
    } catch {
      // ignore
    }
  };

  // Run analysis pipeline
  const runAnalysis = async (
    plan: TerraformPlanJson | string,
    budget: number,
    curr: string,
    isDemo: boolean,
    planName: string = 'Active Plan'
  ) => {
    setIsLoading(true);
    let planObj: TerraformPlanJson;
    try {
      planObj = typeof plan === 'string' ? JSON.parse(plan) : plan;
      setActivePlan(planObj);
      setActivePlanName(planName);
    } catch {
      setIsLoading(false);
      return;
    }

    try {
      // Try backend Express endpoint with persistent node:sqlite
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planJson: planObj,
          budgetThreshold: budget,
          currency: curr,
          isDemo,
        }),
      });

      if (res.ok) {
        const data: CostAnalysisSummary = await res.json();
        setSummary(data);
      } else {
        throw new Error('Backend error, falling back to client engine');
      }
    } catch {
      // Client-side fallback calculation
      try {
        const clientResult = await analyzeTerraformCost({
          planJson: planObj,
          budgetThreshold: budget,
          currency: curr,
          isDemo,
        });
        setSummary(clientResult);
      } catch (err: any) {
        console.error('Client analysis error:', err);
      }
    } finally {
      setIsLoading(false);
      refreshCacheCount();
    }
  };

  // Initial load: analyze primary demo plan (B1s -> D2s_v3 + P10 Disk with $50 budget)
  useEffect(() => {
    runAnalysis(DEMO_PLAN_SPEC, 50.0, 'USD', true, 'Demo Spec Plan');
  }, []);

  const handleClear = () => {
    setActivePlan(null);
    setSummary(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Bar Contract: 3-zone Header */}
      <Header
        onOpenCache={() => setIsCacheModalOpen(true)}
        onOpenCicd={() => setIsCicdModalOpen(true)}
        onOpenReport={() => setIsReportModalOpen(true)}
        cacheCount={cacheCount}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Visual Workflow Pipeline */}
        <VisualFlow />

        {/* Section 4 & 5: Infrastructure Cost Check (Upload, Paste, Budget, Analyze) */}
        <PlanInputSection
          onAnalyze={(p, b, c, d) => runAnalysis(p, b, c, d, 'User Plan')}
          onClear={handleClear}
          isLoading={isLoading}
          budgetThreshold={budgetThreshold}
          setBudgetThreshold={setBudgetThreshold}
          currency={currency}
          setCurrency={setCurrency}
        />

        {/* Loading Spinner */}
        {isLoading && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-300">
              Querying Azure Retail Prices API & Checking SQLite Pricing Cache...
            </p>
            <p className="text-xs text-slate-400 font-mono">
              Extracting SKUs, regions, and calculating 730-hour consumption run rates
            </p>
          </div>
        )}

        {/* Analysis Results View */}
        {!isLoading && summary && (
          <div className="space-y-6 animate-fadeIn">
            {/* Section 17: Metric Summary Cards (4 primary + secondary stats) */}
            <SummaryCards summary={summary} />

            {/* Section 18: Resource Cost Breakdown Table (with non-billable rows marked) */}
            <ResourceTable
              resources={summary.resources}
              skippedResources={summary.skippedResources}
              currency={summary.currency}
            />

            {/* Section 19: Budget Guardrail Policy Verdict Banner */}
            <BudgetVerdictBanner summary={summary} />

            {/* Pre-Deployment Gate Action */}
            <DeploymentGateSection summary={summary} />

            {/* Section 21: Terminal-Style CostGuard Report */}
            <TerminalReport summary={summary} />

            {/* Section 24 & 25: Four Test Plans & Test Result Section */}
            <TestPlansSection
              onLoadAndRun={(p, name) => runAnalysis(p, budgetThreshold, currency, true, name)}
              summary={summary}
              currentPlanName={activePlanName}
            />

            {/* Section 34: Architecture Diagram (12-step flow) */}
            <ArchitectureDiagram />

            {/* Section 30: Future Scope Roadmap */}
            <FutureScopeSection />
          </div>
        )}

        {/* Empty State when cleared */}
        {!isLoading && !summary && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center space-y-4">
            <p className="text-slate-400 text-sm">
              No active analysis. Upload a plan file or click below to load the demo scenario.
            </p>
            <div>
              <button
                onClick={() => runAnalysis(DEMO_PLAN_SPEC, 50.0, 'USD', true, 'Demo Spec Plan')}
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
              >
                Load Demo Plan & Analyze
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">CostGuard</span>
            <span>·</span>
            <span>Azure Infrastructure Cost Impact Predictor</span>
            <span>·</span>
            <span className="text-slate-400">Pre-Deployment Financial Protection</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Pricing Source: <strong className="text-slate-300">Azure Retail Prices API</strong></span>
            <span>·</span>
            <span>Cache: <strong className="text-indigo-300">Embedded SQLite Cache</strong></span>
            <span>·</span>
            <span>Consumption: <strong>730 Hours / Month</strong></span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CacheInspectorModal
        isOpen={isCacheModalOpen}
        onClose={() => setIsCacheModalOpen(false)}
        onCacheCleared={() => {
          if (activePlan) {
            runAnalysis(activePlan, budgetThreshold, currency, Boolean(summary?.isDemoData), activePlanName);
          }
        }}
      />

      <CicdTerminalSimulator
        isOpen={isCicdModalOpen}
        onClose={() => setIsCicdModalOpen(false)}
        summary={summary}
      />

      <ReportGeneratorModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    </div>
  );
}
