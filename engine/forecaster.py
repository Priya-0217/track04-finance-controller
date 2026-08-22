"""Forward Cash Forecaster Engine for Razorpay AI Finance Controller.

Predicts future cash positions (7 to 30 days) by analyzing:
1. Current verified liquid bank balance
2. Pending receivables from unmatched ledger records
3. Payment instrument rail clearing cycles (UPI T+0, Debit T+1, Credit T+2, NEFT/Corporate T+2)
4. Dynamic MDR fee deductions + 18% GST
5. Indian RBI Bank Holiday Calendar & Weekend clearing rollovers
6. Historical settlement velocity for trend smoothing
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
from typing import Any

from engine.fee_rules import DEFAULT_FEE_SCHEDULES, PaymentInstrument
from engine.models import LedgerRecord, ReconciliationReport, SettlementRecord

# 2026 Indian Banking Holidays & Clearing Non-Settlement Days
INDIAN_BANK_HOLIDAYS_2026 = {
    date(2026, 1, 26): "Republic Day",
    date(2026, 3, 3): "Holi",
    date(2026, 3, 20): "Eid-ul-Fitr",
    date(2026, 4, 14): "Dr. Ambedkar Jayanti",
    date(2026, 5, 1): "Maharashtra Day / Labour Day",
    date(2026, 8, 15): "Independence Day",
    date(2026, 10, 2): "Mahatma Gandhi Jayanti",
    date(2026, 10, 20): "Dussehra",
    date(2026, 11, 8): "Diwali (Laxmi Pujan)",
    date(2026, 12, 25): "Christmas Day",
}


@dataclass
class DailyForecastItem:
    day_offset: int
    forecast_date: str
    day_name: str
    starting_balance_inr: float
    expected_gross_sales_inr: float
    projected_fee_deductions_inr: float
    projected_net_settlement_inr: float
    ending_balance_inr: float
    is_bank_holiday: bool
    holiday_reason: str | None
    pending_items_count: int
    settlement_status: str  # "SETTLEMENT_ACTIVE" | "HOLIDAY_DELAYED" | "WEEKEND_ROLLOVER"


@dataclass
class ForecastAlert:
    alert_type: str  # "HOLIDAY_DELAY" | "LIQUIDITY_WARNING" | "TRAPPED_PAYOUT" | "TREASURY_OPPORTUNITY"
    severity: str    # "HIGH" | "MEDIUM" | "INFO"
    title: str
    description: str
    recommended_action: str


@dataclass
class ForwardCashForecastReport:
    as_of_date: str
    forecast_horizon_days: int
    current_liquid_balance_inr: float
    projected_ending_balance_inr: float
    total_projected_inflow_inr: float
    total_projected_fee_drag_inr: float
    net_liquidity_change_inr: float
    daily_projections: list[DailyForecastItem]
    alerts: list[ForecastAlert]
    treasury_recommendation: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ForwardCashForecaster:
    """Predicts day-by-day cash position incorporating clearing rails and bank holidays."""

    def __init__(self, custom_holidays: set[date] | None = None):
        self.holidays = custom_holidays or INDIAN_BANK_HOLIDAYS_2026

    def is_clearing_day(self, d: date) -> tuple[bool, str | None]:
        # Sunday (weekday == 6) or 2nd/4th Saturday (simplified as Saturday/Sunday)
        if d.weekday() == 6:
            return False, "Sunday (Clearing Closed)"
        if d.weekday() == 5:
            # 2nd or 4th Saturday in India
            day = d.day
            sat_num = (day - 1) // 7 + 1
            if sat_num in (2, 4):
                return False, f"{sat_num}th Saturday (RBI Bank Holiday)"
        if d in self.holidays:
            return False, f"Bank Holiday: {self.holidays[d]}"
        return True, None

    def get_next_working_clearing_day(self, target_date: date) -> tuple[date, str | None]:
        curr = target_date
        reason = None
        while True:
            is_clear, holiday_reason = self.is_clearing_day(curr)
            if is_clear:
                return curr, reason
            reason = reason or holiday_reason
            curr += timedelta(days=1)

    def estimate_instrument_lag(self, description: str, amount: float) -> int:
        """Estimates settlement lag days based on payment rail."""
        desc_lower = description.lower()
        if "upi" in desc_lower or amount < 2000.0:
            return 0  # UPI is T+0 / instant
        elif "debit" in desc_lower:
            return 1  # Debit Card is T+1
        elif "credit" in desc_lower:
            return 2  # Credit Card is T+2
        elif "international" in desc_lower:
            return 3  # International is T+3
        return 2      # Default standard card/gateway is T+2

    def calculate_forecast(
        self,
        report: ReconciliationReport,
        horizon_days: int = 7,
        as_of_date: date | None = None,
        merchant_id: str | None = None,
    ) -> ForwardCashForecastReport:
        today = as_of_date or date(2026, 8, 1)

        # 1. Starting Liquid Bank Balance
        current_liquid = report.matched_volume_inr - report.fee_volume_inr

        # 2. Extract Pending Ledger Receivables (Unmatched ledger items)
        unsettled_items = [
            e for e in report.exceptions
            if e.record_type == "unmatched_ledger" and (not merchant_id or e.merchant_id == merchant_id)
        ]

        # Calculate average historical daily volume from matched records for baseline smoothing
        matched_vol = report.matched_volume_inr
        avg_daily_baseline = (matched_vol / 30.0) if matched_vol > 0 else 25000.0

        # 3. Schedule Pending Receivables onto Target Working Days
        scheduled_inflows: dict[date, list[tuple[float, float, str]]] = {
            today + timedelta(days=i): [] for i in range(horizon_days)
        }

        # Distribute known unsettled receivables
        for item in unsettled_items:
            lag = self.estimate_instrument_lag(item.reason, item.amount)
            raw_target_date = today + timedelta(days=lag)
            effective_date, _ = self.get_next_working_clearing_day(raw_target_date)

            # Calculate standard MDR (1.99% + 18% GST = ~2.3482%)
            fee_amt = round(item.amount * 0.0199 * 1.18, 2)
            net_amt = round(item.amount - fee_amt, 2)

            if effective_date in scheduled_inflows:
                scheduled_inflows[effective_date].append((item.amount, fee_amt, item.source_id))
            else:
                # If rolled past horizon, place on last horizon day
                last_day = today + timedelta(days=horizon_days - 1)
                scheduled_inflows[last_day].append((item.amount, fee_amt, item.source_id))

        # 4. Generate Day-by-Day Forecast Timeline
        daily_items: list[DailyForecastItem] = []
        running_balance = current_liquid
        total_inflow = 0.0
        total_fee_drag = 0.0
        alerts: list[ForecastAlert] = []

        for offset in range(horizon_days):
            curr_date = today + timedelta(days=offset)
            is_clear, holiday_reason = self.is_clearing_day(curr_date)
            start_bal = running_balance

            # Gather inflows scheduled for today
            inflow_tuples = scheduled_inflows.get(curr_date, [])
            day_gross = sum(t[0] for t in inflow_tuples)
            day_fees = sum(t[1] for t in inflow_tuples)

            # If it's a clearing day and no pending items, add organic daily baseline settlement
            if is_clear:
                if not inflow_tuples and offset > 1:
                    day_gross += avg_daily_baseline
                    day_fees += round(avg_daily_baseline * 0.02 * 1.18, 2)
                day_net = round(day_gross - day_fees, 2)
                settle_status = "SETTLEMENT_ACTIVE"
            else:
                # Bank holiday or weekend: NO settlements clear into bank account
                day_gross = 0.0
                day_fees = 0.0
                day_net = 0.0
                settle_status = "HOLIDAY_DELAYED" if "Holiday" in (holiday_reason or "") else "WEEKEND_ROLLOVER"

            running_balance = round(running_balance + day_net, 2)
            total_inflow += day_gross
            total_fee_drag += day_fees

            daily_items.append(
                DailyForecastItem(
                    day_offset=offset + 1,
                    forecast_date=curr_date.isoformat(),
                    day_name=curr_date.strftime("%A"),
                    starting_balance_inr=start_bal,
                    expected_gross_sales_inr=day_gross,
                    projected_fee_deductions_inr=day_fees,
                    projected_net_settlement_inr=day_net,
                    ending_balance_inr=running_balance,
                    is_bank_holiday=not is_clear,
                    holiday_reason=holiday_reason,
                    pending_items_count=len(inflow_tuples),
                    settlement_status=settle_status,
                )
            )

            # Generate alerts for non-clearing days
            if not is_clear and holiday_reason:
                alerts.append(
                    ForecastAlert(
                        alert_type="HOLIDAY_DELAY",
                        severity="MEDIUM",
                        title=f"{curr_date.strftime('%d %b')} Settlement Pause ({holiday_reason})",
                        description=f"Bank clearing network is offline on {curr_date.strftime('%A, %d %B')}. Expected payouts will roll over to the next working business day.",
                        recommended_action="Defer outbound vendor NEFT/RTGS disbursements scheduled on this date.",
                    )
                )

        # Trapped payouts alert
        trapped_total = sum(e.amount for e in unsettled_items)
        if trapped_total > 50000.0:
            alerts.append(
                ForecastAlert(
                    alert_type="TRAPPED_PAYOUT",
                    severity="HIGH",
                    title=f"INR {trapped_total:,.2f} Trapped in In-Transit Queue",
                    description=f"{len(unsettled_items)} ledger transactions are awaiting gateway batch confirmation beyond standard clearing windows.",
                    recommended_action="Execute automated gateway reconciliation query to unblock funds before week-end.",
                )
            )

        # Treasury Recommendation
        net_change = running_balance - current_liquid
        if net_change >= 0:
            rec = f"Liquidity surplus of INR {net_change:,.2f} projected over {horizon_days} days. Cash position is healthy for planned vendor disbursements."
        else:
            rec = f"Projected liquidity contraction of INR {abs(net_change):,.2f}. Consider holding discretionary CAPEX payouts."

        return ForwardCashForecastReport(
            as_of_date=today.isoformat(),
            forecast_horizon_days=horizon_days,
            current_liquid_balance_inr=current_liquid,
            projected_ending_balance_inr=running_balance,
            total_projected_inflow_inr=total_inflow,
            total_projected_fee_drag_inr=total_fee_drag,
            net_liquidity_change_inr=net_change,
            daily_projections=daily_items,
            alerts=alerts,
            treasury_recommendation=rec,
        )
