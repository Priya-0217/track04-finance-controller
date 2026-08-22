"""Unit tests for Track 04 Financial Reconciliation Engine."""

import pytest
from engine.matcher_rules import match_tier1_exact, match_tier2_fuzzy
from engine.models import LedgerRecord, SettlementRecord
from engine.reconciler import ReconciliationEngine


@pytest.mark.asyncio
async def test_reconciliation_exact_and_fuzzy_matches():
    ledger = [
        LedgerRecord(
            txn_id="txn_001",
            merchant_id="merch_001",
            amount=1000.0,
            txn_date="2026-08-01",
            description="Test payment 1",
        ),
        LedgerRecord(
            txn_id="txn_002",
            merchant_id="merch_001",
            amount=2000.0,
            txn_date="2026-08-02",
            description="Test payment 2",
        ),
    ]

    settlement = [
        SettlementRecord(
            payout_ref="pay_001",
            merchant_id="merch_001",
            gross_amount=1000.0,
            fee_deducted=20.0,
            tax_deducted=3.6,
            net_amount=976.4,
            settlement_date="2026-08-02",
            description="Settlement for txn_001",
            matched_txn_id="txn_001",
        ),
        SettlementRecord(
            payout_ref="pay_002",
            merchant_id="merch_001",
            gross_amount=2000.0,
            fee_deducted=40.0,
            tax_deducted=7.2,
            net_amount=1952.8,
            settlement_date="2026-08-03",
            description="Bank transfer credit without ID",
            matched_txn_id=None,
        ),
    ]

    engine = ReconciliationEngine()
    report = await engine.reconcile_batch(ledger, settlement)

    assert report.total_ledger_records == 2
    assert report.matched_count == 2
    assert report.auto_match_rate_pct == 100.0
    assert report.exception_count == 0
    assert report.tier1_exact_count == 1
    assert report.tier2_fuzzy_count == 1


@pytest.mark.asyncio
async def test_reconciliation_detects_exceptions():
    ledger = [
        LedgerRecord(
            txn_id="txn_orphan",
            merchant_id="merch_001",
            amount=50000.0,
            txn_date="2026-08-01",
            description="Unsettled big payment",
        )
    ]
    settlement = []

    engine = ReconciliationEngine()
    report = await engine.reconcile_batch(ledger, settlement)

    assert report.matched_count == 0
    assert report.exception_count == 1
    assert report.exceptions[0].record_type == "unmatched_ledger"
    assert report.exceptions[0].source_id == "txn_orphan"


@pytest.mark.asyncio
async def test_forward_cash_forecaster():
    from engine.forecaster import ForwardCashForecaster
    forecaster = ForwardCashForecaster()

    ledger = [
        LedgerRecord(
            txn_id="txn_001", merchant_id="merch_001", amount=10000.0,
            txn_date="2026-08-01", description="Credit Card Purchase"
        ),
        LedgerRecord(
            txn_id="txn_pending", merchant_id="merch_001", amount=5000.0,
            txn_date="2026-08-01", description="Pending UPI Payment"
        ),
    ]
    settlement = [
        SettlementRecord(
            payout_ref="pay_001", merchant_id="merch_001", gross_amount=10000.0,
            fee_deducted=234.82, net_amount=9765.18, settlement_date="2026-08-02",
            description="Credit Card Purchase", matched_txn_id="txn_001"
        )
    ]

    engine = ReconciliationEngine()
    report = await engine.reconcile_batch(ledger, settlement)

    forecast_report = forecaster.calculate_forecast(report, horizon_days=7)

    assert forecast_report.forecast_horizon_days == 7
    assert len(forecast_report.daily_projections) == 7
    assert forecast_report.current_liquid_balance_inr == 9765.18
    assert forecast_report.projected_ending_balance_inr > 9765.18
    assert len(forecast_report.alerts) > 0
