"""Dynamic Payment Gateway Fee Schedule Engine.

Supports real-world merchant pricing contracts:
- Standard Domestic UPI (0.00%)
- Domestic Debit Card (0.90% + 18% GST)
- Domestic Credit Card (1.99% + 18% GST)
- Corporate / Amex (2.85% + 18% GST)
- International Cards (3.50% + fixed INR 7.00 + 18% GST)
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class PaymentInstrument(str, Enum):
    UPI = "upi"
    DEBIT_CARD = "debit_card"
    CREDIT_CARD = "credit_card"
    CORPORATE_CARD = "corporate_card"
    NETBANKING = "netbanking"
    INTERNATIONAL = "international"
    STANDARD_MDR = "standard_mdr"


@dataclass
class FeeSchedule:
    instrument: PaymentInstrument
    mdr_rate_pct: float
    fixed_fee_inr: float = 0.0
    gst_rate_pct: float = 18.0  # Standard 18% GST on processing fees

    def calculate_deduction(self, gross_amount: float) -> tuple[float, float, float]:
        """Calculates expected (mdr_fee, gst_tax, total_deduction, net_payout)."""
        base_fee = (gross_amount * (self.mdr_rate_pct / 100.0)) + self.fixed_fee_inr
        gst_tax = base_fee * (self.gst_rate_pct / 100.0)
        total_deduction = round(base_fee + gst_tax, 2)
        net_payout = round(gross_amount - total_deduction, 2)
        return round(base_fee, 2), round(gst_tax, 2), total_deduction


# Default Merchant Contract Tier
DEFAULT_FEE_SCHEDULES = {
    PaymentInstrument.UPI: FeeSchedule(PaymentInstrument.UPI, mdr_rate_pct=0.0),
    PaymentInstrument.DEBIT_CARD: FeeSchedule(PaymentInstrument.DEBIT_CARD, mdr_rate_pct=0.90),
    PaymentInstrument.CREDIT_CARD: FeeSchedule(PaymentInstrument.CREDIT_CARD, mdr_rate_pct=1.99),
    PaymentInstrument.CORPORATE_CARD: FeeSchedule(PaymentInstrument.CORPORATE_CARD, mdr_rate_pct=2.85),
    PaymentInstrument.INTERNATIONAL: FeeSchedule(PaymentInstrument.INTERNATIONAL, mdr_rate_pct=3.50, fixed_fee_inr=7.0),
    PaymentInstrument.STANDARD_MDR: FeeSchedule(PaymentInstrument.STANDARD_MDR, mdr_rate_pct=2.00),
}
