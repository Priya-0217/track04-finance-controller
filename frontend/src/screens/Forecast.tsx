import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { StatCard } from '../components/StatCard';
import { DataTable, type Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { fmtINR } from '../lib/format';
import type { DailyProjection } from '../types/api';

export const Forecast: React.FC = () => {
  const [horizonDays, setHorizonDays] = useState<number>(7);

  const { data: forecast, isLoading } = useQuery({
    queryKey: ['forecast', horizonDays],
    queryFn: () => api.getForecast(horizonDays),
  });

  const columns: Column<DailyProjection>[] = [
    {
      key: 'day_offset',
      header: 'Timeline',
      accessor: (row) => <span className="font-mono font-medium text-gray-900">Day {row.day_offset}</span>,
      sortable: true,
    },
    {
      key: 'forecast_date',
      header: 'Date',
      accessor: (row) => <span className="font-mono text-gray-500">{row.forecast_date}</span>,
      sortable: true,
    },
    {
      key: 'day_name',
      header: 'Day',
      accessor: (row) => <span className="font-medium text-gray-900">{row.day_name}</span>,
      sortable: true,
    },
    {
      key: 'expected_gross_sales_inr',
      header: 'Expected Gross',
      accessor: (row) => <span className="font-mono font-semibold text-gray-900">{fmtINR(row.expected_gross_sales_inr)}</span>,
      align: 'right',
      sortable: true,
    },
    {
      key: 'projected_fee_deductions_inr',
      header: 'Fee Deductions',
      accessor: (row) => <span className="font-mono text-gray-500">{fmtINR(row.projected_fee_deductions_inr)}</span>,
      align: 'right',
      sortable: true,
    },
    {
      key: 'projected_net_settlement_inr',
      header: 'Net Settlement',
      accessor: (row) => (
        <span className="font-mono text-emerald-600 font-semibold">
          +{fmtINR(row.projected_net_settlement_inr)}
        </span>
      ),
      align: 'right',
      sortable: true,
    },
    {
      key: 'ending_balance_inr',
      header: 'Ending Balance',
      accessor: (row) => <span className="font-mono font-bold text-gray-900">{fmtINR(row.ending_balance_inr)}</span>,
      align: 'right',
      sortable: true,
    },
    {
      key: 'is_bank_holiday',
      header: 'Clearing Status',
      accessor: (row) =>
        row.is_bank_holiday ? (
          <Badge status="HOLIDAY">{row.holiday_reason || 'HOLIDAY'}</Badge>
        ) : (
          <Badge status="SETTLED">SETTLED</Badge>
        ),
      align: 'center',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Forward Cash Forecaster</h1>
          <p className="text-xs text-gray-500">7 to 30-day liquidity projections with 2026 RBI bank holiday clearing rollovers</p>
        </div>
        <div className="flex items-center space-x-3">
          <label htmlFor="forecast-horizon-select" className="text-xs text-gray-500 font-medium">
            Projection Horizon:
          </label>
          <select
            id="forecast-horizon-select"
            value={horizonDays}
            onChange={(e) => setHorizonDays(Number(e.target.value))}
            className="px-2.5 py-1 text-xs bg-white border border-gray-200 rounded-[4px] font-mono text-gray-800 focus:outline-none focus:border-black"
          >
            <option value={7}>7 Days Ahead</option>
            <option value={14}>14 Days Ahead</option>
            <option value={30}>30 Days Ahead</option>
          </select>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Current Liquid Balance"
          value={fmtINR(forecast?.current_liquid_balance_inr)}
          subtitle="Verified base in bank account"
          isLoading={isLoading}
        />
        <StatCard
          title="Projected Ending Balance"
          value={fmtINR(forecast?.projected_ending_balance_inr)}
          subtitle={
            <span className="text-emerald-600 font-medium">
              {(forecast?.net_liquidity_change_inr ?? 0) >= 0 ? '+' : ''}
              {fmtINR(forecast?.net_liquidity_change_inr)} net change
            </span>
          }
          isLoading={isLoading}
        />
        <StatCard
          title="Total Expected Inflows"
          value={fmtINR(forecast?.total_projected_inflow_inr)}
          subtitle="Net after contract fee deductions"
          isLoading={isLoading}
        />
        <StatCard
          title="Projected Gateway Fee Drag"
          value={fmtINR(forecast?.total_projected_fee_drag_inr)}
          subtitle="MDR + 18% GST"
          isLoading={isLoading}
        />
      </div>

      {/* Treasury Recommendation Banner */}
      <div className="card-box p-4 bg-gray-50 border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="space-y-0.5">
          <span className="text-[10px] font-mono uppercase text-gray-500 font-semibold tracking-wider">
            Treasury Recommendation
          </span>
          <p className="text-xs font-semibold text-gray-900">
            {isLoading ? 'Analyzing liquidity position...' : forecast?.treasury_recommendation}
          </p>
        </div>
        <Link
          to="/chat"
          className="px-3 py-1 rounded-[4px] bg-black text-white text-xs font-medium hover:bg-gray-800 transition"
        >
          Ask AI Forecaster
        </Link>
      </div>

      {/* Daily Projections Table */}
      <div className="space-y-2">
        <div className="flex justify-between items-center px-1">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Daily Cash Settlement Schedule</h2>
            <p className="text-xs text-gray-500">Rail lag simulation (UPI T+0, Debit T+1, Credit T+2, International T+3)</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={forecast?.daily_projections || []}
          keyExtractor={(row) => `fc-day-${row.day_offset}`}
          isLoading={isLoading}
          pageSize={30}
          caption="Daily cash forecast settlement projections table"
        />
      </div>

      {/* Clearing & Holiday Alerts */}
      <div className="card-box p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Clearing &amp; Holiday Alerts</h2>
        <div className="space-y-2 text-xs">
          {!forecast?.alerts?.length ? (
            <div className="text-gray-400 font-mono text-xs">Zero clearing interruptions expected.</div>
          ) : (
            forecast.alerts.map((a, idx) => (
              <div key={`alert-${idx}`} className="p-2.5 rounded-[4px] bg-gray-50 border border-gray-100 space-y-0.5">
                <div className="font-semibold text-gray-900 text-xs">{a.title}</div>
                <p className="text-[11px] text-gray-600">{a.description}</p>
                <p className="text-[10px] text-gray-500 font-mono">Action: {a.recommended_action}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
