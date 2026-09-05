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

                    fee_val = round(matched_s.fee_deducted + matched_s.tax_deducted, 2)
                    amount_gap = round(l.amount - matched_s.gross_amount, 2)
                    real_fee = fee_val if fee_val > 0.0 else (amount_gap if amount_gap > 0.0 else 0.0)

                    t3_matches.append(
                        MatchResult(
                            ledger_txn_id=l.txn_id,
                            settlement_payout_ref=matched_s.payout_ref,
                            merchant_id=l.merchant_id,
                            ledger_amount=l.amount,
                            settlement_gross=matched_s.gross_amount,
                            settlement_net=matched_s.net_amount,
                            fee_deducted=real_fee,
                            amount_discrepancy=amount_gap,
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
        # Tier 4: Explicit Differentiated Exceptions (Never guess on money)
        # ====================================================================
        matched_txn_ids_set = {m.ledger_txn_id for m in all_matches}
        rem_ledger_ids_map = {l.txn_id: l for l in rem_ledger_3}
        from engine.matcher_rules import _extract_txn_ref

        # Check remaining settlement records
        for s in available_settlements:
            ref_found = _extract_txn_ref(s.payout_ref) or _extract_txn_ref(s.description)
            desc_lower = (s.description or "").lower()

            if "lump" in desc_lower or "lump" in s.payout_ref.lower():
                all_exceptions.append(
                    ExceptionRecord(
                        record_type="merged_settlement",
                        source_id=s.payout_ref,
                        merchant_id=s.merchant_id,
                        amount=s.gross_amount,
                        date=s.settlement_date,
                        description=s.description,
                        reason=f"Merged lump-sum payout: Bank credit INR {s.gross_amount:,.2f} consolidates multiple ledger sales into a single batch deposit.",
                        suggested_action="Split lump settlement across constituent ledger order lines to close open receivables.",
                        risk_level="medium",
                    )
                )
            elif "partial" in desc_lower or "-p1" in s.payout_ref.lower() or "-p2" in s.payout_ref.lower() or "split" in desc_lower:
                all_exceptions.append(
                    ExceptionRecord(
                        record_type="split_settlement",
                        source_id=s.payout_ref,
                        merchant_id=s.merchant_id,
                        amount=s.gross_amount,
                        date=s.settlement_date,
                        description=s.description,
                        reason=f"Split settlement installment for transaction {ref_found or s.payout_ref}: Bank credit INR {s.gross_amount:,.2f} received as part of a multi-tranche payout.",
                        suggested_action="Aggregate matching split settlement tranches to reconcile full parent ledger balance.",
                        risk_level="medium",
                    )
                )
            elif ref_found and ref_found in matched_txn_ids_set:
                all_exceptions.append(
                    ExceptionRecord(
                        record_type="duplicate_settlement",
                        source_id=s.payout_ref,
                        merchant_id=s.merchant_id,
                        amount=s.gross_amount,
                        date=s.settlement_date,
                        description=s.description,
                        reason=f"Duplicate settlement payout notice detected for transaction {ref_found} (primary record already matched in ERP).",
                        suggested_action="Flag duplicate bank payout notice to prevent double-crediting general ledger.",
                        risk_level="high",
                    )
                )
            elif ref_found and ref_found in rem_ledger_ids_map:
                l_target = rem_ledger_ids_map[ref_found]
                diff = abs(l_target.amount - s.gross_amount)
                all_exceptions.append(
                    ExceptionRecord(
                        record_type="wrong_amount_mismatch",
                        source_id=s.payout_ref,
                        merchant_id=s.merchant_id,
                        amount=s.gross_amount,
                        date=s.settlement_date,
                        description=s.description,
                        reason=f"Amount mismatch for transaction {ref_found}: Ledger INR {l_target.amount:,.2f} vs Bank INR {s.gross_amount:,.2f} (diff: INR {diff:,.2f} exceeds tolerance).",
                        suggested_action="Audit gateway fee contract and initiate merchant discrepancy query.",
                        risk_level="high",
                    )
                )
            else:
                all_exceptions.append(
                    ExceptionRecord(
                        record_type="unmatched_settlement",
                        source_id=s.payout_ref,
                        merchant_id=s.merchant_id,
                        amount=s.gross_amount,
                        date=s.settlement_date,
                        description=s.description,
                        reason=f"Unmapped incoming bank credit of INR {s.gross_amount:,.2f} with no corresponding ERP ledger order.",
                        suggested_action="Check if credit is a manual gateway fee adjustment, dispute refund reversal, or direct transfer.",
                        risk_level="medium",
                    )
                )

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
                    reason=f"In-transit ledger sale for merchant {l.merchant_id} awaiting bank settlement payout beyond clearing window.",
                    suggested_action="Verify with payment gateway if payout is in-transit or withheld in reserve.",
                    risk_level="medium" if l.amount < 20000 else "high",
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
