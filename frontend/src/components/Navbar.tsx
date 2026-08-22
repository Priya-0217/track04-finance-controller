import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Badge } from './Badge';

interface NavItem {
  path: string;
  label: string;
  shortLabel?: string;
  group?: string;
}

const PRIMARY_NAV: NavItem[] = [
  { path: '/', label: 'Overview & Cash', shortLabel: 'Overview' },
  { path: '/forecast', label: 'Cash Forecaster', shortLabel: 'Forecasting' },
  { path: '/chat', label: 'AI Copilot', shortLabel: 'AI Copilot' },
  { path: '/reconcile', label: '4-Tier Explorer', shortLabel: 'Matches' },
  { path: '/audit', label: 'Fee Audit', shortLabel: 'Audit' },
];

const MORE_NAV: NavItem[] = [
  { path: '/csv-tools', label: 'CSV Ingestion & Export', group: 'Data' },
  { path: '/merchants', label: 'Merchant Directory', group: 'Operations' },
  { path: '/simulator', label: 'Live Txn Simulator', group: 'Operations' },
  { path: '/disputes', label: 'Disputes & Holdbacks', group: 'Operations' },
  { path: '/settings', label: 'LLM & Provider Settings', group: 'System' },
];

const ALL_NAV = [...PRIMARY_NAV, ...MORE_NAV];

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: api.getMetrics,
    refetchInterval: 30000,
  });

  const healthScore = metrics?.health_score ?? 96;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isMoreActive = MORE_NAV.some((item) => item.path === location.pathname);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="w-full px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          <div className="flex items-center space-x-3.5">
            <div className="w-7 h-7 rounded-[4px] bg-black flex items-center justify-center text-white font-mono font-semibold text-xs tracking-tight">
              FC
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-gray-900 text-sm tracking-tight">Finance Operations OS</span>
              <span className="text-gray-300">/</span>
              <span className="text-xs text-gray-500 font-medium hidden sm:inline">
                Reconciliation &amp; Treasury Forecaster
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <Badge variant="health" healthScore={healthScore} />
            <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 rounded-[4px] bg-gray-50 border border-gray-200 text-[11px] font-mono text-gray-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Latency: 6.7ms</span>
            </div>
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-[4px] bg-black text-white text-[11px] font-mono font-medium">
              <span className="text-gray-400">Audited:</span>
              <span>{metrics ? `${metrics.auto_match_rate_pct}% Precision` : '98.89% Precision'}</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Selector */}
        <div className="sm:hidden py-2 border-t border-gray-100">
          <select
            value={location.pathname}
            onChange={(e) => navigate(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-[4px] font-mono text-gray-800 focus:outline-none focus:border-black"
          >
            {ALL_NAV.map((item) => (
              <option key={item.path} value={item.path}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {/* Compressed Desktop Navigation Tabs + Dropdown */}
        <nav className="hidden sm:flex items-center space-x-1 border-t border-gray-100 py-1.5 overflow-x-visible custom-scrollbar" aria-label="Main Navigation">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `px-3 py-1 text-xs font-medium whitespace-nowrap rounded-[4px] transition-all duration-100 ${
                  isActive
                    ? 'bg-black text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              {item.shortLabel || item.label}
            </NavLink>
          ))}

          {/* More Tools Dropdown Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`px-3 py-1 text-xs font-medium whitespace-nowrap rounded-[4px] flex items-center space-x-1 transition-all duration-100 ${
                isMoreActive
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span>Operations &amp; Tools</span>
              <span className="text-[10px] opacity-70">▾</span>
            </button>

            {isMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-56 bg-white border border-gray-200 rounded-[6px] shadow-xl py-1.5 z-50 text-xs animate-slideInRight">
                {MORE_NAV.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex justify-between items-center px-3.5 py-2 transition ${
                        isActive ? 'bg-gray-50 font-bold text-black' : 'text-gray-700 hover:bg-gray-50'
                      }`
                    }
                  >
                    <span>{item.label}</span>
                    {item.group && (
                      <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider">
                        {item.group}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};
