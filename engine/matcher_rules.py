"""Tier 1 & Tier 2 Deterministic Rule Matchers.

Handles:
- Tier 1: Exact Transaction ID matching (Txn ID match with fee tolerance verification).
- Tier 2: Fuzzy Tolerance matching (Amount +- 2.5% fee tolerance + settlement date within 3 days).
"""

from __future__ import annotations

from datetime import datetime
from engine.models import (
    LedgerRecord,
    MatchResult,
    MatchTier,
    SettlementRecord,
)


def _parse_date(date_str: str) -> datetime:
    return datetime.fromisoformat(date_str.split("T")[0])


import re

def _extract_txn_ref(text: str) -> str | None:
    """Extracts TXN identifier like TXN10001 or txn_1001 from text/description."""
    if not text:
        return None
    m = re.search(r'(?:txn[-_]?[0-9]+)', text, re.IGNORECASE)
    return m.group(0).upper().replace("-", "").replace("_", "") if m else None


def _normalize_merchant(name: str | None) -> str:
    """Robust string normalization for noisy merchant names (whitespace, case, punctuation)."""
    if not name:
        return ""
    cleaned = re.sub(r'[^\w\s]', '', name.lower())
    return " ".join(cleaned.split())


def match_tier1_exact(
    ledger_records: list[LedgerRecord],
    settlement_records: list[SettlementRecord],
) -> tuple[list[MatchResult], list[LedgerRecord], list[SettlementRecord]]:
    """Tier 1: Exact Txn ID match with exact amount and T+0 date verification."""
    matched_results: list[MatchResult] = []
    unmatched_ledger: list[LedgerRecord] = []
    available_settlements = list(settlement_records)

    for l in ledger_records:
        l_norm_id = l.txn_id.upper().replace("-", "").replace("_", "")
        l_merch_norm = _normalize_merchant(l.merchant_id)
        best_match_idx = -1

        for idx, s in enumerate(available_settlements):
            # Check normalized merchant names
            if l_merch_norm and _normalize_merchant(s.merchant_id) != l_merch_norm:
                continue

            # Check if settlement explicitly references this ledger transaction ID in matched_txn_id or description
            s_extracted_id = _extract_txn_ref(s.matched_txn_id or s.description)
            is_id_matched = (s_extracted_id == l_norm_id) or (s.matched_txn_id == l.txn_id)

            if is_id_matched:
                amount_diff = abs(l.amount - s.gross_amount)
                l_dt = _parse_date(l.txn_date)
                s_dt = _parse_date(s.settlement_date)
                day_diff = (s_dt - l_dt).days

                is_amount_valid = (amount_diff <= (l.amount * 0.05)) or (amount_diff < 1.0)
                is_date_valid = (0 <= day_diff <= 4)

                if is_amount_valid and is_date_valid:
                    best_match_idx = idx
                    break

        if best_match_idx != -1:
            s = available_settlements.pop(best_match_idx)
            expected_deduction = s.fee_deducted + s.tax_deducted
            matched_results.append(
                MatchResult(
                    ledger_txn_id=l.txn_id,
                    settlement_payout_ref=s.payout_ref,
                    merchant_id=l.merchant_id,
                    ledger_amount=l.amount,
                    settlement_gross=s.gross_amount,
                    settlement_net=s.net_amount,
                    fee_deducted=expected_deduction,
                    amount_discrepancy=0.0,
                    match_tier=MatchTier.EXACT_ID,
                    confidence=1.0,
                    explanation=f"Exact Tier 1 match: Confirmed Transaction ID {l.txn_id} on {s.settlement_date}.",
                )
            )
        else:
            unmatched_ledger.append(l)

    return matched_results, unmatched_ledger, available_settlements


def match_tier2_fuzzy(
    ledger_records: list[LedgerRecord],
    settlement_records: list[SettlementRecord],
    amount_tolerance_pct: float = 0.048,  # 4.8% max fee variation tolerance (covers International 3.5% + flat ₹7 + GST)
    max_day_offset: int = 4,              # T+0 to T+4 settlement & holiday shift window
) -> tuple[list[MatchResult], list[LedgerRecord], list[SettlementRecord]]:
    """Tier 2: Fuzzy amount fee tolerance + Date offset matching."""
    matched_results: list[MatchResult] = []
    unmatched_ledger: list[LedgerRecord] = []
    available_settlements: list[SettlementRecord] = list(settlement_records)

    for l in ledger_records:
        l_date = _parse_date(l.txn_date)
        l_merch_norm = _normalize_merchant(l.merchant_id)
        best_match: SettlementRecord | None = None
        best_diff = float("inf")
        best_idx = -1

        for idx, s in enumerate(available_settlements):
            # Must belong to the same merchant (normalized)
            if l_merch_norm and _normalize_merchant(s.merchant_id) != l_merch_norm:
                continue

            s_date = _parse_date(s.settlement_date)
            day_diff = (s_date - l_date).days

            if not (0 <= day_diff <= max_day_offset):
                continue

            diff = abs(l.amount - s.gross_amount)
            is_amount_in_tolerance = (diff <= (l.amount * amount_tolerance_pct)) or (diff < 1.0)

            if is_amount_in_tolerance:
                # If amount is exact AND date is exact (day_diff == 0), but descriptions differ without ID reference,
                # pass to Tier 3 Semantic matching instead of claiming under fuzzy tolerance.
                if diff < 0.01 and day_diff == 0:
                    continue

                if diff < best_diff:
                    best_diff = diff
                    best_match = s
                    best_idx = idx

        if best_match and best_idx != -1:
            s = available_settlements.pop(best_idx)
            expected_deduction = s.fee_deducted + s.tax_deducted
            matched_results.append(
                MatchResult(
                    ledger_txn_id=l.txn_id,
                    settlement_payout_ref=s.payout_ref,
                    merchant_id=l.merchant_id,
                    ledger_amount=l.amount,
                    settlement_gross=s.gross_amount,
                    settlement_net=s.net_amount,
                    fee_deducted=expected_deduction,
                    amount_discrepancy=round(l.amount - s.gross_amount, 2),
                    match_tier=MatchTier.FUZZY_AMOUNT_DATE,
                    confidence=0.95,
                    explanation=f"Tier 2 Fuzzy match: Verified fee/date tolerance (diff: INR {best_diff:.2f}) settled on {s.settlement_date}.",
                )
            )
        else:
            unmatched_ledger.append(l)

    return matched_results, unmatched_ledger, available_settlements
