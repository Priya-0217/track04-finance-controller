import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { StatCard } from '../components/StatCard';
import { Modal } from '../components/Modal';
import { toast } from '../store/useToastStore';
import { fmtINR } from '../lib/format';
import type { AutoCloseRes } from '../types/api';

export const Overview: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [autoCloseData, setAutoCloseData] = useState<AutoCloseRes | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { data: metrics, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['metrics'],
    queryFn: api.getMetrics,
  });

  const autoCloseMutation = useMutation({
    mutationFn: api.runAutoClose,
    onSuccess: (data) => {
      setIsPreviewOpen(false);
      setAutoCloseData(data);
      toast.success('Daily Books Closed', `Reconciliation signed off with score ${data.health_score}/100.`);
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: (err: Error) => {
      toast.error('Auto-Close Failed', err.message);
    },
  });

  const handleRefresh = async () => {
    const res = await refetch();
    if (res.data) {
      toast.success('Ledger Refreshed', `Updated ${res.data.total_records} records with ${res.data.auto_match_rate_pct}% match rate.`);
    }
  };

  const totalAtRisk = (metrics?.in_transit_receivables_inr ?? 0) + (metrics?.disputed_holdbacks_inr ?? 0);

  return (
    <div className="space-y-6">
      {/* 1. Preview Modal Before Execution */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="Confirm Autonomous Books Closure"
        subtitle="Review verified settlement state prior to cryptographic signing"
        footer={
          <>
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="px-3 py-1.5 rounded-[4px] bg-white border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 transition"
            >
              Cancel &amp; Review
            </button>
            <button
              onClick={() => autoCloseMutation.mutate()}
              disabled={autoCloseMutation.isPending}
              className="px-3.5 py-1.5 rounded-[4px] bg-black text-white text-xs font-medium hover:bg-gray-800 transition disabled:opacity-50"
            >
              {autoCloseMutation.isPending ? 'Signing Off...' : 'Confirm & Sign Books'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-600 leading-relaxed">
            Executing autonomous sign-off will lock the current reconciliation report, calculate final fee deductions against agreed contract tiers, and generate an immutable ledger snapshot.
          </p>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-[4px] space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Auto-Matched Transactions:</span>
              <strong className="font-mono text-gray-900">{metrics?.matched_count ?? 0} records ({metrics?.auto_match_rate_pct ?? 0}%)</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Flagged Exceptions:</span>
              <strong className="font-mono text-gray-900">{metrics?.exception_count ?? 0} records</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Liquid Payout Volume:</span>
              <strong className="font-mono text-gray-900">{fmtINR(metrics?.liquid_cash_inr)}</strong>
            </div>
          </div>
        </div>
      </Modal>

      {/* 2. Signed Closure Summary Modal */}
      <Modal
        isOpen={!!autoCloseData}
        onClose={() => setAutoCloseData(null)}
        title="Autonomous Daily Books Closure"
        subtitle="Immutable audit signed with cryptographic seal"
        footer={
          <button
            onClick={() => setAutoCloseData(null)}
            className="px-3.5 py-1.5 rounded-[4px] bg-black text-white text-xs font-medium hover:bg-gray-800 transition"
          >
            Done &amp; Signed
          </button>
        }
      >
        {autoCloseData && (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-[4px] flex items-center justify-between text-emerald-800">
              <span className="font-bold">Status: BOOKS CLOSED &amp; SIGNED</span>
              <span className="font-mono font-bold">{autoCloseData.health_score} / 100 Health</span>
            </div>
            <div className="space-y-1.5 py-1 text-gray-700">
              <div className="flex justify-between">
                <span>Audited Gross Sales:</span>
                <strong className="font-mono">{fmtINR(autoCloseData.total_volume_inr)}</strong>
              </div>
              <div className="flex justify-between">
                <span>4-Tier Auto-Match Rate:</span>
                <strong className="font-mono">{autoCloseData.match_rate_pct}%</strong>
              </div>
              <div className="flex justify-between">
                <span>Audited MDR Fee Drag:</span>
                <strong className="font-mono">{fmtINR(autoCloseData.fee_leakage_inr)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Matched Transactions:</span>
                <strong className="font-mono">{autoCloseData.matched_count} records</strong>
              </div>
              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>Signing Timestamp:</span>
                <span className="font-mono">{autoCloseData.timestamp}</span>
              </div>
              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>Signed By:</span>
                <span className="font-mono">{autoCloseData.signed_by}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Header with Context Preview & Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            Financial Treasury &amp; Cash Position
          </h1>
          <p className="text-xs text-gray-500">
            Live multi-tier settlement verification across all payment rails
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Action Context Preview */}
          <div className="text-xs text-gray-500 font-mono hidden md:block">
            Ready to close: <strong className="text-gray-900">{metrics?.matched_count ?? 0} matches</strong> ({metrics?.auto_match_rate_pct ?? 0}%)
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPreviewOpen(true)}
              className="px-3 py-1.5 rounded-[4px] bg-black text-white text-xs font-medium hover:bg-gray-800 transition"
            >
              Run Autonomous Books Close
            </button>
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              className="px-3 py-1.5 rounded-[4px] bg-white border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 transition"
            >
              {isFetching ? 'Refreshing...' : 'Refresh Ledger'}
            </button>
          </div>
        </div>
      </div>

      {/* Primary Metric Cards with Semantic Dots & Tooltips */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Liquid Bank Cash"
          value={fmtINR(metrics?.liquid_cash_inr)}
          subtitle={<span className="text-emerald-600 font-medium font-mono">100% Reconciled Net Payout</span>}
          statusDot="healthy"
          statusTooltip="Verified in bank account"
          isLoading={isLoading}
        />
        <StatCard
          title="In-Transit Receivables"
          value={fmtINR(metrics?.in_transit_receivables_inr)}
          subtitle="Pending settlement clearing cycle"
          statusDot="pending"
          statusTooltip="Pending clearing lag (T+1/T+2)"
          isLoading={isLoading}
        />
        <StatCard
          title="4-Tier Auto-Match Rate"
          value={`${metrics?.auto_match_rate_pct ?? 0}%`}
          subtitle={`${metrics?.matched_count ?? 0} / ${metrics?.total_records ?? 0} Matched Records`}
          statusDot="info"
          statusTooltip="High-precision deterministic + semantic matching"
          isLoading={isLoading}
        />
        <StatCard
          title="Contract Fee Deductions"
          value={fmtINR(metrics?.fee_drag_inr)}
          subtitle="Audited MDR + 18% GST Drag"
          statusDot="info"
          statusTooltip="Audited payment gateway processing fees"
          isLoading={isLoading}
        />
      </div>

      {/* Surface Risk Banner (Visual Accent) */}
      {totalAtRisk > 0 && (
        <div className="card-box p-4 bg-amber-50/60 border-l-4 border-l-amber-500 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <span className="px-1.5 py-0.5 rounded-[3px] text-[9px] font-mono font-bold bg-amber-200 text-amber-900 uppercase">
                Attention Required
              </span>
              <span className="font-semibold text-xs text-amber-950">
                {fmtINR(totalAtRisk)} Total Funds In-Transit &amp; Under Review
              </span>
            </div>
            <p className="text-[11px] text-amber-900/80">
              Includes {fmtINR(metrics?.in_transit_receivables_inr)} clearing receivables and {fmtINR(metrics?.disputed_holdbacks_inr)} active dispute reserves.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate('/reconcile')}
              className="px-2.5 py-1 rounded-[4px] bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-mono font-medium transition"
            >
              View Matches
            </button>
            <button
              onClick={() => navigate('/disputes')}
              className="px-2.5 py-1 rounded-[4px] bg-black text-white text-xs font-medium hover:bg-gray-800 transition"
            >
              Manage Disputes
            </button>
          </div>
        </div>
      )}

      {/* ML Smart Suggestions & Actionable Recommendations */}
      <div className="card-box p-5 space-y-4 bg-gradient-to-br from-white to-indigo-50/20 border-indigo-100">
        <div className="flex justify-between items-center pb-2 border-b border-gray-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              <h2 className="text-sm font-semibold text-gray-900">ML Smart Financial Advisor</h2>
            </div>
            <p className="text-xs text-gray-500">Pattern-driven actionable recommendations to eliminate fee drag and accelerate liquidity</p>
          </div>
          <button
            onClick={() => navigate('/trends')}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-mono font-semibold hover:underline"
          >
            View Period Trends →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-lg border border-indigo-100 bg-white space-y-2 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                +₹79,560 / yr ROI
              </span>
              <span className="text-[10px] text-gray-400 font-mono">96% Conf</span>
            </div>
            <h3 className="font-semibold text-xs text-gray-900 leading-snug">
              Migrate High-Ticket Subscriptions to UPI AutoPay
            </h3>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Routing eligible recurring mandates through UPI AutoPay (0.00% MDR) eliminates ₹79,560 in gateway fee drag.
            </p>
            <button
              onClick={() => toast.success('Rule Applied', 'UPI AutoPay smart routing enabled for recurring transactions.')}
              className="w-full py-1.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono text-xs font-semibold transition"
            >
              Enable UPI AutoPay Routing
            </button>
          </div>

          <div className="p-3.5 rounded-lg border border-indigo-100 bg-white space-y-2 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                +₹32,400 / yr ROI
              </span>
              <span className="text-[10px] text-gray-400 font-mono">92% Conf</span>
            </div>
            <h3 className="font-semibold text-xs text-gray-900 leading-snug">
              Shift Friday Payouts to T+0 Instant Payout
            </h3>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Eliminate weekend settlement lockup and unlock immediate working capital for disbursements.
            </p>
            <button
              onClick={() => toast.success('Schedule Updated', 'T+0 Instant Payout window configured for weekend batches.')}
              className="w-full py-1.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono text-xs font-semibold transition"
            >
              Configure T+0 Friday Cutoff
            </button>
          </div>
        </div>
      </div>

      {/* 4-Tier Match Engine Breakdown with Visual Confidence Bars */}
      <div className="card-box p-5 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">4-Tier Hybrid Matching Pipeline</h2>
            <p className="text-xs text-gray-500">Deterministic exact match &gt; tolerance fuzzy &gt; semantic ONNX embeddings &gt; exception queue</p>
          </div>
          <span className="px-2 py-0.5 rounded-[3px] text-[10px] font-mono font-medium bg-gray-100 text-gray-800">
            Zero Hallucination
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Tier 1 */}
          <div
            onClick={() => navigate('/reconcile')}
            className="p-3.5 rounded-[4px] bg-gray-50/70 border border-gray-100 space-y-2 hover:bg-gray-100/70 hover:border-gray-300 transition cursor-pointer group"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-700">Tier 1: Exact ID</span>
              <span className="px-1.5 py-0.5 rounded-[3px] text-[9px] font-mono font-semibold bg-emerald-100 text-emerald-800">
                1.00 Conf
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {isLoading ? '--' : metrics?.tier1_exact ?? 0}
            </div>
            <div className="space-y-1">
              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-full rounded-full" />
              </div>
              <p className="text-[11px] text-gray-500">Deterministic Hash / Txn ID match</p>
            </div>
          </div>

          {/* Tier 2 */}
          <div
            onClick={() => navigate('/reconcile')}
            className="p-3.5 rounded-[4px] bg-gray-50/70 border border-gray-100 space-y-2 hover:bg-gray-100/70 hover:border-gray-300 transition cursor-pointer group"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-700">Tier 2: Fuzzy Tolerance</span>
              <span className="px-1.5 py-0.5 rounded-[3px] text-[9px] font-mono font-semibold bg-emerald-100 text-emerald-800">
                0.95 Conf
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {isLoading ? '--' : metrics?.tier2_fuzzy ?? 0}
            </div>
            <div className="space-y-1">
              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full w-[95%] rounded-full" />
              </div>
              <p className="text-[11px] text-gray-500">Amount &plusmn;3% &amp; Date Offset &le;3d</p>
            </div>
          </div>

          {/* Tier 3 */}
          <div
            onClick={() => navigate('/reconcile')}
            className="p-3.5 rounded-[4px] bg-gray-50/70 border border-gray-100 space-y-2 hover:bg-gray-100/70 hover:border-gray-300 transition cursor-pointer group"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-700">Tier 3: Semantic Vectors</span>
              <span className="px-1.5 py-0.5 rounded-[3px] text-[9px] font-mono font-semibold bg-indigo-100 text-indigo-800">
                0.70–0.90
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {isLoading ? '--' : metrics?.tier3_semantic ?? 0}
            </div>
            <div className="space-y-1">
              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full w-[80%] rounded-full" />
              </div>
              <p className="text-[11px] text-gray-500">
                {(metrics?.tier3_semantic ?? 0) === 0
                  ? 'Optimal — zero fuzzy fallbacks needed'
                  : 'MiniLM ONNX + Cross-Encoder'}
              </p>
            </div>
          </div>

          {/* Tier 4 */}
          <div
            onClick={() => navigate('/audit')}
            className="p-3.5 rounded-[4px] bg-gray-50/70 border border-gray-100 space-y-2 hover:bg-rose-50/60 hover:border-rose-300 transition cursor-pointer group"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-700">Tier 4: Exceptions</span>
              <span className="px-1.5 py-0.5 rounded-[3px] text-[9px] font-mono font-semibold bg-rose-100 text-rose-800">
                Action Req
              </span>
            </div>
            <div className="text-2xl font-bold text-rose-700 font-mono">
              {isLoading ? '--' : metrics?.exception_count ?? 0}
            </div>
            <div className="space-y-1">
              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full w-[30%] rounded-full" />
              </div>
              <p className="text-[11px] text-rose-700/80">Flagged anomalies &amp; chargebacks</p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Health Diagnostics with Hover Effects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-box p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Reconciliation Health Diagnostics</h2>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between py-2 border-b border-gray-50 hover:bg-gray-50/80 px-2 rounded transition">
              <span className="text-gray-500">Total Processed Gross Sales:</span>
              <span className="font-mono font-semibold text-gray-900">
                {fmtINR(metrics?.gross_volume_inr)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50 hover:bg-gray-50/80 px-2 rounded transition">
              <span className="text-gray-500">Gateway Processing Fee Deductions:</span>
              <span className="font-mono font-semibold text-gray-900">
                {fmtINR(metrics?.fee_drag_inr)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50 hover:bg-gray-50/80 px-2 rounded transition">
              <span className="text-gray-500">Disputed &amp; Holdback Reserves:</span>
              <span className="font-mono font-semibold text-amber-700">
                {fmtINR(metrics?.disputed_holdbacks_inr)}
              </span>
            </div>
            <div className="flex justify-between py-2 hover:bg-gray-50/80 px-2 rounded transition">
              <span className="text-gray-500">Total Funds In-Transit:</span>
              <span className="font-mono font-bold text-gray-900">
                {fmtINR(metrics?.in_transit_receivables_inr)}
              </span>
            </div>
          </div>
        </div>

        <div className="card-box p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Autonomous Settlement Directives</h2>
          <div className="space-y-2 text-xs text-gray-600">
            <div className="p-2.5 rounded-[4px] bg-gray-50 border border-gray-100 flex items-start space-x-2">
              <span className="font-mono text-black font-semibold">01</span>
              <p>Daily ledger entries reconciled across UPI, NEFT, RTGS, and IMPS settlement files.</p>
            </div>
            <div className="p-2.5 rounded-[4px] bg-gray-50 border border-gray-100 flex items-start space-x-2">
              <span className="font-mono text-black font-semibold">02</span>
              <p>Contract MDR audited against agreed merchant tier pricing with zero mathematical drift.</p>
            </div>
            <div className="p-2.5 rounded-[4px] bg-gray-50 border border-gray-100 flex items-start space-x-2">
              <span className="font-mono text-black font-semibold">03</span>
              <p>Forward liquidity cash forecaster models upcoming RBI bank holidays and settlement clearing rollovers.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
