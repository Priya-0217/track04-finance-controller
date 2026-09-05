"""Transaction Simulation and Payout Initiation Engine.

Simulates new transactions across UPI/Cards, applies dynamic fee schedules + GST,
and creates new ledger/settlement pairs to balance the books dynamically.
"""

from __future__ import annotations

import csv
import datetime
import uuid
from pathlib import Path
from typing import Any

from engine.fee_rules import DEFAULT_FEE_SCHEDULES, PaymentInstrument
from engine.merchants import MerchantManager

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


class PayoutEngine:
    def __init__(self, data_dir: Path = DATA_DIR):
        self.data_dir = data_dir
        self.merchant_mgr = MerchantManager()

    def simulate_and_ingest_transaction(
        self,
        merchant_id: str,
        amount: float,
        description: str,
        instrument: str = "upi",
        customer_name: str = "Customer",
    ) -> dict[str, Any]:
        """Creates a live transaction, computes fee deductions, and appends to ledger and settlement."""
        inst_enum = PaymentInstrument(instrument) if instrument in [p.value for p in PaymentInstrument] else PaymentInstrument.STANDARD_MDR
        schedule = DEFAULT_FEE_SCHEDULES[inst_enum]

        # Calculate MDR fee & GST
        base_fee, gst, total_fee = schedule.calculate_deduction(amount)
        net_settle = round(amount - total_fee, 2)

        now = datetime.datetime.now(datetime.timezone.utc)
        txn_id = f"txn_live_{uuid.uuid4().hex[:8]}"
        payout_ref = f"pay_live_{uuid.uuid4().hex[:8]}"
        utr = f"UTR{uuid.uuid4().hex[:12].upper()}"

        # 1. Append to ledger.csv
        ledger_path = self.data_dir / "ledger.csv"
        if ledger_path.exists():
            with open(ledger_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                header = next(reader, None) or ["txn_id", "date", "amount", "merchant", "description"]
            
            row_map = {
                "txn_id": txn_id,
                "date": now.strftime("%Y-%m-%d"),
                "txn_date": now.strftime("%Y-%m-%d"),
                "amount": amount,
                "gross_amount": amount,
                "merchant": merchant_id,
                "merchant_id": merchant_id,
                "description": description,
                "currency": "INR",
                "customer_name": customer_name,
                "order_id": f"ord_{uuid.uuid4().hex[:6]}",
            }
            with open(ledger_path, "a", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=header, extrasaction="ignore")
                writer.writerow(row_map)

        # 2. Append to settlement.csv
        settle_path = self.data_dir / "settlement.csv"
        if settle_path.exists():
            with open(settle_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                header = next(reader, None) or ["settlement_ref", "date", "amount", "merchant", "description"]

            row_map = {
                "settlement_ref": payout_ref,
                "payout_ref": payout_ref,
                "date": (now + datetime.timedelta(days=1)).strftime("%Y-%m-%d"),
                "settlement_date": (now + datetime.timedelta(days=1)).strftime("%Y-%m-%d"),
                "amount": net_settle,
                "gross_amount": amount,
                "net_amount": net_settle,
                "fee_deducted": base_fee,
                "tax_deducted": gst,
                "merchant": merchant_id,
                "merchant_id": merchant_id,
                "description": f"Settlement for {description} ({txn_id})",
                "matched_txn_id": txn_id,
                "utr": utr,
            }
            with open(settle_path, "a", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=header, extrasaction="ignore")
                writer.writerow(row_map)

        return {
            "txn_id": txn_id,
            "payout_ref": payout_ref,
            "merchant_id": merchant_id,
            "gross_amount": amount,
            "fee_deducted": base_fee,
            "gst_deducted": gst,
            "net_amount": net_settle,
            "instrument": instrument,
            "utr": utr,
            "status": "ingested_and_matched",
        }
