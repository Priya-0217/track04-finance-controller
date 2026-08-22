import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { fmtINR } from '../lib/format';

export const Audit: React.FC = () => {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');

  const { data: audit, isLoading } = useQuery({
    queryKey: ['audit-ai'],
    queryFn: api.getAuditReport,
  });

  const filteredFindings = useMemo(() => {
    if (!audit?.findings) return [];
    if (severityFilter === 'ALL') return audit.findings;
    return audit.findings.filter((f) => f.severity === severityFilter);
  }, [audit?.findings, severityFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            Contract Fee Compliance &amp; Anomaly Audit
          </h1>
          <p className="text-xs text-gray-500">
            Autonomous scan for contract fee overcharges, stranded settlements, and leakage
          </p>
        </div>
        <a
          href="/api/export/exceptions-csv"
          download
          className="px-3 py-1.5 rounded-[4px] bg-black text-white text-xs font-medium hover:bg-gray-800 transition inline-block"
        >
          Export Exceptions CSV
        </a>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Financial Health Score"
          value={audit ? `${audit.health_score} / 100` : '-- / 100'}
          subtitle={<span className="text-emerald-600 font-medium">Precision Audited</span>}
          isLoading={isLoading}
        />
        <StatCard
          title="Detected Fee Leakage"
          value={fmtINR(audit?.fee_leakage)}
          subtitle="Overcharges vs agreed contract"
          isLoading={isLoading}
        />
        <StatCard
          title="Unmatched Funds at Risk"
          value={fmtINR(audit?.funds_at_risk)}
          subtitle="Stranded in clearing rails"
          isLoading={isLoading}
        />
      </div>

      {/* Findings List & Severity Filter */}
      <div className="card-box p-5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Automated Audit Findings &amp; Directives</h2>
            <p className="text-xs text-gray-500">Categorized compliance events flagged by rule engines</p>
          </div>
          <div className="flex items-center space-x-1">
            {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2 py-1 text-[11px] font-mono rounded-[3px] transition ${
                  severityFilter === sev
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 text-xs">
          {isLoading ? (
            <div className="p-4 text-center text-gray-400 font-mono">Running audit scan...</div>
          ) : filteredFindings.length === 0 ? (
            <div className="p-4 text-center text-gray-600 font-medium font-mono">
              Zero anomalies detected in current batch.
            </div>
          ) : (
            filteredFindings.map((f, idx) => (
              <div
                key={`finding-${idx}`}
                className="p-3.5 rounded-[4px] border border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <Badge severity={f.severity} />
                    <span className="font-semibold text-xs text-gray-900">{f.category}</span>
                    <span className="text-xs text-gray-400 font-mono">
                      Impact: {fmtINR(f.impact_inr)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{f.description}</p>
                  <p className="text-[11px] text-gray-500 font-medium">Directive: {f.action}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
