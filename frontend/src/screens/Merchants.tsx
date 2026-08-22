import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { Skeleton } from '../components/Skeleton';

export const Merchants: React.FC = () => {
  const { data: merchants, isLoading } = useQuery({
    queryKey: ['merchants'],
    queryFn: api.getMerchants,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            Merchant Directory &amp; Pricing Contracts
          </h1>
          <p className="text-xs text-gray-500">
            Configured merchant profiles, custom MDR fee tiers, and settlement frequencies
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 3 }).map((_, idx) => (
              <div key={`skel-merch-${idx}`} className="card-box p-4 space-y-2.5">
                <Skeleton height="20px" width="60%" />
                <Skeleton height="14px" width="40%" />
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <Skeleton height="12px" width="80%" />
                  <Skeleton height="12px" width="70%" />
                </div>
              </div>
            ))
          : merchants?.map((m) => (
              <div key={m.merchant_id} className="card-box p-4 space-y-2.5">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900 text-xs">{m.business_name}</h4>
                    <span className="font-mono text-[11px] text-gray-400">{m.merchant_id}</span>
                  </div>
                  <Badge status="VERIFIED">VERIFIED</Badge>
                </div>
                <div className="text-xs space-y-1 pt-2 border-t border-gray-100 text-gray-600">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Contract Tier:</span>
                    <span className="font-medium text-gray-900">{m.fee_tier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Settlement Cycle:</span>
                    <span className="font-mono font-medium text-gray-900">{m.settlement_cycle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Risk Profile:</span>
                    <span className="font-medium text-gray-900 uppercase">{m.risk_rating}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Billing Contact:</span>
                    <span className="text-gray-500 font-mono text-[11px]">{m.contact_email}</span>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
};
