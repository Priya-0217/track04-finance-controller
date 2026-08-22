"""Unit and Integration Tests for Enterprise Extensions:
- Multi-Tenant Isolation & RBAC
- Real-Time Alerts & Notification Lifecycle
- Smart Advisor Actionable Recommendations
- Historical Trend Analyzer
- Multi-Format Accounting & Report Exporters
"""

import pytest
from engine.accounting_exporter import AccountingExporter
from engine.alerts_engine import AlertsEngine
from engine.models import (
    ExceptionRecord,
    LedgerRecord,
    MatchResult,
    MatchTier,
    ReconciliationReport,
    SettlementRecord,
)
from engine.multi_tenant import TenantManager
from engine.smart_advisor import SmartAdvisor
from engine.trend_analyzer import TrendAnalyzer


@pytest.fixture
def mock_reconciliation_report():
    ledger = LedgerRecord(
        txn_id="TXN_001",
        merchant_id="merch_001",
        amount=10000.0,
        txn_date="2026-08-21",
        description="Checkout Order",
    )
    settlement = SettlementRecord(
        payout_ref="PAY_001",
        merchant_id="merch_001",
        gross_amount=10000.0,
        fee_deducted=236.0,
        net_amount=9764.0,
        settlement_date="2026-08-22",
        description="Settlement Payout",
        matched_txn_id="TXN_001",
    )
    match_res = MatchResult(
        ledger_txn_id="TXN_001",
        settlement_payout_ref="PAY_001",
        merchant_id="merch_001",
        ledger_amount=10000.0,
        settlement_gross=10000.0,
        settlement_net=9764.0,
        fee_deducted=236.0,
        amount_discrepancy=0.0,
        match_tier=MatchTier.EXACT_ID,
        confidence=1.0,
        explanation="Deterministic exact match",
    )
    exception = ExceptionRecord(
        source_id="TXN_002",
        merchant_id="merch_001",
        record_type="unmatched_ledger",
        amount=65000.0,
        date="2026-08-21",
        description="Trapped settlement",
        reason="In-transit bank lag past T+2",
        suggested_action="Check UTR status with gateway",
        risk_level="amber",
    )
    return ReconciliationReport(
        matches=[match_res],
        exceptions=[exception],
        total_ledger_records=2,
        total_settlement_records=1,
        matched_count=1,
        exception_count=1,
        auto_match_rate_pct=50.0,
        tier1_exact_count=1,
        tier2_fuzzy_count=0,
        tier3_semantic_count=0,
        matched_volume_inr=10000.0,
        fee_volume_inr=236.0,
        discrepancy_volume_inr=0.0,
    )


def test_multi_tenant_manager():
    tm = TenantManager()
    merchants = tm.list_merchants(user_role="finance_admin")
    assert len(merchants) >= 4

    # Register new merchant
    new_m = tm.register_merchant(
        merchant_id="merch_999",
        name="Apollo Health Ventures",
        kyc_status="verified",
        business_category="HealthTech",
    )
    assert new_m.merchant_id == "merch_999"
    assert tm.validate_merchant_access("merch_999", user_role="finance_admin") is True

    # Scoped tenant RBAC
    scoped = tm.list_merchants(user_role="merchant_viewer", current_merchant_id="merch_001")
    assert len(scoped) == 1
    assert scoped[0]["merchant_id"] == "merch_001"


def test_alerts_engine_lifecycle(mock_reconciliation_report):
    ae = AlertsEngine()
    alerts = ae.generate_alerts(mock_reconciliation_report, merchant_id="merch_001")
    assert len(alerts) > 0

    first_alert = alerts[0]
    assert first_alert.status == "active"

    # Acknowledge
    ack = ae.acknowledge_alert(first_alert.id, merchant_id="merch_001")
    assert ack is not None
    assert ack.status == "acknowledged"

    # Dismiss
    dismissed = ae.dismiss_alert(first_alert.id, merchant_id="merch_001")
    assert dismissed is True
    active_after = ae.get_alerts(merchant_id="merch_001", include_dismissed=False)
    assert first_alert.id not in [a.id for a in active_after]


def test_smart_advisor_recommendations(mock_reconciliation_report):
    advisor = SmartAdvisor()
    recs = advisor.get_recommendations(mock_reconciliation_report, merchant_id="merch_001")
    assert len(recs) >= 2
    assert any(r.category == "fee_optimization" for r in recs)

    # Apply recommendation
    res = advisor.apply_recommendation("rec_opt_upi", merchant_id="merch_001")
    assert res["status"] == "success"
    assert res["recommendation"]["status"] == "applied"


def test_trend_analyzer(mock_reconciliation_report):
    analyzer = TrendAnalyzer()
    trends = analyzer.analyze_trends(mock_reconciliation_report, merchant_id="merch_001")
    assert trends.merchant_id == "merch_001"
    assert len(trends.historical_periods) == 4
    assert isinstance(trends.match_rate_delta_pct, float)
    assert "improved" in trends.trend_summary or "rate" in trends.trend_summary


def test_accounting_exporters(mock_reconciliation_report):
    exporter = AccountingExporter()

    # QuickBooks Journal Entry
    qb_csv = exporter.export_quickbooks_journal(mock_reconciliation_report, "merch_001")
    assert "Razorpay Settlement Clearing Bank Account" in qb_csv
    assert "GST Input Tax Credit Receivable" in qb_csv

    # Xero Bank Feed
    xero_csv = exporter.export_xero_bank_feed(mock_reconciliation_report, "merch_001")
    assert "200-REV" in xero_csv

    # Zoho Books Feed
    zoho_csv = exporter.export_zoho_books_feed(mock_reconciliation_report, "merch_001")
    assert "18%" in zoho_csv

    # Executive HTML/PDF Report
    html_report = exporter.generate_executive_html_report(mock_reconciliation_report, "merch_001")
    assert "Executive Treasury &amp; Reconciliation Sign-Off Report" in html_report
    assert "merch_001" in html_report
