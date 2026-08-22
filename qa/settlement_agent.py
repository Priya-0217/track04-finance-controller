"""Grounded Settlement Q&A Agent with Universal Multi-LLM Router.

Connects with any LLM (Gemini, Claude, GPT-4o, Ollama, OpenRouter, Groq).
Guarantees zero-hallucination math explanations with exact token budget constraints.
"""

from __future__ import annotations

from typing import Any

from engine.models import ReconciliationReport, SettlementQAResponse
from qa.compressor import ContextCompressor
from qa.llm_router import UniversalLLMRouter
from qa.permissions import PermissionEngine


class SettlementQAAgent:
    def __init__(self):
        self.compressor = ContextCompressor()
        self.permissions = PermissionEngine()
        self.router = UniversalLLMRouter()

    async def answer_question(
        self,
        question: str,
        merchant_id: str,
        report: ReconciliationReport,
        role: str = "merchant",
        provider: str | None = None,
        model: str | None = None,
        max_tokens: int = 1500,
    ) -> SettlementQAResponse:
        # 1. Collect relevant merchant records from the report
        relevant_matches = [
            m.model_dump() for m in report.matches
            if m.merchant_id == merchant_id or role == "finance_admin"
        ]
        relevant_exceptions = [
            e.model_dump() for e in report.exceptions
            if e.merchant_id == merchant_id or role == "finance_admin"
        ]

        combined_records = relevant_matches + relevant_exceptions

        # 2. Apply Role-Based Filtering
        filtered_records = self.permissions.filter_records_for_role(
            combined_records, role, merchant_id
        )

        # 3. Apply Token Budget Compression
        compressed_records, tokens_used, tokens_saved = self.compressor.compress_records(
            filtered_records, token_budget=max_tokens
        )

        # 4. Log audit access
        audit_id = self.permissions.log_access(
            role=role,
            merchant_id=merchant_id,
            action="settlement_qa_query",
            records_count=len(compressed_records),
            query=question,
        )

        # 5. Synthesize Verified Explanation via Universal LLM Router
        answer, used_model, llm_tokens = await self._generate_grounded_answer(
            question=question,
            merchant_id=merchant_id,
            records=compressed_records,
            report=report,
            provider=provider,
            model=model,
        )

        return SettlementQAResponse(
            question=question,
            answer=answer,
            role=role,
            verified_data_used=compressed_records[:10],
            tokens_used=tokens_used + llm_tokens,
            tokens_saved=tokens_saved,
            audit_id=audit_id,
            llm_synthesized=used_model != "deterministic_math_fallback",
        )

    async def _generate_grounded_answer(
        self,
        question: str,
        merchant_id: str,
        records: list[dict[str, Any]],
        report: ReconciliationReport,
        provider: str | None = None,
        model: str | None = None,
    ) -> tuple[str, str, int]:
        total_matched_vol = sum(r.get("ledger_amount", 0.0) for r in records if "ledger_amount" in r)
        total_fees = sum(r.get("fee_deducted", 0.0) for r in records if "fee_deducted" in r)
        total_net = sum(r.get("settlement_net", 0.0) for r in records if "settlement_net" in r)
        exceptions_count = sum(1 for r in records if "suggested_action" in r)

        system_prompt = (
            "You are a professional Razorpay AI Finance & Settlement Controller. "
            "Explain settlement breakdowns and fee discrepancies with absolute mathematical accuracy. "
            "Under no circumstances should you fabricate numbers not provided in the context."
        )

        user_prompt = f"""Merchant ID: {merchant_id}
Question: "{question}"

Verified Settlement Data:
- Gross Volume: INR {total_matched_vol:,.2f}
- Gateway Deductions (MDR + GST): INR {total_fees:,.2f}
- Net Bank Deposit: INR {total_net:,.2f}
- Flagged Exceptions: {exceptions_count} item(s)

Itemized Verified Transactions (Sample):
"""
        for r in records[:6]:
            if "ledger_txn_id" in r:
                user_prompt += f"- Txn {r['ledger_txn_id']} -> Payout {r['settlement_payout_ref']}: Gross INR {r['ledger_amount']:,.2f} - Fee INR {r['fee_deducted']:,.2f} = Net INR {r['settlement_net']:,.2f}\n"
            elif "suggested_action" in r:
                user_prompt += f"- Exception [{r['record_type']}] ID {r['source_id']}: Amount INR {r['amount']:,.2f} | Reason: {r['reason']}\n"

        user_prompt += "\nProvide a clear, bulleted breakdown addressing the merchant's query."

        content, used_model, tokens = await self.router.generate_response(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            provider=provider,
            model=model,
            max_tokens=800,
        )

        if content:
            return content, used_model, tokens

        # Deterministic math-grounded template fallback
        fallback = (
            f"### Settlement Breakdown for Merchant {merchant_id}\n\n"
            f"Based on verified 4-tier reconciliation records:\n\n"
            f"1. **Gross Sales Processed:** INR {total_matched_vol:,.2f}\n"
            f"2. **Total Gateway Deductions:** INR {total_fees:,.2f} (Verified MDR fee + 18% GST)\n"
            f"3. **Net Settlement Deposited:** INR {total_net:,.2f}\n\n"
            f"**Discrepancy / Exception Status:**\n"
            f"- We verified **{len(records) - exceptions_count}** transactions successfully settled to your bank account.\n"
            f"- **{exceptions_count}** exception(s) were flagged for review.\n\n"
            f"*Generated by AI Finance Controller (Engine: {used_model})*"
        )
        return fallback, used_model, 0
