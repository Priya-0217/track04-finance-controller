"""Synthetic Financial Dataset Generator with Ground-Truth Annotations.

Generates:
1. `ledger.csv`: Internal sales / order transactions from merchant ERP.
2. `settlement.csv`: Payout report from Payment Gateway / Bank with MDR fee deductions & settlement lags.
3. `ground_truth.json`: Explicit true mappings to evaluate Precision, Recall, and Accuracy.
"""

from __future__ import annotations

import csv
import json
import random
from datetime import date, timedelta
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent

MERCHANTS = [
    ("merch_001", "UrbanStore Electronics"),
    ("merch_002", "Nova Health Essentials"),
    ("merch_003", "Apex Cloud Solutions"),
]

DESCRIPTIONS = [
    "Annual SaaS Subscription Plan",
    "Hardware POS Terminal Purchase",
    "B2B Consulting Invoice Settlement",
    "Customer Checkout Order #{}",
    "Monthly Cloud Infrastructure Tier-2",
    "Payment for Invoice INV-2026-{}",
    "Bulk Order Apparel Fulfillment",
]


def generate_dataset(total_records: int = 100, seed: int = 42) -> tuple[list[dict], list[dict], dict]:
    random.seed(seed)
    base_date = date(2026, 8, 1)

    ledger_rows = []
    settlement_rows = []
    ground_truth = {
        "exact_matches": [],
        "fuzzy_matches": [],
        "semantic_matches": [],
        "exceptions": []
    }

    # 1. 60 Exact Matches (Exact Txn ID in settlement report, standard 2% fee + 18% GST)
    for i in range(1, 61):
        merch_id, merch_name = random.choice(MERCHANTS)
        txn_id = f"txn_l_{i:04d}"
        order_id = f"ord_{1000 + i}"
        amount = round(random.uniform(500.0, 50000.0), 2)
        txn_date = base_date + timedelta(days=random.randint(0, 15))
        desc = random.choice(DESCRIPTIONS).format(i)

        ledger_rows.append({
            "txn_id": txn_id,
            "merchant_id": merch_id,
            "amount": amount,
            "txn_date": txn_date.isoformat(),
            "order_id": order_id,
            "description": f"{desc} [{merch_name}]",
            "currency": "INR",
            "customer_name": f"Customer_{i}"
        })

        # Gateway Fee: 2.0% MDR + 18% GST on fee
        fee = round(amount * 0.02, 2)
        tax = round(fee * 0.18, 2)
        total_deduction = fee + tax
        net = round(amount - total_deduction, 2)
        settle_date = txn_date + timedelta(days=random.randint(1, 2))  # T+1 / T+2

        payout_ref = f"pay_s_{i:04d}"
        settlement_rows.append({
            "payout_ref": payout_ref,
            "merchant_id": merch_id,
            "gross_amount": amount,
            "fee_deducted": fee,
            "tax_deducted": tax,
            "net_amount": net,
            "settlement_date": settle_date.isoformat(),
            "utr": f"UTR202608{random.randint(100000, 999999)}",
            "description": f"Settlement payout for {txn_id} Order: {order_id}",
            "matched_txn_id": txn_id
        })

        ground_truth["exact_matches"].append({
            "ledger_id": txn_id,
            "settlement_id": payout_ref,
            "expected_tier": "tier1_exact_id"
        })

    # 2. 20 Fuzzy Tolerance Matches (Missing Txn ID, but exact amount & date match within 3 days)
    for i in range(61, 81):
        merch_id, merch_name = random.choice(MERCHANTS)
        txn_id = f"txn_l_{i:04d}"
        order_id = f"ord_{1000 + i}"
        amount = round(random.uniform(1000.0, 30000.0), 2)
        txn_date = base_date + timedelta(days=random.randint(0, 15))
        desc = f"Direct Bank Transfer / NEFT payment #{i}"

        ledger_rows.append({
            "txn_id": txn_id,
            "merchant_id": merch_id,
            "amount": amount,
            "txn_date": txn_date.isoformat(),
            "order_id": order_id,
            "description": f"{desc} [{merch_name}]",
            "currency": "INR",
            "customer_name": f"Customer_{i}"
        })

        fee = round(amount * 0.015, 2)
        tax = round(fee * 0.18, 2)
        net = round(amount - (fee + tax), 2)
        settle_date = txn_date + timedelta(days=random.randint(1, 3))
        payout_ref = f"pay_s_{i:04d}"

        settlement_rows.append({
            "payout_ref": payout_ref,
            "merchant_id": merch_id,
            "gross_amount": amount,
            "fee_deducted": fee,
            "tax_deducted": tax,
            "net_amount": net,
            "settlement_date": settle_date.isoformat(),
            "utr": f"UTR202608{random.randint(100000, 999999)}",
            "description": f"NEFT Payout Credit Batch-REF-{i} (No internal ID)",
            "matched_txn_id": ""  # Missing in bank report
        })

        ground_truth["fuzzy_matches"].append({
            "ledger_id": txn_id,
            "settlement_id": payout_ref,
            "expected_tier": "tier2_fuzzy_tolerance"
        })

    # 3. 10 Semantic / Messy Description Matches (Fuzzy names, slight variation in amounts)
    for i in range(81, 91):
        merch_id, merch_name = random.choice(MERCHANTS)
        txn_id = f"txn_l_{i:04d}"
        amount = round(random.uniform(5000.0, 45000.0), 2)
        txn_date = base_date + timedelta(days=random.randint(0, 15))

        ledger_rows.append({
            "txn_id": txn_id,
            "merchant_id": merch_id,
            "amount": amount,
            "txn_date": txn_date.isoformat(),
            "order_id": f"ord_{1000 + i}",
            "description": f"Razorpay PG Settlement for Batch {i} Enterprise Subscription",
            "currency": "INR",
            "customer_name": f"Customer_{i}"
        })

        fee = round(amount * 0.02, 2)
        tax = round(fee * 0.18, 2)
        net = round(amount - (fee + tax), 2)
        settle_date = txn_date + timedelta(days=2)
        payout_ref = f"pay_s_{i:04d}"

        # Messy bank report wording
        settlement_rows.append({
            "payout_ref": payout_ref,
            "merchant_id": merch_id,
            "gross_amount": amount,
            "fee_deducted": fee,
            "tax_deducted": tax,
            "net_amount": net,
            "settlement_date": settle_date.isoformat(),
            "utr": f"UTR202608{random.randint(100000, 999999)}",
            "description": f"RZP*PAYOUT BATCH_{i}_ENT_SUB_INR",
            "matched_txn_id": ""
        })

        ground_truth["semantic_matches"].append({
            "ledger_id": txn_id,
            "settlement_id": payout_ref,
            "expected_tier": "tier3_semantic_vector"
        })

    # 4. 10 Deliberate Exceptions / Anomalies (Must NOT be auto-matched)
    # 4a. 3 Ledger records with no bank payout (unsettled / pending payout)
    for i in range(91, 94):
        merch_id, merch_name = random.choice(MERCHANTS)
        txn_id = f"txn_l_{i:04d}"
        ledger_rows.append({
            "txn_id": txn_id,
            "merchant_id": merch_id,
            "amount": 15000.0,
            "txn_date": (base_date + timedelta(days=20)).isoformat(),
            "order_id": f"ord_{1000 + i}",
            "description": f"Pending Client Payment Order #{i} [{merch_name}]",
            "currency": "INR",
            "customer_name": f"Customer_{i}"
        })
        ground_truth["exceptions"].append({
            "id": txn_id,
            "type": "unmatched_ledger",
            "reason": "No settlement payout record found in gateway batch"
        })

    # 4b. 3 Settlement payouts with no ledger record (direct gateway adjustments/refund holdbacks)
    for i in range(94, 97):
        merch_id, merch_name = random.choice(MERCHANTS)
        payout_ref = f"pay_s_{i:04d}"
        settlement_rows.append({
            "payout_ref": payout_ref,
            "merchant_id": merch_id,
            "gross_amount": 7500.0,
            "fee_deducted": 150.0,
            "tax_deducted": 27.0,
            "net_amount": 7323.0,
            "settlement_date": (base_date + timedelta(days=12)).isoformat(),
            "utr": f"UTR202608{random.randint(100000, 999999)}",
            "description": f"Dispute Chargeback Reversal Credit Adj #{i}",
            "matched_txn_id": ""
        })
        ground_truth["exceptions"].append({
            "id": payout_ref,
            "type": "unmatched_settlement",
            "reason": "Direct gateway adjustment credit not registered in ERP ledger"
        })

    # 4c. 4 Transactions with severe amount discrepancy (ERP has typo ₹10,000 vs Bank ₹1,000)
    for i in range(97, 101):
        merch_id, merch_name = random.choice(MERCHANTS)
        txn_id = f"txn_l_{i:04d}"
        payout_ref = f"pay_s_{i:04d}"
        ledger_amount = 25000.0
        bank_amount = 2500.0  # Decimal typo in ERP

        ledger_rows.append({
            "txn_id": txn_id,
            "merchant_id": merch_id,
            "amount": ledger_amount,
            "txn_date": (base_date + timedelta(days=10)).isoformat(),
            "order_id": f"ord_{1000 + i}",
            "description": f"ERP Manual Entry Typos #{i}",
            "currency": "INR",
            "customer_name": f"Customer_{i}"
        })

        settlement_rows.append({
            "payout_ref": payout_ref,
            "merchant_id": merch_id,
            "gross_amount": bank_amount,
            "fee_deducted": 50.0,
            "tax_deducted": 9.0,
            "net_amount": 2441.0,
            "settlement_date": (base_date + timedelta(days=11)).isoformat(),
            "utr": f"UTR202608{random.randint(100000, 999999)}",
            "description": f"Settlement payout for {txn_id}",
            "matched_txn_id": txn_id
        })

        ground_truth["exceptions"].append({
            "id": txn_id,
            "type": "amount_mismatch",
            "reason": f"Severe amount mismatch: Ledger has INR {ledger_amount}, Settlement has INR {bank_amount}"
        })

    # Shuffle rows to simulate real-world un-ordered reports
    random.shuffle(ledger_rows)
    random.shuffle(settlement_rows)

    return ledger_rows, settlement_rows, ground_truth


def save_csv_and_json(data_dir: Path | None = None, total_records: int = 100) -> None:
    target_dir = data_dir or DATA_DIR
    target_dir.mkdir(parents=True, exist_ok=True)

    ledger_rows, settlement_rows, ground_truth = generate_dataset(total_records=total_records)

    # Write ledger.csv
    ledger_path = target_dir / "ledger.csv"
    with open(ledger_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=ledger_rows[0].keys())
        writer.writeheader()
        writer.writerows(ledger_rows)

    # Write settlement.csv
    settlement_path = target_dir / "settlement.csv"
    with open(settlement_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=settlement_rows[0].keys())
        writer.writeheader()
        writer.writerows(settlement_rows)

    # Write ground_truth.json
    gt_path = target_dir / "ground_truth.json"
    with open(gt_path, "w", encoding="utf-8") as f:
        json.dump(ground_truth, f, indent=2)

    print(f"[+] Generated {len(ledger_rows)} ledger rows -> {ledger_path}")
    print(f"[+] Generated {len(settlement_rows)} settlement rows -> {settlement_path}")
    print(f"[+] Generated ground-truth validation annotations -> {gt_path}")


if __name__ == "__main__":
    save_csv_and_json()
