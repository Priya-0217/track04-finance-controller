"""Model Context Protocol (MCP) Stdio Server for Razorpay AI Finance Controller.

RFC-Compliant MCP stdio server compatible with Claude Desktop, Cursor, Claude Code, and Windsurf.
Handles initialize, notifications, tools/list, and tools/call.
"""

from __future__ import annotations

import asyncio
import csv
import json
import sys
from pathlib import Path
from typing import Any

# Ensure project root is in sys.path
PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from engine.auto_audit import AutoAuditAgent
from engine.disputes import DisputeManager
from engine.fee_rules import DEFAULT_FEE_SCHEDULES, PaymentInstrument
from engine.forecaster import ForwardCashForecaster
from engine.merchants import MerchantManager
from engine.models import LedgerRecord, SettlementRecord
from engine.payout_engine import PayoutEngine
from engine.reconciler import ReconciliationEngine
from qa.settlement_agent import SettlementQAAgent

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

reconciler = ReconciliationEngine()
qa_agent = SettlementQAAgent()
audit_agent = AutoAuditAgent()
merchant_mgr = MerchantManager()
dispute_mgr = DisputeManager()
payout_engine = PayoutEngine()
forecaster = ForwardCashForecaster()


def _get_records():
    l_path = DATA_DIR / "ledger.csv"
    s_path = DATA_DIR / "settlement.csv"

    if not l_path.exists() or not s_path.exists():
        from data.generate_synthetic_data import save_csv_and_json
        save_csv_and_json(DATA_DIR)

    with open(l_path, "r", encoding="utf-8") as f:
        ledger_records = [LedgerRecord(**r) for r in csv.DictReader(f)]

    with open(s_path, "r", encoding="utf-8") as f:
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
    return ledger_records, settle_records


