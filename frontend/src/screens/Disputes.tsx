import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { DataTable, type Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { toast } from '../store/useToastStore';
import { fmtINR } from '../lib/format';
import type { Dispute } from '../types/api';

export const Disputes: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: disputes, isLoading } = useQuery({
    queryKey: ['disputes'],
    queryFn: api.getDisputes,
  });

  const resolveMutation = useMutation({
    mutationFn: (disputeId: string) => api.resolveDispute(disputeId, 'won'),
    onMutate: async (disputeId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['disputes'] });
      const prevDisputes = queryClient.getQueryData<Dispute[]>(['disputes']);

      queryClient.setQueryData<Dispute[]>(['disputes'], (old) =>
        old
          ? old.map((d) =>
              d.dispute_id === disputeId
                ? { ...d, status: 'won', holdback_active: false }
                : d
            )
          : []
      );

      return { prevDisputes };
    },
    onSuccess: (data) => {
      toast.success('Holdback Released', `Dispute ${data.dispute_id} resolved & funds released.`);
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: (err: Error, _disputeId, context) => {
      if (context?.prevDisputes) {
        queryClient.setQueryData(['disputes'], context.prevDisputes);
      }
      toast.error('Resolution Failed', err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
    },
  });

  const columns: Column<Dispute>[] = [
    {
      key: 'dispute_id',
      header: 'Dispute ID',
      accessor: (row) => <span className="font-mono text-gray-900 font-medium">{row.dispute_id}</span>,
      sortable: true,
    },
    {
      key: 'merchant_id',
      header: 'Merchant',
      accessor: (row) => <span className="font-medium text-gray-900">{row.merchant_id}</span>,
      sortable: true,
    },
    {
      key: 'amount',
      header: 'Amount',
      accessor: (row) => <span className="font-mono font-semibold text-gray-900">{fmtINR(row.amount)}</span>,
      align: 'right',
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (row) => <Badge status={row.status.toUpperCase()}>{row.status.toUpperCase()}</Badge>,
      align: 'center',
      sortable: true,
    },
    {
      key: 'reason',
      header: 'Reason',
      accessor: (row) => <span className="text-gray-600 text-xs">{row.reason}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      accessor: (row) =>
        row.holdback_active ? (
          <button
            onClick={() => resolveMutation.mutate(row.dispute_id)}
            disabled={resolveMutation.isPending}
            className="px-2 py-0.5 rounded-[3px] bg-black hover:bg-gray-800 text-white font-medium text-[11px] transition disabled:opacity-50"
          >
            Release Holdback
          </button>
        ) : (
          <span className="text-gray-400 font-mono text-xs">Resolved</span>
        ),
      align: 'center',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            Disputes, Chargebacks &amp; Holdback Reserves
          </h1>
          <p className="text-xs text-gray-500">
            Manage payment disputes, release holdbacks, and balance the reserve ledger
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={disputes || []}
        keyExtractor={(row) => row.dispute_id}
        isLoading={isLoading}
        pageSize={20}
        caption="Payment disputes and holdback management table"
      />
    </div>
  );
};
