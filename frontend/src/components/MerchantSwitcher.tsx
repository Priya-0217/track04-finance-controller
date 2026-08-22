import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useTenantStore } from '../store/useTenantStore';
import { Building2, ChevronDown, Check, ShieldCheck, Clock } from 'lucide-react';

export const MerchantSwitcher: React.FC = () => {
  const { activeMerchantId, activeRole, setActiveMerchantId, setActiveRole } = useTenantStore();
  const [isOpen, setIsOpen] = useState(false);

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', activeRole, activeMerchantId],
    queryFn: () => api.getTenants(activeRole, activeMerchantId),
  });

  const currentTenant = tenants.find((t) => t.merchant_id === activeMerchantId) || {
    merchant_id: activeMerchantId,
    name: 'TechCorp India Pvt Ltd',
    kyc_status: 'verified',
    contract_tier: 'Enterprise Prime',
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-200 hover:border-gray-300 text-xs font-mono text-gray-800 transition"
      >
        <Building2 className="w-3.5 h-3.5 text-gray-500" />
        <div className="text-left">
          <div className="font-semibold text-gray-900 leading-tight truncate max-w-[140px]">
            {currentTenant.name}
          </div>
          <div className="text-[10px] text-gray-500 flex items-center space-x-1">
            <span>{currentTenant.merchant_id}</span>
            <span>•</span>
            <span className="text-emerald-600 font-medium">KYC ✓</span>
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-72 rounded-lg bg-white border border-gray-200 shadow-xl z-50 p-2 space-y-2">
            <div className="px-2 py-1 border-b border-gray-100 flex justify-between items-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 font-mono">
                Select Tenant Merchant
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-gray-100 rounded text-gray-600">
                Multi-Tenant Scoped
              </span>
            </div>

            <div className="space-y-1 max-h-56 overflow-y-auto">
              {tenants.map((t) => {
                const isSelected = t.merchant_id === activeMerchantId;
                return (
                  <button
                    key={t.merchant_id}
                    type="button"
                    onClick={() => {
                      setActiveMerchantId(t.merchant_id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-md transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-black text-white'
                        : 'hover:bg-gray-50 text-gray-800'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs leading-tight">{t.name}</div>
                      <div className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                        {t.merchant_id} • {t.contract_tier}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {t.kyc_status === 'verified' ? (
                        <span className="inline-flex items-center text-[10px] text-emerald-500 font-medium">
                          <ShieldCheck className="w-3 h-3 mr-0.5" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] text-amber-500 font-medium">
                          <Clock className="w-3 h-3 mr-0.5" />
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* RBAC Role Switcher */}
            <div className="pt-2 border-t border-gray-100">
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 font-mono mb-1.5 px-1">
                RBAC Security Role
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setActiveRole('finance_admin')}
                  className={`px-2 py-1 rounded text-center transition ${
                    activeRole === 'finance_admin'
                      ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold'
                      : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Finance Admin
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRole('merchant_viewer')}
                  className={`px-2 py-1 rounded text-center transition ${
                    activeRole === 'merchant_viewer'
                      ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold'
                      : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Merchant Viewer
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
