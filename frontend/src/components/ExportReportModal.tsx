import React from 'react';
import { useTenantStore } from '../store/useTenantStore';
import { Modal } from './Modal';
import {
  FileText,
  FileSpreadsheet,
  Download,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({ isOpen, onClose }) => {
  const { activeMerchantId } = useTenantStore();

  const handleDownloadAccounting = (system: string) => {
    window.open(`/api/export/accounting?system=${system}&merchant_id=${activeMerchantId}`, '_blank');
  };

  const handleOpenPdfReport = () => {
    window.open(`/api/export/report/pdf?merchant_id=${activeMerchantId}`, '_blank');
  };

  const handleDownloadCsv = () => {
    window.open(`/api/export-csv?type=reconciled`, '_blank');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Reconciled Reports & Accounting Feeds">
      <div className="space-y-4 text-xs text-gray-700">
        <p className="text-gray-500">
          Download executive audit sign-offs or sync transaction ledgers directly with your ERP and accounting software for <strong className="text-gray-900">{activeMerchantId}</strong>.
        </p>

        {/* Executive Reports */}
        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-gray-400">
            1. Executive &amp; Treasury Sign-Off Reports
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleOpenPdfReport}
              className="p-3 rounded-lg border border-gray-200 hover:border-black bg-gray-50 hover:bg-white text-left transition flex items-start space-x-3 group"
            >
              <FileText className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-gray-900 flex items-center space-x-1">
                  <span>Executive PDF Report</span>
                  <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-black" />
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Printable treasury sign-off document with SOX compliance &amp; 4-tier match tables.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="p-3 rounded-lg border border-gray-200 hover:border-black bg-gray-50 hover:bg-white text-left transition flex items-start space-x-3 group"
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-gray-900 flex items-center space-x-1">
                  <span>Reconciled Ledger CSV</span>
                  <Download className="w-3 h-3 text-gray-400 group-hover:text-black" />
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Full dataset of verified matched pairs and confidence scores.
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Direct Accounting System Sync */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-gray-400 flex items-center justify-between">
            <span>2. Direct Accounting Integrations (QuickBooks / Xero / Zoho)</span>
            <span className="text-emerald-600 flex items-center">
              <ShieldCheck className="w-3 h-3 mr-0.5" /> Format Verified
            </span>
          </div>

          <div className="space-y-2">
            <div className="p-2.5 rounded-lg border border-gray-200 bg-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center font-bold text-emerald-700 text-xs">
                  QB
                </div>
                <div>
                  <div className="font-semibold text-xs text-gray-900">QuickBooks Journal Entries</div>
                  <div className="text-[10px] text-gray-500">General Ledger (Debit Bank &amp; MDR / Credit Revenue)</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadAccounting('quickbooks')}
                className="px-2.5 py-1 rounded bg-gray-100 hover:bg-black hover:text-white text-gray-800 text-xs font-mono font-medium transition"
              >
                Download CSV
              </button>
            </div>

            <div className="p-2.5 rounded-lg border border-gray-200 bg-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded bg-sky-50 border border-sky-200 flex items-center justify-center font-bold text-sky-700 text-xs">
                  XR
                </div>
                <div>
                  <div className="font-semibold text-xs text-gray-900">Xero Bank Statement Feeds</div>
                  <div className="text-[10px] text-gray-500">Bank reconciliation format with 200-REV account mapping</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadAccounting('xero')}
                className="px-2.5 py-1 rounded bg-gray-100 hover:bg-black hover:text-white text-gray-800 text-xs font-mono font-medium transition"
              >
                Download CSV
              </button>
            </div>

            <div className="p-2.5 rounded-lg border border-gray-200 bg-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded bg-amber-50 border border-amber-200 flex items-center justify-center font-bold text-amber-700 text-xs">
                  ZH
                </div>
                <div>
                  <div className="font-semibold text-xs text-gray-900">Zoho Books Banking Feed</div>
                  <div className="text-[10px] text-gray-500">Formatted with 18% GST input tax credit schedules</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadAccounting('zoho')}
                className="px-2.5 py-1 rounded bg-gray-100 hover:bg-black hover:text-white text-gray-800 text-xs font-mono font-medium transition"
              >
                Download CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
