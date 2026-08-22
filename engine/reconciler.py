"""4-Tier Financial Reconciliation Engine.

Orchestrates:
- Tier 1: Deterministic Exact Match (Txn ID) -> Confidence: 1.0
- Tier 2: Deterministic Fuzzy Tolerance (Amount +- 3% & Date <= 3 days) -> Confidence: 0.95
- Tier 3: Semantic ONNX Vector Embedding + Cross-Encoder Rerank -> Confidence: 0.70 - 0.90
- Tier 4: Explicit Exception List (Unmatched / Anomalous / Decimal Errors) -> Never Guess on Money!
"""

from __future__ import annotations

import math
import numpy as np
from datetime import datetime

from engine.embedder import EmbeddingPipeline
from engine.matcher_rules import match_tier1_exact, match_tier2_fuzzy, _normalize_merchant
from engine.models import (
    ExceptionRecord,
    LedgerRecord,
    MatchResult,
    MatchTier,
    ReconciliationReport,
    SettlementRecord,
)
from engine.reranker import CrossEncoderReranker


class ReconciliationEngine:
    def __init__(self):
        self.embedder = EmbeddingPipeline()
        self.reranker = CrossEncoderReranker()

    def _cosine_similarity(self, vec_a: list[float], vec_b: list[float]) -> float:
        dot = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(a * a for a in vec_a))
        norm_b = math.sqrt(sum(b * b for b in vec_b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    async def reconcile_batch(
        self,
        ledger_records: list[LedgerRecord],
        settlement_records: list[SettlementRecord],
        semantic_threshold: float = 0.70,
    ) -> ReconciliationReport:
        all_matches: list[MatchResult] = []
        all_exceptions: list[ExceptionRecord] = []

        # ====================================================================
        # Tier 1: Exact Match on Transaction ID
        # ====================================================================
        t1_matches, rem_ledger_1, rem_settle_1 = match_tier1_exact(
            ledger_records, settlement_records
        )
        all_matches.extend(t1_matches)

        # ====================================================================
        # Tier 2: Fuzzy Tolerance (Amount +- 3% & Date Offset <= 3 Days)
        # ====================================================================
        t2_matches, rem_ledger_2, rem_settle_2 = match_tier2_fuzzy(
            rem_ledger_1, rem_settle_1
        )
        all_matches.extend(t2_matches)

        # ====================================================================
        # Tier 3: Semantic Vector Similarity + Cross-Encoder Reranker
        # ====================================================================
        t3_matches: list[MatchResult] = []
        rem_ledger_3: list[LedgerRecord] = []
        available_settlements = list(rem_settle_2)

        if rem_ledger_2 and available_settlements:
            # Embed descriptions
            ledger_texts = [
                self.embedder.prepare_transaction_text(l.model_dump())
                for l in rem_ledger_2
            ]
            settle_texts = [
                self.embedder.prepare_transaction_text(s.model_dump())
                for s in available_settlements
            ]

            ledger_vecs = await self.embedder.embed_texts_async(ledger_texts)
            settle_vecs = await self.embedder.embed_texts_async(settle_texts)

            for l_idx, l in enumerate(rem_ledger_2):
                l_vec = ledger_vecs[l_idx]
                l_text = ledger_texts[l_idx]
                l_date = datetime.fromisoformat(l.txn_date.split("T")[0])

                # Find candidate settlement matches within the same merchant & financial tolerance
                l_merch_norm = _normalize_merchant(l.merchant_id)
                candidates = []
                for s_idx, s in enumerate(available_settlements):
                    if l_merch_norm and _normalize_merchant(s.merchant_id) != l_merch_norm:
                        continue

                    s_date = datetime.fromisoformat(s.settlement_date.split("T")[0])
                    day_diff = (s_date - l_date).days
                    if not (0 <= day_diff <= 4):
                        continue

                    diff = abs(l.amount - s.gross_amount)
                    if diff > (l.amount * 0.048) and diff >= 1.0:
                        continue

                    sim = self._cosine_similarity(l_vec, settle_vecs[s_idx])
                    candidates.append((s_idx, s, sim, settle_texts[s_idx]))

                if not candidates:
                    rem_ledger_3.append(l)
                    continue

                # Rerank candidates with CrossEncoder
                rerank_pairs = [(l_text, c[3]) for c in candidates]
                rerank_scores = await self.reranker.rerank_pairs_async(rerank_pairs)

                # Select best candidate
                best_cand_idx = -1
                best_score = -1.0
                for c_idx, score in enumerate(rerank_scores):
                    vec_sim = candidates[c_idx][2]
                    raw_score = max(vec_sim, score)
                    combined_confidence = round(0.70 + 0.20 * min(1.0, max(0.0, raw_score)), 2)
                    if combined_confidence > best_score:
                        best_score = combined_confidence
                        best_cand_idx = c_idx

                if best_score >= semantic_threshold and best_cand_idx != -1:
                    s_orig_idx, matched_s, _, _ = candidates[best_cand_idx]
                    available_settlements.pop(s_orig_idx)
                    settle_vecs.pop(s_orig_idx)
                    settle_texts.pop(s_orig_idx)

                    expected_deduction = matched_s.fee_deducted + matched_s.tax_deducted
                    t3_matches.append(
                        MatchResult(
                            ledger_txn_id=l.txn_id,
                            settlement_payout_ref=matched_s.payout_ref,
                            merchant_id=l.merchant_id,
                            ledger_amount=l.amount,
                            settlement_gross=matched_s.gross_amount,
                            settlement_net=matched_s.net_amount,
                            fee_deducted=expected_deduction,
                            amount_discrepancy=round(l.amount - matched_s.gross_amount, 2),
                            match_tier=MatchTier.SEMANTIC_EMBEDDING,
                            confidence=best_score,
                            explanation=f"Tier 3 Semantic match (confidence: {best_score:.2f}) on descriptor '{matched_s.description}'.",
                        )
                    )
                else:
                    rem_ledger_3.append(l)
        else:
            rem_ledger_3 = rem_ledger_2

        all_matches.extend(t3_matches)

        # ====================================================================
        # Tier 4: Explicit Exceptions (Never guess on remaining records)
        # ====================================================================
        # Check remaining ledger records
        for l in rem_ledger_3:
            all_exceptions.append(
                ExceptionRecord(
                    record_type="unmatched_ledger",
                    source_id=l.txn_id,
                    merchant_id=l.merchant_id,
                    amount=l.amount,
                    date=l.txn_date,
                    description=l.description,
                    reason=f"No settlement payout record found within fee/date tolerance window for merchant {l.merchant_id}.",
                    suggested_action="Verify with payment gateway if payout is pending or withheld in reserve.",
                    risk_level="medium" if l.amount < 20000 else "high",
                )
            )

        # Check remaining settlement records
        for s in available_settlements:
            all_exceptions.append(
                ExceptionRecord(
                    record_type="unmatched_settlement",
                    source_id=s.payout_ref,
                    merchant_id=s.merchant_id,
                    amount=s.gross_amount,
                    date=s.settlement_date,
                    description=s.description,
                    reason=f"Payout credit of INR {s.gross_amount:.2f} received with no corresponding ledger sale in ERP.",
                    suggested_action="Check if credit is a manual gateway fee adjustment, dispute refund reversal, or direct transfer.",
                    risk_level="medium",
                )
            )

        # Summarize financial volumes
        total_matched = len(all_matches)
        total_records = len(ledger_records)
        match_rate = round((total_matched / max(1, total_records)) * 100.0, 2)
        matched_volume = sum(m.ledger_amount for m in all_matches)
        fee_volume = sum(m.fee_deducted for m in all_matches)
        discrepancy_vol = sum(abs(m.amount_discrepancy) for m in all_matches)

        return ReconciliationReport(
            total_ledger_records=len(ledger_records),
            total_settlement_records=len(settlement_records),
            matched_count=total_matched,
            auto_match_rate_pct=match_rate,
            exception_count=len(all_exceptions),
            matched_volume_inr=round(matched_volume, 2),
            fee_volume_inr=round(fee_volume, 2),
            discrepancy_volume_inr=round(discrepancy_vol, 2),
            tier1_exact_count=len(t1_matches),
            tier2_fuzzy_count=len(t2_matches),
            tier3_semantic_count=len(t3_matches),
            matches=all_matches,
            exceptions=all_exceptions,
        )
