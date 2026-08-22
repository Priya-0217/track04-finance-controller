import React from 'react';
import { Skeleton } from './Skeleton';

export type StatStatusDot = 'healthy' | 'pending' | 'risk' | 'info';
export type StatVariant = 'default' | 'risk' | 'warning' | 'success';

export interface StatCardProps {
  title: string;
  value?: React.ReactNode;
  subtitle?: React.ReactNode;
  isLoading?: boolean;
  statusDot?: StatStatusDot;
  statusTooltip?: string;
  variant?: StatVariant;
  className?: string;
  valueClassName?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  isLoading = false,
  statusDot,
  statusTooltip,
  variant = 'default',
  className = '',
  valueClassName = '',
}) => {
  const dotColor =
    statusDot === 'healthy'
      ? 'bg-emerald-500 ring-4 ring-emerald-50'
      : statusDot === 'pending'
      ? 'bg-amber-500 ring-4 ring-amber-50'
      : statusDot === 'risk'
      ? 'bg-rose-500 ring-4 ring-rose-50'
      : statusDot === 'info'
      ? 'bg-blue-500 ring-4 ring-blue-50'
      : null;

  const variantBorder =
    variant === 'risk'
      ? 'border-l-4 border-l-rose-500 bg-rose-50/30'
      : variant === 'warning'
      ? 'border-l-4 border-l-amber-500 bg-amber-50/30'
      : variant === 'success'
      ? 'border-l-4 border-l-emerald-500 bg-emerald-50/20'
      : '';

  return (
    <div className={`card-box p-4 space-y-1.5 transition-all duration-150 ${variantBorder} ${className}`}>
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block">
          {title}
        </span>
        {dotColor && (
          <div className="flex items-center space-x-1.5" title={statusTooltip}>
            <span className={`w-2 h-2 rounded-full ${dotColor}`} />
            {statusTooltip && (
              <span className="text-[10px] text-gray-400 font-mono hidden group-hover:inline">
                {statusTooltip}
              </span>
            )}
          </div>
        )}
      </div>

      <div className={`text-2xl font-bold text-gray-900 font-mono tracking-tight ${valueClassName}`}>
        {isLoading ? <Skeleton width="130px" height="28px" /> : value}
      </div>

      {subtitle && (
        <div className="text-[11px] text-gray-500 leading-tight">
          {isLoading ? <Skeleton width="160px" height="14px" /> : subtitle}
        </div>
      )}
    </div>
  );
};
