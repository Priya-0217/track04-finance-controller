import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { DataTable, type Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { fmtINR, fmtConfidence } from '../lib/format';
import type { MatchResult } from '../types/api';

export const ReconcileExplorer: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('all');

  const { data: report, isLoading } = useQuery({
    queryKey: ['reconcile-data'],
    queryFn: api.getReconcileData,
  });

  const columns: Column<MatchResult>[] = [
    {
      key: 'ledger_txn_id',
      header: 'Txn ID',
      accessor: (row) => <span className="font-mono text-gray-900 font-medium">{row.ledger_txn_id}</span>,
      sortable: true,
    },
    {
      key: 'settlement_payout_ref',
      header: 'Settlement Ref',
      accessor: (row) => <span className="font-mono text-gray-500">{row.settlement_payout_ref}</span>,
      sortable: true,
    },
    {
      key: 'merchant_id',
      header: 'Merchant',
      accessor: (row) => <span className="font-medium text-gray-900">{row.merchant_id}</span>,
      sortable: true,
    },
    {
      key: 'settlement_gross',
      header: 'Gross Amount',
      accessor: (row) => (
        <span className="font-mono text-gray-900 font-semibold">{fmtINR(row.settlement_gross)}</span>
      ),
      align: 'right',
      sortable: true,
    },
    {
      key: 'fee_deducted',
      header: 'Fee',
      accessor: (row) => <span className="font-mono text-gray-500">{fmtINR(row.fee_deducted)}</span>,
      align: 'right',
      sortable: true,
    },
    {
      key: 'settlement_net',
      header: 'Net Settled',
      accessor: (row) => (
        <span className="font-mono text-gray-900 font-semibold">{fmtINR(row.settlement_net)}</span>
      ),
      align: 'right',
      sortable: true,
    },
    {
      key: 'match_tier',
      header: 'Match Tier',
      accessor: (row) => <Badge tier={row.match_tier} />,
      align: 'center',
      sortable: true,
    },
    {
      key: 'confidence',
      header: 'Confidence',
      accessor: (row) => (
        <span className="font-mono text-gray-600 font-medium">{fmtConfidence(row.confidence)}</span>
      ),
      align: 'center',
      sortable: true,
    },
  ];

  const filteredMatches = useMemo(() => {
    if (!report?.matches) return [];
    const query = searchTerm.toLowerCase().trim();

    return report.matches.filter((m) => {
      const matchQ =
        !query ||
        m.ledger_txn_id.toLowerCase().includes(query) ||
        m.settlement_payout_ref.toLowerCase().includes(query) ||
        m.merchant_id.toLowerCase().includes(query);

      const matchT =
        tierFilter === 'all' ||
        m.match_tier === tierFilter ||
        m.match_tier.toLowerCase().includes(tierFilter.toLowerCase());

      return matchQ && matchT;
    });
  }, [report?.matches, searchTerm, tierFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            4-Tier Reconciled Matches Explorer
          </h1>
          <p className="text-xs text-gray-500">
            Sorted &amp; paginated matching results across deterministic and semantic layers ({filteredMatches.length} verified pairs)
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <a
            href="/api/export/matches-csv"
            download
            className="px-3 py-1.5 rounded-[4px] bg-black text-white text-xs font-medium hover:bg-gray-800 transition inline-block"
          >
            Export Matches CSV
          </a>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card-box p-3.5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex items-center space-x-2 flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Txn ID, Payout Ref, Merchant..."
            className="w-full sm:w-72 px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-[4px] focus:outline-none focus:border-black font-mono"
          />
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-[4px] font-mono text-gray-700 focus:outline-none focus:border-black"
          >
            <option value="all">All Tiers ({report?.matches?.length || 0})</option>
            <option value="tier1">Tier 1: Exact ID (1.00)</option>
            <option value="tier2">Tier 2: Fuzzy Tolerance (0.95)</option>
            <option value="tier3">Tier 3: Semantic ONNX (0.80+)</option>
          </select>
        </div>
      </div>

      {/* Generic DataTable */}
      <DataTable
        columns={columns}
        data={filteredMatches}
        keyExtractor={(row, idx) => `${row.ledger_txn_id}-${idx}`}
        isLoading={isLoading}
        pageSize={25}
        caption="Reconciled transactions matching table"
      />
    </div>
  );
};
