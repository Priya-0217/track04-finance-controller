import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Modal } from '../components/Modal';
import { toast } from '../store/useToastStore';

export const CsvTools: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [ledgerFile, setLedgerFile] = useState<File | null>(null);
  const [settleFile, setSettleFile] = useState<File | null>(null);
  const [batchSize, setBatchSize] = useState<number>(100);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => api.uploadCsvs(formData),
    onSuccess: (data) => {
      toast.success(
        'CSVs Ingested',
        `Matched ${data.matched_count} records (${data.match_rate_pct}% auto-match).`
      );
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['reconcile-data'] });
      navigate('/reconcile');
    },
    onError: (err: Error) => {
      toast.error('Upload Rejected', err.message);
    },
  });

  // Generate Dataset Mutation
  const generateMutation = useMutation({
    mutationFn: (records: number) => api.generateDataset(records),
    onSuccess: (data) => {
      toast.success(
        'Dataset Ready',
        `Generated ${data.generated_records} records with ${data.match_rate_pct}% match rate.`
      );
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['reconcile-data'] });
      navigate('/');
    },
    onError: (err: Error) => {
      toast.error('Generation Error', err.message);
    },
  });

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ledgerFile || !settleFile) {
      toast.error('Missing Files', 'Please select both ledger.csv and settlement.csv files.');
      return;
    }
    // Open confirmation modal instead of blocking window.confirm()
    setIsConfirmModalOpen(true);
  };

  const confirmUpload = () => {
    if (!ledgerFile || !settleFile) return;
    setIsConfirmModalOpen(false);

    const formData = new FormData();
    formData.append('ledger_file', ledgerFile);
    formData.append('settlement_file', settleFile);
    uploadMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      {/* Confirmation Modal for Overwriting Data */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Ledger Replacement"
        subtitle="This action will replace the active reconciliation dataset"
        footer={
          <>
            <button
              onClick={() => setIsConfirmModalOpen(false)}
              className="px-3 py-1.5 rounded-[4px] bg-white border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={confirmUpload}
              className="px-3 py-1.5 rounded-[4px] bg-black text-white text-xs font-medium hover:bg-gray-800 transition"
            >
              Confirm &amp; Overwrite
            </button>
          </>
        }
      >
        <p className="text-xs text-gray-600 leading-relaxed">
          Uploading new CSV files will safely create a timestamped backup (.bak) of the current files and re-execute 4-tier matching across all imported records.
        </p>
      </Modal>

      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            CSV Ingestion &amp; Dataset Simulation
          </h1>
          <p className="text-xs text-gray-500">
            Upload enterprise CSV files or generate fresh synthetic datasets
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Custom CSVs */}
        <div className="card-box p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Upload Enterprise Files</h2>
            <p className="text-xs text-gray-500">
              Ingest ledger.csv and settlement.csv with automated schema validation
            </p>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-3">
            <div>
              <label htmlFor="upload-ledger-file" className="block text-xs font-medium text-gray-700 mb-1">
                Ledger CSV (Transactions)
              </label>
              <input
                type="file"
                id="upload-ledger-file"
                accept=".csv"
                onChange={(e) => setLedgerFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-[4px] file:border file:border-gray-200 file:text-xs file:font-medium file:bg-white hover:file:bg-gray-50 file:cursor-pointer"
              />
            </div>

            <div>
              <label htmlFor="upload-settle-file" className="block text-xs font-medium text-gray-700 mb-1">
                Settlement CSV (Bank Payouts)
              </label>
              <input
                type="file"
                id="upload-settle-file"
                accept=".csv"
                onChange={(e) => setSettleFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-[4px] file:border file:border-gray-200 file:text-xs file:font-medium file:bg-white hover:file:bg-gray-50 file:cursor-pointer"
              />
            </div>

            <div className="p-2.5 rounded-[4px] bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
              <strong>Note:</strong> Ingesting new files creates an automatic backup (.bak) and triggers full 4-tier pipeline re-matching.
            </div>

            <button
              type="submit"
              disabled={uploadMutation.isPending}
              className="w-full py-2 rounded-[4px] bg-black text-white text-xs font-medium hover:bg-gray-800 transition disabled:opacity-50"
            >
              {uploadMutation.isPending ? 'Ingesting & Validating...' : 'Ingest & Reconcile Uploaded CSVs'}
            </button>
          </form>
        </div>

        {/* Synthetic Dataset Generator */}
        <div className="card-box p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Synthetic Batch Generator</h2>
            <p className="text-xs text-gray-500">
              Benchmark the 4-tier engine against synthetic transaction distributions
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="gen-batch-size" className="block text-xs font-medium text-gray-700 mb-1">
                Batch Size
              </label>
              <select
                id="gen-batch-size"
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-[4px] font-mono"
              >
                <option value={50}>50 Records (Fast Demo)</option>
                <option value={100}>100 Records (Standard Audit)</option>
                <option value={250}>250 Records (Multi-Merchant)</option>
                <option value={500}>500 Records (Stress Test)</option>
              </select>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Generates realistic payments across UPI, cards, and netbanking, with exact matches, fuzzy date offsets, and deliberate decimal exceptions to test the anomaly detection pipeline.
            </p>

            <button
              type="button"
              onClick={() => generateMutation.mutate(batchSize)}
              disabled={generateMutation.isPending}
              className="w-full py-2 rounded-[4px] bg-white border border-gray-200 text-gray-900 text-xs font-medium hover:bg-gray-50 transition disabled:opacity-50"
            >
              {generateMutation.isPending ? 'Generating Dataset...' : 'Generate Fresh Dataset & Re-Run'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