TOOLS_METADATA = [
    {
        "name": "finance_reconcile_batch",
        "description": "Execute 4-tier automated reconciliation across ERP ledger and bank settlement reports. Performs Tier 1 Exact Txn ID matching, Tier 2 Fuzzy Tolerance matching (amount +-3%, date <= 3 days), Tier 3 Semantic Vector embedding + Cross-Encoder reranking, and isolates Tier 4 anomalies. Returns auto-match rate, gross volume, verified fee deductions, and exception count.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "semantic_threshold": {
                    "type": "number",
                    "description": "Minimum confidence threshold for semantic vector matches (0.0 to 1.0, default: 0.70)"
                }
            },
            "required": []
        }
    },
    {
        "name": "finance_ask_settlement",
        "description": "Ask a natural language settlement or fee question for a specific merchant. Enforces Role-Based Access Control (RBAC) and uses tiktoken knapsack compression to provide verified, zero-hallucination mathematical answers.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "The settlement or discrepancy question (e.g. 'Why did I receive INR 9,400 instead of INR 10,000?')"
                },
                "merchant_id": {
                    "type": "string",
                    "description": "Merchant ID e.g. merch_001, merch_002, merch_003"
                },
                "role": {
                    "type": "string",
                    "enum": ["merchant", "support_agent", "finance_admin"],
                    "description": "Role authorization level for data filtering (merchant only sees their own data)"
                }
            },
            "required": ["question"]
        }
    },
    {
        "name": "finance_get_cash_position",
        "description": "Get real-time liquid cash deposited in bank, in-transit (T+1/T+2) gateway receivables, payment processing fee drag (MDR + GST), and disputed holdbacks.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "finance_auto_audit",
        "description": "Run an automated AI financial audit over all transactions. Detects fee overcharges against contract schedules, identifies payouts trapped in transit beyond T+3 days, and calculates a Financial Health Score (0-100).",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "finance_get_exceptions",
        "description": "Retrieve unresolved exceptions and anomalies (pending payouts, decimal typos, missing bank credits) with structured human-readable reasons and recommended actions.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "merchant_id": {
                    "type": "string",
                    "description": "Optional merchant ID filter (e.g. merch_001)"
                },
                "risk_level": {
                    "type": "string",
                    "enum": ["high", "medium", "low"],
                    "description": "Optional risk level filter"
                }
            },
            "required": []
        }
    },
    {
        "name": "finance_list_merchants",
        "description": "Retrieve all registered merchant accounts, contract fee tiers (standard retail, enterprise discount, saas startup), settlement cycles (T+1, T+2), KYC status, and risk ratings.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "finance_simulate_transaction",
        "description": "Simulate an incoming merchant payment across payment instruments (UPI, Debit Card, Credit Card, Corporate, International). Automatically computes tiered MDR processing fee + 18% GST and appends to ledger and settlement records to balance the books dynamically.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "amount": {
                    "type": "number",
                    "description": "Gross transaction amount in INR"
                },
                "merchant_id": {
                    "type": "string",
                    "description": "Target merchant ID (e.g. merch_001)"
                },
                "instrument": {
                    "type": "string",
                    "enum": ["upi", "debit_card", "credit_card", "corporate_card", "international"],
                    "description": "Payment instrument rail"
                },
                "description": {
                    "type": "string",
                    "description": "Transaction description (e.g. 'Enterprise Cloud License')"
                }
            },
            "required": ["amount"]
        }
    },
    {
        "name": "finance_list_disputes",
        "description": "List all active payment chargebacks, customer dispute reasons, and reserve holdback statuses across merchants.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "merchant_id": {
                    "type": "string",
                    "description": "Optional merchant filter"
                }
            },
            "required": []
        }
    },
    {
        "name": "finance_resolve_dispute",
        "description": "Resolve an active payment dispute (mark as won or lost) and release or forfeit the reserved holdback funds.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "dispute_id": {
                    "type": "string",
                    "description": "Dispute ID (e.g. disp_001, disp_002)"
                },
                "outcome": {
                    "type": "string",
                    "enum": ["won", "lost"],
                    "description": "Outcome of the dispute review ('won' releases holdback to merchant; 'lost' confirms chargeback deduction)"
                }
            },
            "required": ["dispute_id"]
        }
    },
    {
        "name": "finance_simulate_fees",
        "description": "Calculate exact MDR processing fee and 18% GST deduction for any amount across payment rails.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "amount": {
                    "type": "number",
                    "description": "Gross transaction amount in INR"
                },
                "instrument": {
                    "type": "string",
                    "enum": ["upi", "debit_card", "credit_card", "corporate_card", "international"],
                    "description": "Payment rail"
                }
            },
            "required": ["amount"]
        }
    },
    {
        "name": "finance_get_forecast",
        "description": "Project future cash position and bank balance over a 7-day to 30-day horizon. Incorporates current liquid balance, pending ledger receivables by payment rail lag (UPI T+0, Debit T+1, Credit T+2), dynamic MDR fee deductions + 18% GST, and Indian RBI Bank Holiday / weekend clearing rollovers.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "horizon_days": {
                    "type": "integer",
                    "description": "Forecast horizon in days (default: 7, max: 30)"
                },
                "merchant_id": {
                    "type": "string",
                    "description": "Optional merchant ID filter (e.g. merch_001)"
                }
            },
            "required": []
        }
    }
]


