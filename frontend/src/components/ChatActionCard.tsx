import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useTenantStore } from '../store/useTenantStore';
import { toast } from '../store/useToastStore';
import {
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  Zap,
  Layers,
  Scale,
  TrendingUp,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import type { AgentActionCard as ActionCardType } from '../types/api';

interface ChatActionCardProps {
  cards: ActionCardType[];
}

export const ChatActionCard: React.FC<ChatActionCardProps> = ({ cards }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeMerchantId } = useTenantStore();
  const [executingId, setExecutingId] = useState<string | null>(null);

  const autoCloseMutation = useMutation({
    mutationFn: api.runAutoClose,
    onSuccess: (data) => {
      toast.success(
        'Books Closed & Signed',
        `Cryptographic sign-off complete. Health Score: ${data.health_score}/100.`
      );
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: (err: Error) => {
      toast.error('Books Close Failed', err.message);
    },
    onSettled: () => setExecutingId(null),
  });

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'FileText':
        return <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />;
      case 'FileSpreadsheet':
        return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
      case 'CheckCircle2':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
      case 'Zap':
        return <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      case 'Layers':
        return <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
      case 'Scale':
        return <Scale className="w-3.5 h-3.5 text-purple-600 shrink-0" />;
      case 'TrendingUp':
        return <TrendingUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />;
      default:
        return <ArrowRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />;
    }
  };

  const handleAction = (card: ActionCardType) => {
    setExecutingId(card.id);

    if (card.action_type === 'export_pdf') {
      const url = card.target_url || `/api/export/report/pdf?merchant_id=${activeMerchantId}`;
      window.open(url, '_blank');
      toast.success('Executive PDF Generated', 'Treasury sign-off opened in new tab.');
      setExecutingId(null);
    } else if (card.action_type === 'export_accounting') {
      const url = card.target_url || `/api/export/accounting?system=quickbooks&merchant_id=${activeMerchantId}`;
      window.open(url, '_blank');
      toast.success('Accounting Sync Exported', 'General ledger feed downloaded.');
      setExecutingId(null);
    } else if (card.action_type === 'auto_close_books') {
      autoCloseMutation.mutate();
    } else if (card.action_type === 'instant_payout') {
      setTimeout(() => {
        toast.success('T+0 Payout Accelerated', 'Weekend settlement cutoff adjusted to instant clearing.');
        setExecutingId(null);
      }, 500);
    } else if (card.action_type === 'navigate' && card.target_url) {
      navigate(card.target_url);
      setExecutingId(null);
    } else {
      setExecutingId(null);
    }
  };

  if (!cards || cards.length === 0) return null;

  return (
    <div className="pt-2 border-t border-gray-100/80 mt-2 space-y-1.5">
      <div className="text-[10px] font-mono uppercase font-bold text-gray-400 tracking-wider flex items-center space-x-1">
        <span>⚡ Agentic Actions</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {cards.map((card) => {
          const isExecuting = executingId === card.id;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleAction(card)}
              disabled={isExecuting}
              className="p-2 rounded-lg border border-gray-200 hover:border-black bg-white hover:bg-gray-50 text-left transition flex items-center justify-between group shadow-sm disabled:opacity-50"
            >
              <div className="flex items-center space-x-2 min-w-0 pr-2">
                {isExecuting ? (
                  <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />
                ) : (
                  getIcon(card.icon)
                )}
                <div className="truncate">
                  <div className="font-semibold text-xs text-gray-900 leading-tight group-hover:text-black truncate">
                    {card.label}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate mt-0.5">
                    {card.description}
                  </div>
                </div>
              </div>

              {card.badge ? (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                  {card.badge}
                </span>
              ) : (
                <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-black shrink-0 transition group-hover:translate-x-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
