"""Automated Verification & Benchmark Suite for AI Finance Controller.

Evaluates:
- True Positive / False Positive / False Negative against ground_truth.json
- Precision, Recall, F1-Score on 4-tier reconciliation
- Exception detection accuracy on deliberate anomalies
- Execution latency & throughput
"""

from __future__ import annotations

import asyncio
import csv
import json
import time
from pathlib import Path

from engine.models import LedgerRecord, SettlementRecord
from engine.reconciler import ReconciliationEngine

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def load_records():
    ledger_path = DATA_DIR / "ledger.csv"
    settle_path = DATA_DIR / "settlement.csv"
    gt_path = DATA_DIR / "ground_truth.json"

    with open(ledger_path, "r", encoding="utf-8") as f:
        ledger_records = [LedgerRecord(**r) for r in csv.DictReader(f)]

    with open(settle_path, "r", encoding="utf-8") as f:
        settle_records = [
            SettlementRecord(
                payout_ref=r["payout_ref"],
                merchant_id=r["merchant_id"],
                gross_amount=float(r["gross_amount"]),
                fee_deducted=float(r["fee_deducted"]),
                tax_deducted=float(r.get("tax_deducted", 0.0)),
                net_amount=float(r["net_amount"]),
                settlement_date=r["settlement_date"],
                description=r["description"],
                matched_txn_id=r.get("matched_txn_id") or None,
            )
            for r in csv.DictReader(f)
        ]

    with open(gt_path, "r", encoding="utf-8") as f:
        ground_truth = json.load(f)

    return ledger_records, settle_records, ground_truth


async def run_evaluation():
    print("=" * 70)
    print("[*] RAZORPAY AI FINANCE CONTROLLER - BENCHMARK EVALUATION")
    print("=" * 70)

    ledger_records, settle_records, ground_truth = load_records()
    engine = ReconciliationEngine()

    start_t = time.perf_counter()
    report = await engine.reconcile_batch(ledger_records, settle_records)
    elapsed_ms = (time.perf_counter() - start_t) * 1000

    # Build ground truth lookup
    true_pairs = {}
    for item in ground_truth["exact_matches"] + ground_truth["fuzzy_matches"] + ground_truth["semantic_matches"]:
        true_pairs[item["ledger_id"]] = item["settlement_id"]

    true_exception_ids = {e["id"] for e in ground_truth["exceptions"]}

    # Compute classification metrics
    tp = 0
    fp = 0
    for m in report.matches:
        if true_pairs.get(m.ledger_txn_id) == m.settlement_payout_ref:
            tp += 1
        else:
            fp += 1

    fn = len(true_pairs) - tp

    precision = (tp / max(1, tp + fp)) * 100.0
    recall = (tp / max(1, tp + fn)) * 100.0
    f1 = (2 * precision * recall) / max(1e-5, precision + recall)

    # Evaluate exception detection
    detected_exceptions = {e.source_id for e in report.exceptions}
    exception_hits = len(detected_exceptions & true_exception_ids)
    exception_accuracy = (exception_hits / max(1, len(true_exception_ids))) * 100.0

    print(f"\n[1] RECONCILIATION SUMMARY:")
    print(f"    - Total Ledger Rows:       {report.total_ledger_records}")
    print(f"    - Total Settlement Rows:   {report.total_settlement_records}")
    print(f"    - Auto-Matched Records:    {report.matched_count} ({report.auto_match_rate_pct:.1f}%)")
    print(f"    - Flagged Exceptions:      {report.exception_count}")
    print(f"    - Execution Latency:       {elapsed_ms:.2f} ms")

    print(f"\n[2] 4-TIER BREAKDOWN:")
    print(f"    - Tier 1 (Exact Txn ID):    {report.tier1_exact_count}")
    print(f"    - Tier 2 (Fuzzy Tolerance): {report.tier2_fuzzy_count}")
    print(f"    - Tier 3 (Semantic ONNX):   {report.tier3_semantic_count}")
    print(f"    - Tier 4 (Exceptions):      {report.exception_count}")

    print(f"\n[3] GROUND-TRUTH VERIFICATION METRICS:")
    print(f"    - Precision:               {precision:.2f}% (Target: >= 98%)")
    print(f"    - Recall:                  {recall:.2f}% (Target: >= 95%)")
    print(f"    - F1-Score:                {f1:.2f}%")
    print(f"    - Exception Catch Rate:    {exception_accuracy:.1f}% ({exception_hits}/{len(true_exception_ids)} true exceptions flagged)")

    print(f"\n[4] FINANCIAL VOLUME AUDIT:")
    print(f"    - Total Gross Matched:     INR {report.matched_volume_inr:,.2f}")
    print(f"    - Total Deductions (MDR):  INR {report.fee_volume_inr:,.2f}")
    print(f"    - Net Verified Discrepancy:INR {report.discrepancy_volume_inr:,.2f}")

    print("\n" + "=" * 70)
    if precision >= 98.0 and recall >= 95.0:
        print("[+] BENCHMARK PASSED: All verification constraints successfully met!")
    else:
        print("[-] BENCHMARK WARNING: Calibration required.")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_evaluation())