def handle_tool_call(name: str, args: dict[str, Any]) -> dict[str, Any]:
    ledger, settle = _get_records()

    if name == "finance_reconcile_batch":
        threshold = float(args.get("semantic_threshold", 0.70))
        report = asyncio.run(reconciler.reconcile_batch(ledger, settle, semantic_threshold=threshold))
        res_text = (
            f"### 4-Tier Reconciliation Summary\n"
            f"- **Auto-Match Rate:** {report.auto_match_rate_pct}%\n"
            f"- **Total Processed:** {report.total_ledger_records} records\n"
            f"- **Matched Records:** {report.matched_count} (Tier 1 Exact: {report.tier1_exact_count}, Tier 2 Fuzzy: {report.tier2_fuzzy_count}, Tier 3 Semantic: {report.tier3_semantic_count})\n"
            f"- **Flagged Exceptions:** {report.exception_count}\n"
            f"- **Gross Sales Matched:** INR {report.matched_volume_inr:,.2f}\n"
            f"- **Gateway Fees Deducted:** INR {report.fee_volume_inr:,.2f}\n"
            f"- **Net Verified Bank Settlement:** INR {report.matched_volume_inr - report.fee_volume_inr:,.2f}"
        )
        return {"content": [{"type": "text", "text": res_text}], "isError": False}

    elif name == "finance_ask_settlement":
        question = args.get("question", "")
        merchant_id = args.get("merchant_id", "merch_001")
        role = args.get("role", "merchant")
        report = asyncio.run(reconciler.reconcile_batch(ledger, settle))
        ans = asyncio.run(qa_agent.answer_question(question=question, merchant_id=merchant_id, report=report, role=role))
        return {"content": [{"type": "text", "text": f"{ans.answer}\n\n[Tokens Used: {ans.tokens_used} | Tokens Saved: {ans.tokens_saved} | Audit ID: {ans.audit_id}]"}], "isError": False}

    elif name == "finance_get_cash_position":
        report = asyncio.run(reconciler.reconcile_batch(ledger, settle))
        settled_net = report.matched_volume_inr - report.fee_volume_inr
        in_transit = sum(e.amount for e in report.exceptions if e.record_type == "unmatched_ledger")
        disputed = sum(e.amount for e in report.exceptions if e.record_type == "unmatched_settlement")

        res_text = (
            f"### Real-Time Cash Position & Books Status\n"
            f"1. **Liquid Cash in Bank (100% Settled):** INR {settled_net:,.2f}\n"
            f"2. **In-Transit Receivables (T+1/T+2 Cycle):** INR {in_transit:,.2f}\n"
            f"3. **Gateway MDR Fee Drag:** INR {report.fee_volume_inr:,.2f}\n"
            f"4. **Disputed / Holdback Credits:** INR {disputed:,.2f}"
        )
        return {"content": [{"type": "text", "text": res_text}], "isError": False}

    elif name == "finance_auto_audit":
        report = asyncio.run(reconciler.reconcile_batch(ledger, settle))
        audit = audit_agent.audit_batch(report)
        findings_md = "\n".join([f"- **[{f.severity}]** {f.category} (Impact: INR {f.impact_amount_inr:,.2f}): {f.description} — *Action: {f.recommended_action}*" for f in audit.findings])
        res_text = (
            f"### AI Financial Audit Report (Health Score: {audit.financial_health_score}/100)\n"
            f"- **Auto-Match Rate:** {audit.reconciliation_match_rate}%\n"
            f"- **Audited Volume:** INR {audit.total_audited_volume_inr:,.2f}\n"
            f"- **Fee Leakage Detected:** INR {audit.fee_leakage_detected_inr:,.2f}\n"
            f"- **Unsettled Funds at Risk:** INR {audit.funds_at_risk_inr:,.2f}\n\n"
            f"#### Key Findings:\n{findings_md}"
        )
        return {"content": [{"type": "text", "text": res_text}], "isError": False}

    elif name == "finance_list_merchants":
        merchants = merchant_mgr.list_merchants()
        lines = [f"- **{m['business_name']}** (`{m['merchant_id']}`) | Fee Tier: {m['fee_tier']} | Cycle: {m['settlement_cycle']} | Risk: {m['risk_rating'].upper()}" for m in merchants]
        res_text = "### Merchant Accounts & Fee Schedules\n" + "\n".join(lines)
        return {"content": [{"type": "text", "text": res_text}], "isError": False}

    elif name == "finance_simulate_transaction":
        amt = float(args.get("amount", 0.0))
        m_id = args.get("merchant_id", "merch_001")
        inst = args.get("instrument", "upi")
        desc = args.get("description", "Order Checkout")
        res = payout_engine.simulate_and_ingest_transaction(merchant_id=m_id, amount=amt, description=desc, instrument=inst)
        res_text = (
            f"### Ingested Live Transaction: {res['txn_id']}\n"
            f"- **Payout Reference:** `{res['payout_ref']}`\n"
            f"- **Merchant:** `{res['merchant_id']}`\n"
            f"- **Payment Instrument:** {res['instrument'].upper()}\n"
            f"- **Gross Amount:** INR {res['gross_amount']:,.2f}\n"
            f"- **Base MDR Fee:** INR {res['fee_deducted']:,.2f}\n"
            f"- **GST on Processing (18%):** INR {res['gst_deducted']:,.2f}\n"
            f"- **Net Merchant Settlement:** INR {res['net_amount']:,.2f}\n"
            f"- **Bank UTR:** `{res['utr']}`"
        )
        return {"content": [{"type": "text", "text": res_text}], "isError": False}

    elif name == "finance_list_disputes":
        m_id = args.get("merchant_id")
        disputes = dispute_mgr.list_disputes(merchant_id=m_id)
        lines = [f"- **Dispute `{d['dispute_id']}`** (Merchant: `{d['merchant_id']}`, INR {d['amount']:,.2f}) — Status: {d['status'].upper()}, Holdback Active: {d['holdback_active']} | Reason: {d['reason']}" for d in disputes]
        res_text = f"### Payment Disputes & Holdbacks ({len(disputes)} items)\n" + "\n".join(lines)
        return {"content": [{"type": "text", "text": res_text}], "isError": False}

    elif name == "finance_resolve_dispute":
        d_id = args.get("dispute_id", "")
        outcome = args.get("outcome", "won")
        res = dispute_mgr.resolve_dispute(d_id, outcome=outcome)
        if res:
            res_text = f"### Dispute {d_id} Resolved\n- **Status:** {res['status'].upper()}\n- **Holdback Active:** {res['holdback_active']}\n- **Outcome:** Merchant {outcome.upper()}"
        else:
            res_text = f"Dispute {d_id} not found."
        return {"content": [{"type": "text", "text": res_text}], "isError": False}

    elif name == "finance_get_exceptions":
        report = asyncio.run(reconciler.reconcile_batch(ledger, settle))
        filtered = report.exceptions
        m_id = args.get("merchant_id")
        risk = args.get("risk_level")
        if m_id:
            filtered = [e for e in filtered if e.merchant_id == m_id]
        if risk:
            filtered = [e for e in filtered if e.risk_level.lower() == risk.lower()]

        items = [f"- **[{e.record_type.upper()}]** `{e.source_id}` (Merchant: {e.merchant_id}, Amount: INR {e.amount:,.2f}) — *{e.reason}* (Suggested Action: {e.suggested_action})" for e in filtered]
        res_text = f"### Flagged Financial Exceptions ({len(filtered)} items)\n" + "\n".join(items)
        return {"content": [{"type": "text", "text": res_text}], "isError": False}

    elif name == "finance_simulate_fees":
        amount = float(args.get("amount", 0.0))
        inst_str = args.get("instrument", "credit_card")
        inst = PaymentInstrument(inst_str) if inst_str in [p.value for p in PaymentInstrument] else PaymentInstrument.STANDARD_MDR
        schedule = DEFAULT_FEE_SCHEDULES.get(inst, DEFAULT_FEE_SCHEDULES[PaymentInstrument.STANDARD_MDR])
        base_fee, gst, total_ded = schedule.calculate_deduction(amount)
        net = round(amount - total_ded, 2)

        res_text = (
            f"### Fee Deduction Simulation for INR {amount:,.2f} ({inst.value.upper()})\n"
            f"- **Base Gateway MDR Fee ({schedule.mdr_rate_pct}%):** INR {base_fee:,.2f}\n"
            f"- **GST on Processing Fee (18%):** INR {gst:,.2f}\n"
            f"- **Total Deduction:** INR {total_ded:,.2f}\n"
            f"- **Net Merchant Settlement:** INR {net:,.2f}"
        )
        return {"content": [{"type": "text", "text": res_text}], "isError": False}

    elif name == "finance_get_forecast":
        horizon = int(args.get("horizon_days", 7))
        m_id = args.get("merchant_id")
        report = asyncio.run(reconciler.reconcile_batch(ledger, settle))
        fc = forecaster.calculate_forecast(report, horizon_days=horizon, merchant_id=m_id)

        rows_md = "\n".join([
            f"- **Day {p.day_offset} ({p.day_name}, {p.forecast_date}):** Net Settlement: +INR {p.projected_net_settlement_inr:,.2f} | **Projected Ending Balance:** INR {p.ending_balance_inr:,.2f} {'[HOLIDAY / WEEKEND]' if p.is_bank_holiday else ''}"
            for p in fc.daily_projections
        ])
        alerts_md = "\n".join([f"- **[{a.severity}]** {a.title}: {a.description}" for a in fc.alerts]) or "None"

        res_text = (
            f"### {fc.forecast_horizon_days}-Day Forward Cash Forecast\n"
            f"- **Current Verified Liquid Balance:** INR {fc.current_liquid_balance_inr:,.2f}\n"
            f"- **Projected Ending Balance ({fc.forecast_horizon_days} Days):** INR {fc.projected_ending_balance_inr:,.2f}\n"
            f"- **Net Liquidity Change:** INR {fc.net_liquidity_change_inr:+,.2f}\n"
            f"- **Total Inflows Expected:** INR {fc.total_projected_inflow_inr:,.2f}\n"
            f"- **Total Fee Deductions (MDR + GST):** INR {fc.total_projected_fee_drag_inr:,.2f}\n\n"
            f"#### Day-by-Day Projection:\n{rows_md}\n\n"
            f"#### Treasury & Clearing Alerts:\n{alerts_md}\n\n"
            f"**Recommendation:** {fc.treasury_recommendation}"
        )
        return {"content": [{"type": "text", "text": res_text}], "isError": False}

    return {"content": [{"type": "text", "text": f"Unknown tool: {name}"}], "isError": True}


