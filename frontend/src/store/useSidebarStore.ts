import { create } from 'zustand';

interface SidebarState {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  openMobile: () => void;
  closeMobile: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isCollapsed: localStorage.getItem('fc_sidebar_collapsed') === 'true',
  isMobileOpen: false,
  toggleCollapse: () =>
    set((state) => {
      const next = !state.isCollapsed;
      localStorage.setItem('fc_sidebar_collapsed', String(next));
      return { isCollapsed: next };
    }),
  setCollapsed: (collapsed: boolean) => {
    localStorage.setItem('fc_sidebar_collapsed', String(collapsed));
    set({ isCollapsed: collapsed });
  },
  openMobile: () => set({ isMobileOpen: true }),
  closeMobile: () => set({ isMobileOpen: false }),
}));
