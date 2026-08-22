import type {
  AuditReport,
  AutoCloseRes,
  ConfigData,
  Dispute,
  FinancialAlert,
  ForecastData,
  Merchant,
  MetricsData,
  PaymentInstrumentInfo,
  ReconciliationReport,
  SimulateTxnReq,
  SimulateTxnRes,
  SmartRecommendation,
  TenantMetadata,
  TestLlmReq,
  TestLlmRes,
  TrendComparison,
  UpdateConfigReq,
} from '../types/api';

const BASE_URL = '';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMsg = `Request failed (${res.status} ${res.statusText})`;
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // Use fallback error message
    }
    throw new Error(errMsg);
  }
  return res.json();
}

export const api = {
  // Metrics & Health
  getMetrics: (): Promise<MetricsData> =>
    fetch(`${BASE_URL}/api/metrics`).then(handleResponse<MetricsData>),

  // Forward Cash Forecaster
  getForecast: (days = 7, merchantId?: string | null): Promise<ForecastData> => {
    const params = new URLSearchParams({ days: days.toString() });
    if (merchantId) params.set('merchant_id', merchantId);
    return fetch(`${BASE_URL}/api/forecast?${params.toString()}`).then(handleResponse<ForecastData>);
  },

  // Payment Instruments & Fee Schedules
  getInstruments: (): Promise<PaymentInstrumentInfo[]> =>
    fetch(`${BASE_URL}/api/instruments`).then(handleResponse<PaymentInstrumentInfo[]>),

  // Configuration
  getConfig: (): Promise<ConfigData> =>
    fetch(`${BASE_URL}/api/config`).then(handleResponse<ConfigData>),

  updateConfig: (payload: UpdateConfigReq): Promise<{ status: string; config: ConfigData }> =>
    fetch(`${BASE_URL}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(handleResponse<{ status: string; config: ConfigData }>),

  testLlmConfig: (payload: TestLlmReq): Promise<TestLlmRes> =>
    fetch(`${BASE_URL}/api/config/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(handleResponse<TestLlmRes>),

  // 4-Tier Reconciliation Report
  getReconcileData: (): Promise<ReconciliationReport> =>
    fetch(`${BASE_URL}/api/reconcile-data`).then(handleResponse<ReconciliationReport>),

  // Automated Contract Fee Audit
  getAuditReport: (): Promise<AuditReport> =>
    fetch(`${BASE_URL}/api/audit-ai`).then(handleResponse<AuditReport>),

  // CSV Ingestion & Synthetic Generation
  uploadCsvs: (formData: FormData): Promise<{
    status: string;
    total_ledger: number;
    total_settlement: number;
    match_rate_pct: number;
    matched_count: number;
    exception_count: number;
  }> =>
    fetch(`${BASE_URL}/api/upload-csvs`, {
      method: 'POST',
      body: formData,
    }).then(handleResponse<{
      status: string;
      total_ledger: number;
      total_settlement: number;
      match_rate_pct: number;
      matched_count: number;
      exception_count: number;
    }>),

  generateDataset: (records: number): Promise<{ status: string; generated_records: number; match_rate_pct: number }> =>
    fetch(`${BASE_URL}/api/generate-dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    }).then(handleResponse<{ status: string; generated_records: number; match_rate_pct: number }>),

  // Autonomous Daily Books Closure
  runAutoClose: (): Promise<AutoCloseRes> =>
    fetch(`${BASE_URL}/api/auto-close-loop`, {
      method: 'POST',
    }).then(handleResponse<AutoCloseRes>),

  // Merchant Directory
  getMerchants: (): Promise<Merchant[]> =>
    fetch(`${BASE_URL}/api/merchants`).then(handleResponse<Merchant[]>),

  // Disputes & Chargebacks
  getDisputes: (): Promise<Dispute[]> =>
    fetch(`${BASE_URL}/api/disputes`).then(handleResponse<Dispute[]>),

  resolveDispute: (disputeId: string, outcome = 'won'): Promise<Dispute> =>
    fetch(`${BASE_URL}/api/disputes/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispute_id: disputeId, outcome }),
    }).then(handleResponse<Dispute>),

  // Live Transaction Simulator
  simulateTransaction: (payload: SimulateTxnReq): Promise<SimulateTxnRes> =>
    fetch(`${BASE_URL}/api/simulate-txn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(handleResponse<SimulateTxnRes>),

  // Multi-Tenant Management
  getTenants: (role = 'finance_admin', currentMerchant = 'merch_001'): Promise<TenantMetadata[]> =>
    fetch(`${BASE_URL}/api/tenants?role=${role}&current_merchant=${currentMerchant}`).then(handleResponse<TenantMetadata[]>),

  // Real-Time Alerts & Notification Center
  getAlerts: (merchantId = 'merch_001'): Promise<FinancialAlert[]> =>
    fetch(`${BASE_URL}/api/alerts?merchant_id=${merchantId}`).then(handleResponse<FinancialAlert[]>),

  acknowledgeAlert: (alertId: string, merchantId = 'merch_001'): Promise<{ status: string; alert: FinancialAlert }> =>
    fetch(`${BASE_URL}/api/alerts/${alertId}/acknowledge?merchant_id=${merchantId}`, {
      method: 'POST',
    }).then(handleResponse<{ status: string; alert: FinancialAlert }>),

  dismissAlert: (alertId: string, merchantId = 'merch_001'): Promise<{ status: string; alert_id: string }> =>
    fetch(`${BASE_URL}/api/alerts/${alertId}/dismiss?merchant_id=${merchantId}`, {
      method: 'POST',
    }).then(handleResponse<{ status: string; alert_id: string }>),

  // ML Smart Suggestions & Recommendations
  getRecommendations: (merchantId = 'merch_001'): Promise<SmartRecommendation[]> =>
    fetch(`${BASE_URL}/api/recommendations?merchant_id=${merchantId}`).then(handleResponse<SmartRecommendation[]>),

  applyRecommendation: (recId: string, merchantId = 'merch_001'): Promise<{ status: string; message: string; recommendation: SmartRecommendation }> =>
    fetch(`${BASE_URL}/api/recommendations/${recId}/apply?merchant_id=${merchantId}`, {
      method: 'POST',
    }).then(handleResponse<{ status: string; message: string; recommendation: SmartRecommendation }>),

  // Historical Batch Comparison & Trend Analysis
  getTrendComparison: (merchantId = 'merch_001'): Promise<TrendComparison> =>
    fetch(`${BASE_URL}/api/trends/comparison?merchant_id=${merchantId}`).then(handleResponse<TrendComparison>),
};
