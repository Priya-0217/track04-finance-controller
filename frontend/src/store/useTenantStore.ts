import { create } from 'zustand';

interface TenantState {
  activeMerchantId: string;
  activeRole: string;
  setActiveMerchantId: (id: string) => void;
  setActiveRole: (role: string) => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  activeMerchantId: localStorage.getItem('fc_active_merchant') || 'merch_001',
  activeRole: localStorage.getItem('fc_active_role') || 'finance_admin',
  setActiveMerchantId: (id: string) => {
    localStorage.setItem('fc_active_merchant', id);
    set({ activeMerchantId: id });
  },
  setActiveRole: (role: string) => {
    localStorage.setItem('fc_active_role', role);
    set({ activeRole: role });
  },
}));
