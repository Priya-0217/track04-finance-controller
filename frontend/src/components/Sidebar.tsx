import React from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  TrendingUp,
  Bot,
  Layers,
  FileSpreadsheet,
  ShieldCheck,
  Building2,
  PlayCircle,
  Scale,
  Settings,
  Activity,
  PanelLeftClose,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from './Badge';
import { useSidebarStore } from '../store/useSidebarStore';

interface NavSection {
  title: string;
  items: {
    path: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'TREASURY & CASH',
    items: [
      { path: '/', label: 'Overview & Cash', icon: LayoutDashboard },
      { path: '/forecast', label: 'Cash Forecaster', icon: TrendingUp, badge: '7–30d' },
    ],
  },
  {
    title: 'AI INTELLIGENCE',
    items: [
      { path: '/chat', label: 'AI Copilot', icon: Bot, badge: '11 Tools' },
      { path: '/audit', label: 'Contract Fee Audit', icon: ShieldCheck },
    ],
  },
  {
    title: 'RECONCILIATION',
    items: [
      { path: '/reconcile', label: '4-Tier Matches', icon: Layers },
      { path: '/trends', label: 'Batch Trends', icon: TrendingUp, badge: 'DoD/WoW' },
      { path: '/csv-tools', label: 'CSV Ingestion', icon: FileSpreadsheet },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { path: '/merchants', label: 'Merchant Accounts', icon: Building2 },
      { path: '/disputes', label: 'Disputes & Holdbacks', icon: Scale },
      { path: '/simulator', label: 'Txn Simulator', icon: PlayCircle },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { path: '/settings', label: 'Settings & LLM', icon: Settings },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const { isCollapsed, isMobileOpen, closeMobile, toggleCollapse } = useSidebarStore();

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: api.getMetrics,
    refetchInterval: 30000,
  });

  const healthScore = metrics?.health_score ?? 96;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={closeMobile}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-all duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-14 px-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-[4px] bg-black flex items-center justify-center text-white font-mono font-bold text-xs tracking-tight shadow-sm">
              FC
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-xs tracking-tight flex items-center space-x-1.5">
                <span>Finance Controller</span>
                <span className="text-[9px] px-1 py-0.2 bg-gray-100 text-gray-600 rounded font-mono">OS</span>
              </div>
              <p className="text-[10px] text-gray-400 font-mono">Track 04 · Razorpay</p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {/* Desktop Collapse Toggle */}
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex p-1.5 rounded-[4px] text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition"
              title="Hide Sidebar"
              aria-label="Hide Sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={closeMobile}
              className="lg:hidden p-1.5 rounded-[4px] text-gray-400 hover:text-gray-900 hover:bg-gray-100"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-2.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-gray-400">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={closeMobile}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-2.5 py-1.5 rounded-[5px] text-xs font-medium transition-all duration-100 ${
                          isActive
                            ? 'bg-black text-white shadow-sm font-semibold'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="flex items-center space-x-2.5">
                            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                            <span>{item.label}</span>
                          </div>
                          {item.badge && (
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                                isActive ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Live Telemetry & Health Footer */}
        <div className="p-3.5 border-t border-gray-100 bg-gray-50/70 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-500 font-mono flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              <span>System Status</span>
            </span>
            <span className="text-[10px] font-mono text-gray-400">6.7ms</span>
          </div>

          <Badge variant="health" healthScore={healthScore} className="w-full justify-between py-1" />

          <div className="flex items-center justify-between text-[11px] font-mono text-gray-500 pt-1 border-t border-gray-200/60">
            <span>Precision Rate:</span>
            <strong className="text-gray-900">{metrics ? `${metrics.auto_match_rate_pct}%` : '98.89%'}</strong>
          </div>
        </div>
      </aside>
    </>
  );
};
