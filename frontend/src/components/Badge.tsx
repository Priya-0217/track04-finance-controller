import React from 'react';
import type { MatchTier, RiskLevel } from '../types/api';

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'tier' | 'health' | 'severity' | 'status' | 'neutral';
  tier?: MatchTier;
  severity?: 'CRITICAL' | 'WARNING' | 'INFO';
  risk?: RiskLevel;
  healthScore?: number;
  status?: string;
  className?: string;
}

export function getHealthVariant(score: number): { bg: string; text: string; border: string } {
  if (score >= 90) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' };
  }
  if (score >= 70) {
    return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
  }
  return { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' };
}

export function getSeverityClasses(sev?: 'CRITICAL' | 'WARNING' | 'INFO'): string {
  switch (sev) {
    case 'CRITICAL':
      return 'bg-black text-white';
    case 'WARNING':
      return 'bg-amber-50 text-amber-800 border border-amber-200';
    case 'INFO':
      return 'bg-gray-100 text-gray-800 border border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getTierLabel(tier?: MatchTier | string): string {
  if (!tier) return 'Unknown';
  const t = String(tier).toLowerCase();
  if (t.includes('tier1') || t.includes('exact')) return 'T1 Exact (1.00)';
  if (t.includes('tier2') || t.includes('fuzzy') || t.includes('tolerance')) return 'T2 Fuzzy (0.95)';
  if (t.includes('tier3') || t.includes('semantic')) return 'T3 Semantic (0.80+)';
  if (t.includes('tier4') || t.includes('exception')) return 'T4 Exception';
  return String(tier);
}

export function getTierClasses(tier?: MatchTier | string): string {
  if (!tier) return 'bg-gray-100 text-gray-800';
  const t = String(tier).toLowerCase();
  if (t.includes('tier1') || t.includes('exact')) {
    return 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold';
  }
  if (t.includes('tier2') || t.includes('fuzzy') || t.includes('tolerance')) {
    return 'bg-blue-50 text-blue-800 border border-blue-200 font-semibold';
  }
  if (t.includes('tier3') || t.includes('semantic')) {
    return 'bg-purple-50 text-purple-800 border border-purple-200 font-semibold';
  }
  return 'bg-rose-50 text-rose-800 border border-rose-200 font-semibold';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  tier,
  severity,
  healthScore,
  status,
  className = '',
}) => {
  if (variant === 'tier' || tier) {
    const tierClass = getTierClasses(tier);
    return (
      <span className={`px-2 py-0.5 rounded-[3px] text-[10px] font-mono ${tierClass} ${className}`}>
        {children || getTierLabel(tier)}
      </span>
    );
  }

  if (variant === 'severity' || severity) {
    const sevClass = getSeverityClasses(severity);
    return (
      <span className={`px-1.5 py-0.5 rounded-[3px] text-[9px] font-mono font-semibold ${sevClass} ${className}`}>
        {children || severity}
      </span>
    );
  }

  if (variant === 'health' && healthScore !== undefined) {
    const { bg, text, border } = getHealthVariant(healthScore);
    return (
      <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-[4px] ${bg} border ${border} text-[11px] font-mono ${text} ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
        <span className="text-gray-500">Health:</span>
        <span className="font-bold">{healthScore} / 100</span>
      </div>
    );
  }

  if (variant === 'status' || status) {
    const isSuccess = status === 'RESOLVED' || status === 'SETTLED' || status === 'WON' || status === 'VERIFIED';
    const isWarning = status === 'UNDER_REVIEW' || status === 'PENDING';
    const isCritical = status === 'HOLIDAY' || status === 'LOST';

    const bgText = isSuccess
      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
      : isWarning
      ? 'bg-amber-50 text-amber-800 border border-amber-200'
      : isCritical
      ? 'bg-rose-50 text-rose-700 border border-red-200'
      : 'bg-gray-100 text-gray-800';

    return (
      <span className={`px-1.5 py-0.5 rounded-[3px] text-[10px] font-mono font-medium ${bgText} ${className}`}>
        {children || status}
      </span>
    );
  }

  return (
    <span className={`px-1.5 py-0.5 rounded-[3px] text-[10px] font-mono font-medium bg-gray-100 text-gray-800 ${className}`}>
      {children}
    </span>
  );
};
