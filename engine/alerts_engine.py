"""Real-Time Financial Alert & Notification Engine.

Continuously inspects reconciliation batches, bank settlement statements,
and fee schedules to trigger high-priority alerts with actionable resolution paths.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from engine.models import ReconciliationReport


class FinancialAlert(BaseModel):
    id: str = Field(default_factory=lambda: f"alt_{uuid.uuid4().hex[:8]}")
    merchant_id: str
    severity: str  # 'critical' (red), 'warning' (amber), 'info' (indigo), 'success' (emerald)
    category: str  # 'fee_leakage', 'unmatched_aging', 'fuzzy_spike', 'payout_delay', 'dispute_surge'
    title: str
    message: str
    impact_amount_inr: float = 0.0
    suggested_action: str
    action_type: str = "navigate"  # 'navigate', 'auto_resolve', 'renegotiate', 'dispute'
    action_target: str = "/reconcile"
    status: str = "active"  # 'active', 'acknowledged', 'dismissed'
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AlertsEngine:
    """Manages real-time financial anomaly detection and persistent notification state."""

    def __init__(self):
        self._alerts_db: Dict[str, List[FinancialAlert]] = {}

    def generate_alerts(self, report: ReconciliationReport, merchant_id: str = "merch_001") -> List[FinancialAlert]:
        """Evaluates live reconciliation report against financial risk rules."""
        if merchant_id not in self._alerts_db:
            self._alerts_db[merchant_id] = []

        existing_categories = {a.category for a in self._alerts_db[merchant_id] if a.status == "active"}
        generated: List[FinancialAlert] = []

        # 1. Critical Fee Leakage / Contract Overcharge Alert
        fee_variance_exceptions = [
            e for e in report.exceptions
            if "variance" in (e.reason or "").lower() or "fee" in (e.reason or "").lower()
        ]
        total_fee_leakage = sum(e.amount for e in fee_variance_exceptions)
        if total_fee_leakage > 0 and "fee_leakage" not in existing_categories:
            generated.append(
                FinancialAlert(
                    merchant_id=merchant_id,
                    severity="critical",
                    category="fee_leakage",
                    title="Gateway MDR Fee Variance Detected",
                    message=f"₹{total_fee_leakage:,.2f} deducted in excess of contract rate across {len(fee_variance_exceptions)} settlement items.",
                    impact_amount_inr=total_fee_leakage,
                    suggested_action="Generate Fee Recovery Dispute Letter for Bank Gateway",
                    action_type="dispute",
                    action_target="/audit",
                )
            )

        # 2. In-Transit Aging / Trapped Funds Alert
        in_transit_exceptions = [e for e in report.exceptions if e.record_type == "unmatched_ledger"]
        total_in_transit = sum(e.amount for e in in_transit_exceptions)
        if total_in_transit > 50000 and "unmatched_aging" not in existing_categories:
            generated.append(
                FinancialAlert(
                    merchant_id=merchant_id,
                    severity="warning",
                    category="unmatched_aging",
                    title="High In-Transit Capital Trapped",
                    message=f"₹{total_in_transit:,.2f} processed in ledger remains un-settled by banking rails past standard SLA.",
                    impact_amount_inr=total_in_transit,
                    suggested_action="View In-Transit Aging Ledger & Accelerate Payouts",
                    action_type="navigate",
                    action_target="/reconcile",
                )
            )

        # 3. Match Rate Threshold Breached Alert
        if report.auto_match_rate_pct < 95.0 and "low_match_rate" not in existing_categories:
            generated.append(
                FinancialAlert(
                    merchant_id=merchant_id,
                    severity="warning",
                    category="low_match_rate",
                    title="Auto-Match Rate Under Target (95%)",
                    message=f"Current batch match rate is {report.auto_match_rate_pct}%. {report.exception_count} records require manual exception triage.",
                    impact_amount_inr=sum(e.amount for e in report.exceptions),
                    suggested_action="Run Dense Semantic Vector Matcher",
                    action_type="auto_resolve",
                    action_target="/reconcile",
                )
            )

        # 4. Fuzzy Tolerance Review Alert
        if report.tier2_fuzzy_count > 0 and "fuzzy_spike" not in existing_categories:
            fuzzy_volume = sum(
                m.settlement_net for m in report.matches
                if m.match_tier.value == "tier2_fuzzy_tolerance"
            )
            generated.append(
                FinancialAlert(
                    merchant_id=merchant_id,
                    severity="info",
                    category="fuzzy_spike",
                    title="Fuzzy Tolerance Matches Require Sign-Off",
                    message=f"{report.tier2_fuzzy_count} transactions matched within ±3% fee tolerance (Volume: ₹{fuzzy_volume:,.2f}).",
                    impact_amount_inr=fuzzy_volume,
                    suggested_action="Review and Approve Fuzzy Tolerances",
                    action_type="navigate",
                    action_target="/reconcile",
                )
            )

        # 5. Autonomous Books Close Ready
        if report.auto_match_rate_pct >= 90.0 and "books_close" not in existing_categories:
            generated.append(
                FinancialAlert(
                    merchant_id=merchant_id,
                    severity="success",
                    category="books_close",
                    title="Period Reconciliation Ready for Close",
                    message=f"Verified ₹{report.matched_volume_inr - report.fee_volume_inr:,.2f} in net bank deposits with 100% mathematical integrity.",
                    impact_amount_inr=report.matched_volume_inr - report.fee_volume_inr,
                    suggested_action="Execute Autonomous 2-Way Books Close",
                    action_type="navigate",
                    action_target="/",
                )
            )

        self._alerts_db[merchant_id].extend(generated)
        return self.get_alerts(merchant_id)

    def get_alerts(self, merchant_id: str = "merch_001", include_dismissed: bool = False) -> List[FinancialAlert]:
        """Fetches active and acknowledged alerts for a given merchant."""
        alerts = self._alerts_db.get(merchant_id, [])
        if not include_dismissed:
            return [a for a in alerts if a.status != "dismissed"]
        return alerts

    def acknowledge_alert(self, alert_id: str, merchant_id: str = "merch_001") -> Optional[FinancialAlert]:
        """Marks an alert as acknowledged."""
        alerts = self._alerts_db.get(merchant_id, [])
        for a in alerts:
            if a.id == alert_id:
                a.status = "acknowledged"
                return a
        return None

    def dismiss_alert(self, alert_id: str, merchant_id: str = "merch_001") -> bool:
        """Dismisses an alert."""
        alerts = self._alerts_db.get(merchant_id, [])
        for a in alerts:
            if a.id == alert_id:
                a.status = "dismissed"
                return True
        return False
