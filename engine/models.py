"""Pydantic data models for financial reconciliation and settlement Q&A."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class MatchTier(str, Enum):
    EXACT_ID = "tier1_exact_id"
    FUZZY_AMOUNT_DATE = "tier2_fuzzy_tolerance"
    SEMANTIC_EMBEDDING = "tier3_semantic_vector"
    MANUAL_EXCEPTION = "tier4_exception"


class LedgerRecord(BaseModel):
    """Internal ERP / accounting ledger transaction."""
    txn_id: str
    merchant_id: str
    amount: float
    txn_date: str  # YYYY-MM-DD
    order_id: str | None = None
    description: str
    currency: str = "INR"
    customer_name: str | None = None


class SettlementRecord(BaseModel):
    """Bank or Payment Gateway payout line item."""
    payout_ref: str
    merchant_id: str
    net_amount: float
    gross_amount: float
    fee_deducted: float
    tax_deducted: float = 0.0
    settlement_date: str  # YYYY-MM-DD
    utr: str | None = None
    description: str
    matched_txn_id: str | None = None


class MatchResult(BaseModel):
    """Matched record pair with verifiable confidence and math explanation."""
    ledger_txn_id: str
    settlement_payout_ref: str
    merchant_id: str
    ledger_amount: float
    settlement_gross: float
    settlement_net: float
    fee_deducted: float
    amount_discrepancy: float
    match_tier: MatchTier
    confidence: float
    explanation: str
    matched_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ExceptionRecord(BaseModel):
    """Unmatched or anomalous transaction requiring merchant/finance review."""
    record_type: str  # "unmatched_ledger" | "unmatched_settlement" | "amount_mismatch" | "duplicate"
    source_id: str
    merchant_id: str
    amount: float
    date: str
    description: str
    reason: str
    suggested_action: str
    risk_level: str = "medium"


class ReconciliationReport(BaseModel):
    """Comprehensive summary of a reconciliation batch run."""
    total_ledger_records: int
    total_settlement_records: int
    matched_count: int
    auto_match_rate_pct: float
    exception_count: int
    matched_volume_inr: float
    fee_volume_inr: float
    discrepancy_volume_inr: float
    tier1_exact_count: int
    tier2_fuzzy_count: int
    tier3_semantic_count: int
    matches: list[MatchResult]
    exceptions: list[ExceptionRecord]
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SettlementQARequest(BaseModel):
    """Merchant / Finance settlement query."""
    merchant_id: str
    question: str
    role: str = "merchant"  # merchant | support_agent | finance_admin
    max_tokens: int = 1500


class SettlementQAResponse(BaseModel):
    """Grounded natural language answer."""
    question: str
    answer: str
    role: str
    verified_data_used: list[dict[str, Any]]
    tokens_used: int
    tokens_saved: int
    audit_id: str
    llm_synthesized: bool = True