def main():
    """RFC-compliant JSON-RPC 2.0 stdio loop for MCP clients."""
    # Ensure stdout is in unbuffered UTF-8 mode
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8")

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            req_id = req.get("id")
            method = req.get("method")

            # Notification handling: JSON-RPC 2.0 mandates NO response for notifications (where id is None)
            if req_id is None:
                continue

            if method == "initialize":
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {
                            "tools": {"listChanged": False}
                        },
                        "serverInfo": {
                            "name": "razorpay-finance-controller",
                            "version": "1.0.0"
                        }
                    }
                }
            elif method == "tools/list":
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "tools": TOOLS_METADATA
                    }
                }
            elif method == "tools/call":
                params = req.get("params", {})
                tool_name = params.get("name", "")
                tool_args = params.get("arguments", {})
                tool_res = handle_tool_call(tool_name, tool_args)
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": tool_res
                }
            elif method == "ping":
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {}
                }
            else:
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {
                        "code": -32601,
                        "message": f"Method '{method}' not found"
                    }
                }

            sys.stdout.write(json.dumps(res, ensure_ascii=False) + "\n")
            sys.stdout.flush()
        except Exception as e:
            if req_id is not None:
                err_res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {
                        "code": -32603,
                        "message": str(e)
                    }
                }
                sys.stdout.write(json.dumps(err_res, ensure_ascii=False) + "\n")
                sys.stdout.flush()


if __name__ == "__main__":
    main()
