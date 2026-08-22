"""Cross-Encoder Reranker for Candidate Transaction Pairs.

Lifted and adapted from RIP core/search/reranker.py.
Uses cross-encoder/ms-marco-MiniLM-L-6-v2 to evaluate candidate financial pairs.
"""

from __future__ import annotations

import asyncio
from typing import Any


class CrossEncoderReranker:
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model_name = model_name
        self._model = None

    @property
    def model(self):
        if self._model is None:
            try:
                from sentence_transformers import CrossEncoder
                self._model = CrossEncoder(self.model_name)
            except Exception:
                self._model = None
        return self._model

    def rerank_pairs(self, pairs: list[tuple[str, str]]) -> list[float]:
        """Scores candidate (ledger_text, settlement_text) pairs."""
        if not pairs:
            return []

        if self.model is not None:
            scores = self.model.predict(pairs, show_progress_bar=False)
            return [float(s) for s in scores]

        # Lexical Jaccard fallback if ML model is unavailable
        scores = []
        for text_a, text_b in pairs:
            set_a = set(text_a.lower().split())
            set_b = set(text_b.lower().split())
            intersection = len(set_a & set_b)
            union = max(1, len(set_a | set_b))
            scores.append(intersection / union)
        return scores

    async def rerank_pairs_async(self, pairs: list[tuple[str, str]]) -> list[float]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self.rerank_pairs, pairs)
