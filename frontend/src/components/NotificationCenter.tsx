import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useTenantStore } from '../store/useTenantStore';
import { toast } from '../store/useToastStore';
import {
  Bell,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  ArrowRight,
  Check,
} from 'lucide-react';
import type { FinancialAlert } from '../types/api';

export const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeMerchantId } = useTenantStore();
  const [isOpen, setIsOpen] = useState(false);

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts', activeMerchantId],
    queryFn: () => api.getAlerts(activeMerchantId),
    refetchInterval: 15000,
  });

  const activeAlerts = alerts.filter((a) => a.status === 'active');

  const ackMutation = useMutation({
    mutationFn: (alertId: string) => api.acknowledgeAlert(alertId, activeMerchantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', activeMerchantId] });
      toast.info('Alert Acknowledged', 'Alert has been marked as reviewed.');
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (alertId: string) => api.dismissAlert(alertId, activeMerchantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', activeMerchantId] });
      toast.success('Alert Dismissed', 'Alert removed from active notifications.');
    },
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="flex items-center space-x-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
            <ShieldAlert className="w-3 h-3" />
            <span>CRITICAL</span>
          </span>
        );
      case 'warning':
        return (
          <span className="flex items-center space-x-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
            <AlertTriangle className="w-3 h-3" />
            <span>WARNING</span>
          </span>
        );
      case 'success':
        return (
          <span className="flex items-center space-x-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3" />
            <span>RESOLVED</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
            <Info className="w-3 h-3" />
            <span>INFO</span>
          </span>
        );
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-md hover:bg-gray-100 text-gray-700 transition"
        title="Real-Time Alerts & Notification Center"
      >
        <Bell className="w-4 h-4" />
        {activeAlerts.length > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold font-mono text-white ring-2 ring-white animate-pulse">
            {activeAlerts.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-96 rounded-xl bg-white border border-gray-200 shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh]">
            {/* Notification Drawer Header */}
            <div className="p-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-gray-900 uppercase font-mono tracking-wider">
                  Real-Time Notification Center
                </h3>
                <p className="text-[10px] text-gray-500 font-mono">
                  Live anomaly triggers for {activeMerchantId}
                </p>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-700">
                {activeAlerts.length} Active
              </span>
            </div>

            {/* Notification Items List */}
            <div className="p-2 overflow-y-auto space-y-2 flex-1">
              {alerts.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 font-mono">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                  All financial rails verified. Zero active alerts.
                </div>
              ) : (
                alerts.map((alert: FinancialAlert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border text-xs transition space-y-2 ${
                      alert.severity === 'critical'
                        ? 'bg-rose-50/60 border-rose-200/80 text-rose-950'
                        : alert.severity === 'warning'
                        ? 'bg-amber-50/60 border-amber-200/80 text-amber-950'
                        : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-1.5">
                        {getSeverityBadge(alert.severity)}
                        <span className="font-semibold text-xs leading-tight">
                          {alert.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissMutation.mutate(alert.id)}
                        className="text-gray-400 hover:text-black p-0.5"
                        title="Dismiss Alert"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    <p className="text-[11px] leading-relaxed opacity-90">{alert.message}</p>

                    {alert.impact_amount_inr > 0 && (
                      <div className="text-[10px] font-mono font-semibold">
                        Financial Impact: ₹{alert.impact_amount_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-current/10">
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          navigate(alert.action_target);
                        }}
                        className="flex items-center space-x-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        <span>{alert.suggested_action}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>

                      {alert.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => ackMutation.mutate(alert.id)}
                          className="flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white/80 border border-gray-300 hover:bg-white text-gray-700"
                        >
                          <Check className="w-2.5 h-2.5" />
                          <span>Acknowledge</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
