import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useTenantStore } from '../store/useTenantStore';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldCheck,
  Percent,
  RefreshCw,
  Zap,
} from 'lucide-react';
import type { PeriodMetrics } from '../types/api';

export const BatchTrends: React.FC = () => {
  const { activeMerchantId } = useTenantStore();

  const { data: trends, refetch, isFetching } = useQuery({
    queryKey: ['trends', activeMerchantId],
    queryFn: () => api.getTrendComparison(activeMerchantId),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            Historical Batch Comparison &amp; Trend Variance
          </h1>
          <p className="text-xs text-gray-500 font-mono">
            Period-over-period telemetry • Day-over-Day (DoD) • Week-over-Week (WoW) • Month-over-Month (MoM)
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-white border border-gray-200 hover:border-black text-xs font-mono font-medium text-gray-800 transition shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh Analysis</span>
        </button>
      </div>

      {/* Trajectory Summary Banner */}
      {trends && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200 text-emerald-950 flex items-start space-x-3 shadow-sm">
          <Zap className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="font-semibold text-xs text-emerald-900">
              Period Variance &amp; Operational Efficiency Signal
            </h2>
            <p className="text-xs leading-relaxed text-emerald-800/90">
              {trends.trend_summary}
            </p>
          </div>
        </div>
      )}

      {/* Period Delta KPI Cards */}
      {trends && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-box p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-500 font-mono">
              <span>Match Rate Delta (DoD)</span>
              <Percent className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xl font-mono font-bold text-gray-900 flex items-center space-x-1.5">
              <span>{trends.match_rate_delta_pct >= 0 ? `+${trends.match_rate_delta_pct}%` : `${trends.match_rate_delta_pct}%`}</span>
              {trends.match_rate_delta_pct >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-600" />
              )}
            </div>
            <div className="text-[11px] text-gray-500">
              Current: <strong className="text-gray-800">{trends.current_period.auto_match_rate_pct}%</strong> vs Prev: {trends.previous_period.auto_match_rate_pct}%
            </div>
          </div>

          <div className="card-box p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-500 font-mono">
              <span>Gateway Fee Drag Drift</span>
              <ShieldCheck className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xl font-mono font-bold text-gray-900 flex items-center space-x-1.5">
              <span>{trends.fee_drag_delta_bps >= 0 ? `+${trends.fee_drag_delta_bps} bps` : `${trends.fee_drag_delta_bps} bps`}</span>
              {trends.fee_drag_delta_bps <= 0 ? (
                <TrendingDown className="w-4 h-4 text-emerald-600" />
              ) : (
                <TrendingUp className="w-4 h-4 text-rose-600" />
              )}
            </div>
            <div className="text-[11px] text-gray-500">
              Current: <strong className="text-gray-800">{trends.current_period.fee_drag_bps} bps</strong> vs Prev: {trends.previous_period.fee_drag_bps} bps
            </div>
          </div>

          <div className="card-box p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-500 font-mono">
              <span>Gross Volume Growth</span>
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xl font-mono font-bold text-gray-900 flex items-center space-x-1.5">
              <span>{trends.volume_growth_pct >= 0 ? `+${trends.volume_growth_pct}%` : `${trends.volume_growth_pct}%`}</span>
            </div>
            <div className="text-[11px] text-gray-500">
              Current: <strong className="text-gray-800">₹{trends.current_period.total_volume_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
            </div>
          </div>

          <div className="card-box p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-500 font-mono">
              <span>Settlement Velocity</span>
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xl font-mono font-bold text-gray-900">
              <span>{trends.current_period.settlement_velocity_hours}h</span>
            </div>
            <div className="text-[11px] text-gray-500">
              Average bank clearing turn-around time
            </div>
          </div>
        </div>
      )}

      {/* Multi-Period Comparative Matrix */}
      <div className="card-box overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <div>
            <h2 className="text-xs font-bold text-gray-900 uppercase font-mono tracking-wider">
              Multi-Period Historical Comparison Table
            </h2>
            <p className="text-[11px] text-gray-500 font-mono">
              Reconciliation performance and fee containment progression
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 bg-white border border-gray-200 rounded text-gray-700">
            Tenant: {activeMerchantId}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3 font-semibold">Period Range</th>
                <th className="px-4 py-3 font-semibold">Batch Date</th>
                <th className="px-4 py-3 font-semibold">Total Volume (INR)</th>
                <th className="px-4 py-3 font-semibold">Matched Volume (INR)</th>
                <th className="px-4 py-3 font-semibold">Auto-Match Rate</th>
                <th className="px-4 py-3 font-semibold">MDR Fee Drag</th>
                <th className="px-4 py-3 font-semibold">Unsettled Funds</th>
                <th className="px-4 py-3 font-semibold">Exceptions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trends?.historical_periods.map((p: PeriodMetrics, idx: number) => (
                <tr key={p.period_label} className={idx === 0 ? 'bg-emerald-50/40 font-semibold' : 'hover:bg-gray-50/50'}>
                  <td className="px-4 py-3 text-gray-900 flex items-center space-x-1.5">
                    {idx === 0 && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                    <span>{p.period_label}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.batch_date}</td>
                  <td className="px-4 py-3 text-gray-900">
                    ₹{p.total_volume_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    ₹{p.matched_volume_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                      {p.auto_match_rate_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.fee_drag_bps} bps</td>
                  <td className="px-4 py-3 text-amber-700 font-medium">
                    ₹{p.unsettled_funds_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={p.exception_count > 0 ? 'text-rose-600 font-bold' : 'text-gray-400'}>
                      {p.exception_count} items
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
