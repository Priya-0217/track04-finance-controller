import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { toast } from '../store/useToastStore';
import { fmtINR } from '../lib/format';
import type { SimulateTxnRes } from '../types/api';

export const Simulator: React.FC = () => {
  const queryClient = useQueryClient();

  const [merchantId, setMerchantId] = useState('merch_001');
  const [amount, setAmount] = useState<number>(5000);
  const [instrument, setInstrument] = useState('credit_card');
  const [description, setDescription] = useState('Online Checkout Order #88219');
  const [receipt, setReceipt] = useState<SimulateTxnRes | null>(null);

  const { data: merchants } = useQuery({
    queryKey: ['merchants'],
    queryFn: api.getMerchants,
    staleTime: 1000 * 60 * 5,
  });

  const { data: instruments } = useQuery({
    queryKey: ['instruments'],
    queryFn: api.getInstruments,
    staleTime: 1000 * 60 * 5,
  });

  const simMutation = useMutation({
    mutationFn: api.simulateTransaction,
    onSuccess: (data) => {
      setReceipt(data);
      toast.success('Payment Ingested', `Settled ${fmtINR(data.net_amount)} to ${data.merchant_id}.`);
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['reconcile-data'] });
    },
    onError: (err: Error) => {
      toast.error('Simulation Error', err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      toast.error('Invalid Amount', 'Payment amount must be greater than zero.');
      return;
    }
    simMutation.mutate({
      merchant_id: merchantId,
      amount,
      instrument,
      description,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            Real-Time Transaction Simulator
          </h1>
          <p className="text-xs text-gray-500">
            Inject live transactions to test real-time MDR calculation, GST tax, and ledger matching
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Simulator Form */}
        <div className="card-box p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Simulate Payment Event</h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="sim-merchant" className="block text-xs font-medium text-gray-700 mb-1">
                Target Merchant
              </label>
              <select
                id="sim-merchant"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-[4px] font-mono focus:outline-none focus:border-black"
              >
                {merchants?.map((m) => (
                  <option key={m.merchant_id} value={m.merchant_id}>
                    {m.business_name} ({m.merchant_id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sim-amount" className="block text-xs font-medium text-gray-700 mb-1">
                Payment Amount (INR)
              </label>
              <input
                type="number"
                id="sim-amount"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                step="0.01"
                min="1"
                required
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-[4px] font-mono focus:outline-none focus:border-black"
              />
            </div>

            <div>
              <label htmlFor="sim-instrument" className="block text-xs font-medium text-gray-700 mb-1">
                Payment Instrument
              </label>
              <select
                id="sim-instrument"
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-[4px] font-mono focus:outline-none focus:border-black"
              >
                {instruments?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sim-desc" className="block text-xs font-medium text-gray-700 mb-1">
                Order Description
              </label>
              <input
                type="text"
                id="sim-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-[4px] focus:outline-none focus:border-black"
              />
            </div>

            <button
              type="submit"
              disabled={simMutation.isPending}
              className="w-full py-2 rounded-[4px] bg-black text-white text-xs font-medium hover:bg-gray-800 transition disabled:opacity-50"
            >
              {simMutation.isPending ? 'Processing Settlement...' : 'Process Payment & Settle Ledger'}
            </button>
          </form>
        </div>

        {/* Simulation Receipt */}
        <div className="card-box p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-900">Settlement Verification Receipt</h2>
            <Badge status={receipt ? 'SETTLED' : 'PENDING'}>
              {receipt ? 'Ingested & Matched' : 'Awaiting Ingestion'}
            </Badge>
          </div>

          <div className="p-4 rounded-[4px] bg-gray-50 border border-gray-100 text-xs text-gray-600 font-mono space-y-2">
            {!receipt ? (
              <p>
                Submit a payment simulation to inspect the exact gateway fee deduction, GST breakdown, bank UTR, and automatic ledger matching.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 py-2 border-b border-gray-100">
                  <div>
                    <span className="text-gray-400">Transaction ID:</span>
                    <div className="font-mono font-semibold text-gray-900">{receipt.txn_id}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Bank UTR Reference:</span>
                    <div className="font-mono font-semibold text-gray-900">{receipt.utr}</div>
                  </div>
                </div>

                <div className="space-y-1.5 py-2">
                  <div className="flex justify-between">
                    <span>Gross Customer Payment:</span>
                    <span className="font-mono font-semibold text-gray-900">
                      {fmtINR(receipt.gross_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Base Gateway MDR Fee:</span>
                    <span className="font-mono">- {fmtINR(receipt.fee_deducted)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>GST on Processing Fee (18%):</span>
                    <span className="font-mono">- {fmtINR(receipt.gst_deducted)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 text-sm pt-2 border-t border-gray-100">
                    <span>Net Merchant Bank Settlement:</span>
                    <span className="font-mono text-emerald-600">{fmtINR(receipt.net_amount)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
