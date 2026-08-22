import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, PanelLeft, Download } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { ToastProvider } from './ToastProvider';
import { useSidebarStore } from '../store/useSidebarStore';
import { MerchantSwitcher } from './MerchantSwitcher';
import { NotificationCenter } from './NotificationCenter';
import { ExportReportModal } from './ExportReportModal';

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Overview & Treasury', subtitle: 'Live multi-tier settlement verification across payment rails' },
  '/forecast': { title: 'Forward Cash Forecaster', subtitle: '7 to 30-day liquidity projections with RBI holiday clearing rollovers' },
  '/chat': { title: 'AI Copilot Assistant', subtitle: 'Full-pipeline context awareness, live tool execution & real-time streaming' },
  '/reconcile': { title: '4-Tier Reconciled Matches', subtitle: 'Deterministic exact, fuzzy tolerance & semantic vector matching' },
  '/trends': { title: 'Batch Trends & Historical Variance', subtitle: 'Period-over-period comparison, fee drag drift & match velocity' },
  '/csv-tools': { title: 'CSV Ingestion & Dataset Tools', subtitle: 'Enterprise ledger importing and synthetic anomaly generation' },
  '/audit': { title: 'Contract Fee Compliance Audit', subtitle: 'Automated scan for contract fee overcharges and stranded settlements' },
  '/merchants': { title: 'Merchant Directory', subtitle: 'Configured merchant profiles, custom MDR tiers & settlement cycles' },
  '/simulator': { title: 'Real-Time Txn Simulator', subtitle: 'Inject live transactions to test real-time MDR calculation & GST tax' },
  '/disputes': { title: 'Disputes & Holdback Reserves', subtitle: 'Track chargebacks, release reserve holdbacks & balance ledgers' },
  '/settings': { title: 'LLM & Provider Settings', subtitle: 'Multi-model routing, token budgets, and local inference config' },
};

export const Layout: React.FC = () => {
  const { isCollapsed, toggleCollapse, openMobile } = useSidebarStore();
  const location = useLocation();
  const [isExportOpen, setIsExportOpen] = useState(false);

  const currentRouteInfo = ROUTE_TITLES[location.pathname] || {
    title: 'Finance Operations OS',
    subtitle: 'Automated 4-Tier Financial Reconciliation & Treasury Forecaster',
  };

  const isChatRoute = location.pathname === '/chat';

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#111827] flex">
      <ToastProvider />

      {/* Export Report & Accounting Modal */}
      <ExportReportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />

      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ease-in-out ${
          isCollapsed ? 'lg:pl-0' : 'lg:pl-64'
        }`}
      >
        {/* Top Bar Header */}
        <header className="h-14 bg-white border-b border-gray-200 sticky top-0 z-30 px-3 sm:px-6 flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Desktop Sidebar Toggle when collapsed */}
            {isCollapsed && (
              <button
                onClick={toggleCollapse}
                className="hidden lg:flex p-1.5 rounded-[4px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
                title="Unhide Sidebar"
                aria-label="Unhide Sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}

            {/* Mobile Sidebar Hamburger */}
            <button
              onClick={openMobile}
              className="lg:hidden p-1.5 rounded-[4px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Merchant Switcher (Multi-Tenant) */}
            <MerchantSwitcher />

            {/* Breadcrumb / Page Title */}
            <div className="hidden md:block pl-2 border-l border-gray-200">
              <div className="font-semibold text-xs text-gray-900 flex items-center space-x-2">
                <span>{currentRouteInfo.title}</span>
              </div>
              <p className="text-[10px] text-gray-400 font-mono hidden lg:block">
                {currentRouteInfo.subtitle}
              </p>
            </div>
          </div>

          {/* Top Bar Right: Export, Alerts, & Status */}
          <div className="flex items-center space-x-2">
            {/* Export Reports Trigger */}
            <button
              type="button"
              onClick={() => setIsExportOpen(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-white border border-gray-200 hover:border-black text-xs font-mono font-medium text-gray-800 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-gray-600" />
              <span className="hidden sm:inline">Export Reports</span>
            </button>

            {/* Real-Time Notification Bell */}
            <NotificationCenter />
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className={`flex-1 ${isChatRoute ? 'flex flex-col min-h-0' : 'p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
