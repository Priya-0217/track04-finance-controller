export type MatchTier = 'tier1_exact' | 'tier2_fuzzy' | 'tier3_semantic' | 'tier4_exception';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface MetricsData {
  auto_match_rate_pct: number;
  total_records: number;
  matched_count: number;
  exception_count: number;
  tier1_exact: number;
  tier2_fuzzy: number;
  tier3_semantic: number;
  gross_volume_inr: number;
  fee_drag_inr: number;
  liquid_cash_inr: number;
  in_transit_receivables_inr: number;
  disputed_holdbacks_inr: number;
  health_score: number;
}

export interface MatchResult {
  ledger_txn_id: string;
  settlement_payout_ref: string;
  merchant_id: string;
  settlement_gross: number;
  fee_deducted: number;
  settlement_net: number;
  match_tier: MatchTier;
  confidence: number;
  match_reasons?: string[];
}

export interface ExceptionRecord {
  source_id: string;
  merchant_id: string;
  record_type: 'unmatched_ledger' | 'unmatched_settlement' | 'amount_mismatch' | 'fee_anomaly';
  amount: number;
  risk_level: RiskLevel;
  reason: string;
  suggested_action: string;
}

export interface ReconciliationReport {
  total_ledger_records: number;
  total_settlement_records: number;
  matched_count: number;
  exception_count: number;
  auto_match_rate_pct: number;
  matched_volume_inr: number;
  fee_volume_inr: number;
  tier1_exact_count: number;
  tier2_fuzzy_count: number;
  tier3_semantic_count: number;
  matches: MatchResult[];
  exceptions: ExceptionRecord[];
}

export interface DailyProjection {
  day_offset: number;
  forecast_date: string;
  day_name: string;
  is_bank_holiday: boolean;
  holiday_reason?: string | null;
  expected_gross_sales_inr: number;
  projected_fee_deductions_inr: number;
  projected_net_settlement_inr: number;
  ending_balance_inr: number;
}

export interface TreasuryAlert {
  alert_type: 'HOLIDAY_DELAY' | 'WEEKEND_ROLLOVER' | 'OVERDRAFT_RISK' | 'HIGH_INFLOW';
  title: string;
  description: string;
  date_affected: string;
  recommended_action: string;
}

export interface ForecastData {
  as_of_date: string;
  forecast_horizon_days: number;
  merchant_id?: string | null;
  current_liquid_balance_inr: number;
  projected_ending_balance_inr: number;
  net_liquidity_change_inr: number;
  total_projected_inflow_inr: number;
  total_projected_fee_drag_inr: number;
  treasury_recommendation: string;
  daily_projections: DailyProjection[];
  alerts: TreasuryAlert[];
}

export interface AuditFinding {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  category: string;
  description: string;
  impact_inr: number;
  action: string;
}

export interface AuditReport {
  health_score: number;
  match_rate: number;
  total_volume: number;
  fee_leakage: number;
  funds_at_risk: number;
  findings: AuditFinding[];
}

export interface Merchant {
  merchant_id: string;
  business_name: string;
  contact_email: string;
  settlement_cycle: string;
  fee_tier: string;
  risk_rating: string;
}

export interface Dispute {
  dispute_id: string;
  merchant_id: string;
  amount: number;
  status: 'under_review' | 'won' | 'lost';
  reason: string;
  holdback_active: boolean;
}

export interface PaymentInstrumentInfo {
  id: string;
  name: string;
  mdr_rate_pct: number;
  fixed_fee_inr: number;
  gst_rate_pct: number;
  label: string;
}

export interface ConfigData {
  llm_provider: string;
  model_id: string;
  has_api_key: boolean;
  default_merchant_id: string;
  token_budget: number;
}

export interface UpdateConfigReq {
  llm_provider?: string;
  model_id?: string;
  api_key?: string;
  default_merchant_id?: string;
  token_budget?: number;
}

export interface TestLlmReq {
  llm_provider?: string;
  model_id?: string;
  api_key?: string;
}

export interface TestLlmRes {
  status: 'connected' | 'error';
  provider: string;
  model_id: string;
  latency_ms: number;
  reply: string;
  detail: string;
}

export interface SimulateTxnReq {
  amount: number;
  merchant_id: string;
  instrument: string;
  description: string;
}

export interface SimulateTxnRes {
  txn_id: string;
  utr: string;
  gross_amount: number;
  fee_deducted: number;
  gst_deducted: number;
  net_amount: number;
  merchant_id: string;
  instrument: string;
}

export interface AutoCloseRes {
  status: string;
  health_score: number;
  match_rate_pct: number;
  total_volume_inr: number;
  fee_leakage_inr: number;
  funds_at_risk_inr: number;
  exceptions_count: number;
  matched_count: number;
  timestamp: string;
  signed_by: string;
}

export interface FinancialAlert {
  id: string;
  merchant_id: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  category: string;
  title: string;
  message: string;
  impact_amount_inr: number;
  suggested_action: string;
  action_type: string;
  action_target: string;
  status: 'active' | 'acknowledged' | 'dismissed';
  created_at: string;
}

export interface TenantMetadata {
  merchant_id: string;
  name: string;
  kyc_status: 'verified' | 'pending_review' | 'action_required';
  business_category: string;
  currency: string;
  settlement_cycle: string;
  contract_tier: string;
  created_at: string;
}

export interface PeriodMetrics {
  period_label: string;
  batch_date: string;
  total_volume_inr: number;
  matched_volume_inr: number;
  auto_match_rate_pct: number;
  fee_drag_bps: number;
  exception_count: number;
  unsettled_funds_inr: number;
  settlement_velocity_hours: number;
}

export interface TrendComparison {
  merchant_id: string;
  current_period: PeriodMetrics;
  previous_period: PeriodMetrics;
  match_rate_delta_pct: number;
  fee_drag_delta_bps: number;
  volume_growth_pct: number;
  exception_delta_count: number;
  historical_periods: PeriodMetrics[];
  trend_summary: string;
}

export interface SmartRecommendation {
  id: string;
  title: string;
  category: 'fee_optimization' | 'working_capital' | 'automation' | 'risk_mitigation';
  priority: 'high' | 'medium' | 'low';
  description: string;
  estimated_annual_savings_inr: number;
  confidence_score: number;
  action_label: string;
  action_type: string;
  status: 'pending' | 'applied' | 'dismissed';
}

export interface AgentActionCard {
  id: string;
  action_type: 'export_pdf' | 'export_accounting' | 'auto_close_books' | 'instant_payout' | 'navigate';
  label: string;
  description: string;
  icon?: string;
  target_url?: string;
  badge?: string;
  payload?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  intent?: string;
  tool_called?: string | null;
  latencySec?: string;
  timestamp: string;
  action_cards?: AgentActionCard[];
}
