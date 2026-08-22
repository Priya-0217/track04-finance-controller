"""Token Budget Compressor for Financial Q&A Context.

Lifted and adapted from Context Gateway gateway/core/ranker/compressor.py.
Enforces hard tiktoken limits (cl100k_base) to ensure financial prompt context never exceeds limits.
"""

from __future__ import annotations

import tiktoken


class TokenCounter:
    def __init__(self, encoding_name: str = "cl100k_base"):
        try:
            self.encoding = tiktoken.get_encoding(encoding_name)
        except Exception:
            self.encoding = None

    def count(self, text: str) -> int:
        if not text:
            return 0
        if self.encoding:
            return len(self.encoding.encode(text))
        return len(text.split()) * 2  # Heuristic fallback


class ContextCompressor:
    def __init__(self):
        self.counter = TokenCounter()

    def compress_records(
        self,
        records: list[dict],
        token_budget: int = 1500,
    ) -> tuple[list[dict], int, int]:
        """Greedily fits highest-priority financial records into token budget."""
        included = []
        tokens_used = 0
        total_raw_tokens = 0

        for r in records:
            # Format record as concise text
            text_repr = " | ".join(f"{k}:{v}" for k, v in r.items())
            record_tokens = self.counter.count(text_repr)
            total_raw_tokens += record_tokens

            if tokens_used + record_tokens <= token_budget:
                included.append(r)
                tokens_used += record_tokens

        tokens_saved = max(0, total_raw_tokens - tokens_used)
        return included, tokens_used, tokens_saved
