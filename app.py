# -*- coding: utf-8 -*-
"""FastAPI Server & Enterprise Operations Platform for AI Finance Controller.

Production-Grade Architecture:
- Forward Cash Forecaster (7-day to 30-day projection, bank holiday rollovers)
- Full-Context Autonomous AI Assistant with Tool-Calling & Real-Time SSE Token Streaming
- Non-blocking Toast Notification & Modal System (Replaces legacy alerts)
- Reconciled Explorer with Multi-Column Sorting & Client-Side Pagination
- URL Hash-based Navigation & State Deep Linking (#overview, #forecast, #chat, etc.)
- Dynamic Fee Schedules & Merchant Ingestion
- CSV Upload Schema Validation & Backup Safeguards
- Threshold-Aware Health Scoring & Optimistic Dispute Lifecycle
"""

from __future__ import annotations

import asyncio
import csv
import io
import json
import shutil
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from engine.accounting_exporter import AccountingExporter
from engine.agent_copilot import AutonomousFinanceAgent
from engine.alerts_engine import AlertsEngine
from engine.auto_audit import AutoAuditAgent
from engine.config import FinanceConfig
from engine.disputes import DisputeManager
from engine.fee_rules import DEFAULT_FEE_SCHEDULES, PaymentInstrument
from engine.forecaster import ForwardCashForecaster
from engine.merchants import MerchantManager
from engine.models import (
    LedgerRecord,
    ReconciliationReport,
    SettlementQARequest,
    SettlementQAResponse,
    SettlementRecord,
)
from engine.multi_tenant import TenantManager
from engine.payout_engine import PayoutEngine
from engine.reconciler import ReconciliationEngine
from engine.smart_advisor import SmartAdvisor
from engine.trend_analyzer import TrendAnalyzer
from qa.permissions import PermissionEngine
from qa.settlement_agent import SettlementQAAgent

DATA_DIR = Path(__file__).resolve().parent / "data"


reconciler = ReconciliationEngine()
qa_agent = SettlementQAAgent()
permissions = PermissionEngine()
audit_agent = AutoAuditAgent()
merchant_mgr = MerchantManager()
dispute_mgr = DisputeManager()
payout_engine = PayoutEngine()
forecaster = ForwardCashForecaster()
config_mgr = FinanceConfig()
tenant_mgr = TenantManager()
alerts_engine = AlertsEngine()
smart_advisor = SmartAdvisor()
trend_analyzer = TrendAnalyzer()
accounting_exporter = AccountingExporter()

agent_copilot = AutonomousFinanceAgent(
    reconciler=reconciler,
    forecaster=forecaster,
    audit_agent=audit_agent,
    merchant_mgr=merchant_mgr,
    dispute_mgr=dispute_mgr,
    payout_engine=payout_engine,
)


app = FastAPI(
    title="Finance Controller OS",
    description="Automated 4-Tier Financial Reconciliation, Cash Position & Settlement Q&A Engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_latest_report: ReconciliationReport | None = None


def _normalize_row_keys(row: dict[str, Any]) -> dict[str, Any]:
    """Strip whitespace and lowercase all column keys for ultra-resilient CSV parsing."""
    return {k.strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in row.items() if k is not None}


def _load_default_records() -> tuple[list[LedgerRecord], list[SettlementRecord]]:
    ledger_path = DATA_DIR / "ledger.csv"
    settle_path = DATA_DIR / "settlement.csv"

    if not ledger_path.exists() or not settle_path.exists():
        from data.generate_synthetic_data import save_csv_and_json
        save_csv_and_json(DATA_DIR)

    ledger_records = []
    with open(ledger_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, raw_row in enumerate(reader):
            row = _normalize_row_keys(raw_row)
            txn_id = row.get("txn_id") or row.get("id") or row.get("transaction_id") or row.get("ref") or f"TXN_{i+1:04d}"
            merchant_id = row.get("merchant_id") or row.get("merchant") or row.get("merch_id") or row.get("account") or "merch_001"
            amount_val = float(row.get("amount") or row.get("gross_amount") or row.get("gross") or 0.0)
            txn_date = row.get("txn_date") or row.get("date") or row.get("timestamp") or row.get("created_at") or "2026-08-01"
            desc = row.get("description") or row.get("desc") or row.get("narration") or f"Transaction {txn_id}"

            ledger_records.append(
                LedgerRecord(
                    txn_id=txn_id,
                    merchant_id=merchant_id,
                    amount=amount_val,
                    txn_date=txn_date,
                    order_id=row.get("order_id") or row.get("order"),
                    description=desc,
                    currency=row.get("currency") or "INR",
                    customer_name=row.get("customer_name") or row.get("customer") or row.get("merchant"),
                )
            )

    settlement_records = []
    with open(settle_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, raw_row in enumerate(reader):
            row = _normalize_row_keys(raw_row)
            payout_ref = row.get("payout_ref") or row.get("settlement_ref") or row.get("settle_ref") or row.get("ref") or row.get("id") or f"STL_{i+1:04d}"
            merchant_id = row.get("merchant_id") or row.get("merchant") or row.get("merch_id") or row.get("account") or "merch_001"

            raw_amt = float(row.get("gross_amount") or row.get("gross") or row.get("amount") or 0.0)
            raw_fee = float(row.get("fee_deducted") or row.get("fee") or row.get("fees") or row.get("mdr") or 0.0)
            raw_tax = float(row.get("tax_deducted") or row.get("tax") or row.get("gst") or 0.0)
            raw_net = float(row.get("net_amount") or row.get("net") or (raw_amt - raw_fee - raw_tax))

            settle_date = row.get("settlement_date") or row.get("date") or row.get("timestamp") or "2026-08-01"
            desc = row.get("description") or row.get("desc") or row.get("narration") or f"Settlement {payout_ref}"
            matched_id = row.get("matched_txn_id") or row.get("txn_id") or None

            settlement_records.append(
                SettlementRecord(
                    payout_ref=payout_ref,
                    merchant_id=merchant_id,
                    gross_amount=raw_amt,
                    fee_deducted=raw_fee,
                    tax_deducted=raw_tax,
                    net_amount=raw_net,
                    settlement_date=settle_date,
                    utr=row.get("utr") or row.get("utr_no"),
                    description=desc,
                    matched_txn_id=matched_id,
                )
            )

    return ledger_records, settlement_records


async def get_current_report() -> ReconciliationReport:
    """FastAPI Dependency: Ensures singleton cached or freshly generated reconciliation report."""
    global _latest_report
    if _latest_report is None:
        ledger, settle = await asyncio.to_thread(_load_default_records)
        _latest_report = await reconciler.reconcile_batch(ledger, settle)
    return _latest_report


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "finance-controller", "version": "1.0.0"}


@app.get("/api/metrics")
async def get_metrics(report: ReconciliationReport = Depends(get_current_report)):
    settled_net = report.matched_volume_inr - report.fee_volume_inr
    in_transit = sum(e.amount for e in report.exceptions if e.record_type == "unmatched_ledger")
    disputed = sum(e.amount for e in report.exceptions if e.record_type == "unmatched_settlement")

    audit = audit_agent.audit_batch(report)

    return {
        "auto_match_rate_pct": report.auto_match_rate_pct,
        "total_records": report.total_ledger_records,
        "matched_count": report.matched_count,
        "exception_count": report.exception_count,
        "tier1_exact": report.tier1_exact_count,
        "tier2_fuzzy": report.tier2_fuzzy_count,
        "tier3_semantic": report.tier3_semantic_count,
        "gross_volume_inr": report.matched_volume_inr,
        "fee_drag_inr": report.fee_volume_inr,
        "liquid_cash_inr": settled_net,
        "in_transit_receivables_inr": in_transit,
        "disputed_holdbacks_inr": disputed,
        "health_score": audit.financial_health_score,
    }


@app.get("/api/forecast")
async def get_forecast(
    days: int = 7,
    merchant_id: str | None = None,
    report: ReconciliationReport = Depends(get_current_report),
):
    fc = forecaster.calculate_forecast(report, horizon_days=days, merchant_id=merchant_id)
    return fc.to_dict()


@app.get("/api/instruments")
async def get_instruments():
    """Returns dynamic payment instrument schedules with contract MDR & GST."""
    items = []
    for k, v in DEFAULT_FEE_SCHEDULES.items():
        name = k.value.replace("_", " ").title()
        label = (
            f"{name} ({v.mdr_rate_pct}% MDR + {v.gst_rate_pct}% GST)"
            if v.mdr_rate_pct > 0
            else f"{name} (0.00% Zero MDR)"
        )
        items.append({
            "id": k.value,
            "name": name,
            "mdr_rate_pct": v.mdr_rate_pct,
            "fixed_fee_inr": v.fixed_fee_inr,
            "gst_rate_pct": v.gst_rate_pct,
            "label": label,
        })
    return items


@app.get("/api/config")
async def get_config():
    cfg = FinanceConfig.load()
    return {
        "llm_provider": cfg.get("llm_provider", "gemini"),
        "model_id": cfg.get("llm_model", "gemini/gemini-2.5-flash"),
        "has_api_key": bool(cfg.get("api_key")),
        "default_merchant_id": cfg.get("default_merchant", "merch_001"),
        "token_budget": cfg.get("token_budget", 1024),
    }


class UpdateConfigReq(BaseModel):
    llm_provider: str | None = None
    model_id: str | None = None
    api_key: str | None = None
    default_merchant_id: str | None = None
    token_budget: int | None = None


@app.post("/api/config")
async def update_config(req: UpdateConfigReq):
    updates = {}
    if req.llm_provider is not None:
        updates["llm_provider"] = req.llm_provider
    if req.model_id is not None:
        updates["llm_model"] = req.model_id
    if req.api_key is not None:
        updates["api_key"] = req.api_key
    if req.default_merchant_id is not None:
        updates["default_merchant"] = req.default_merchant_id
    if req.token_budget is not None:
        updates["token_budget"] = req.token_budget

    FinanceConfig.save(updates)
    return {"status": "success", "config": await get_config()}


class TestLlmReq(BaseModel):
    llm_provider: str | None = None
    model_id: str | None = None
    api_key: str | None = None


@app.post("/api/config/test")
async def test_llm_config(req: TestLlmReq):
    """Tests live LLM endpoint connectivity and round-trip latency."""
    res = await agent_copilot.router.test_connection(
        provider=req.llm_provider,
        model=req.model_id,
        api_key=req.api_key,
    )
    return res


class ChatReq(BaseModel):
    message: str
    merchant_id: str = "merch_001"
    role: str = "finance_admin"


@app.post("/api/chat")
async def chat_endpoint(
    req: ChatReq,
    report: ReconciliationReport = Depends(get_current_report),
):
    """Full-context autonomous AI assistant with tool-calling capabilities."""
    res = await agent_copilot.execute_query(
        message=req.message,
        merchant_id=req.merchant_id,
        report=report,
        role=req.role,
    )
    return res


@app.post("/api/chat/stream")
async def chat_stream_endpoint(
    req: ChatReq,
    report: ReconciliationReport = Depends(get_current_report),
):
    """Real-time token streaming endpoint for sub-second perceived latency."""
    return StreamingResponse(
        agent_copilot.execute_query_stream(
            message=req.message,
            merchant_id=req.merchant_id,
            report=report,
            role=req.role,
        ),
        media_type="text/event-stream",
    )


@app.get("/api/reconcile-data")
async def get_reconcile_data(report: ReconciliationReport = Depends(get_current_report)):
    return report


@app.get("/api/audit-ai")
async def get_audit_ai(report: ReconciliationReport = Depends(get_current_report)):
    rep = audit_agent.audit_batch(report)
    return {
        "health_score": rep.financial_health_score,
        "match_rate": rep.reconciliation_match_rate,
        "total_volume": rep.total_audited_volume_inr,
        "fee_leakage": rep.fee_leakage_detected_inr,
        "funds_at_risk": rep.funds_at_risk_inr,
        "findings": [
            {
                "severity": f.severity,
                "category": f.category,
                "description": f.description,
                "impact_inr": f.impact_amount_inr,
                "action": f.recommended_action,
            }
            for f in rep.findings
        ],
    }


@app.post("/api/upload-csvs")
async def upload_csvs(
    ledger_file: UploadFile = File(...),
    settlement_file: UploadFile = File(...),
):
    global _latest_report
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    ledger_bytes = await ledger_file.read()
    settle_bytes = await settlement_file.read()

    # Validate Ledger CSV Schema
    try:
        ledger_text = ledger_bytes.decode("utf-8-sig")
        ledger_reader = csv.DictReader(io.StringIO(ledger_text))
        ledger_fields = set(f.strip().lower() for f in (ledger_reader.fieldnames or []))
        has_id = any(c in ledger_fields for c in ("txn_id", "id", "transaction_id", "ref"))
        has_amount = any(c in ledger_fields for c in ("amount", "gross_amount", "gross"))
        if not has_id or not has_amount:
            raise HTTPException(
                status_code=400,
                detail="Invalid ledger.csv format. Must include transaction identifier and amount columns.",
            )
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Ledger CSV must be UTF-8 encoded text.")

    # Validate Settlement CSV Schema
    try:
        settle_text = settle_bytes.decode("utf-8-sig")
        settle_reader = csv.DictReader(io.StringIO(settle_text))
        settle_fields = set(f.strip().lower() for f in (settle_reader.fieldnames or []))
        has_settle_id = any(c in settle_fields for c in ("payout_ref", "settlement_ref", "settle_ref", "ref", "id"))
        has_settle_amount = any(c in settle_fields for c in ("amount", "gross_amount", "net_amount", "gross", "net"))
        if not has_settle_id or not has_settle_amount:
            raise HTTPException(
                status_code=400,
                detail="Invalid settlement.csv format. Must include settlement reference and amount columns.",
            )
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Settlement CSV must be UTF-8 encoded text.")

    # Backup existing
    if (DATA_DIR / "ledger.csv").exists():
        shutil.copyfile(DATA_DIR / "ledger.csv", DATA_DIR / "ledger.csv.bak")
    if (DATA_DIR / "settlement.csv").exists():
        shutil.copyfile(DATA_DIR / "settlement.csv", DATA_DIR / "settlement.csv.bak")

    with open(DATA_DIR / "ledger.csv", "wb") as f:
        f.write(ledger_bytes)
    with open(DATA_DIR / "settlement.csv", "wb") as f:
        f.write(settle_bytes)

    ledger_records, settle_records = _load_default_records()
    _latest_report = await reconciler.reconcile_batch(ledger_records, settle_records)

    return {
        "status": "success",
        "total_ledger": len(ledger_records),
        "total_settlement": len(settle_records),
        "match_rate_pct": _latest_report.auto_match_rate_pct,
        "matched_count": _latest_report.matched_count,
        "exception_count": _latest_report.exception_count,
    }


class GenerateDatasetReq(BaseModel):
    records: int = 100


@app.post("/api/generate-dataset")
async def generate_dataset(req: GenerateDatasetReq):
    global _latest_report
    from data.generate_synthetic_data import save_csv_and_json
    save_csv_and_json(DATA_DIR, total_records=req.records)
    ledger, settle = _load_default_records()
    _latest_report = await reconciler.reconcile_batch(ledger, settle)
    return {
        "status": "success",
        "generated_records": req.records,
        "match_rate_pct": _latest_report.auto_match_rate_pct,
    }


@app.post("/api/chat/upload-and-reconcile")
async def chat_upload_and_reconcile(
    ledger_file: UploadFile = File(...),
    settlement_file: UploadFile = File(...),
    merchant_id: str = Form("merch_001"),
):
    global _latest_report
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    ledger_bytes = await ledger_file.read()
    settle_bytes = await settlement_file.read()

    # Save uploaded files
    with open(DATA_DIR / "ledger.csv", "wb") as f:
        f.write(ledger_bytes)
    with open(DATA_DIR / "settlement.csv", "wb") as f:
        f.write(settle_bytes)

    # Ingest and Reconcile
    ledger_records, settle_records = _load_default_records()
    _latest_report = await reconciler.reconcile_batch(ledger_records, settle_records)

    settled_net = _latest_report.matched_volume_inr - _latest_report.fee_volume_inr
    system_prompt = agent_copilot.build_system_context(_latest_report, merchant_id)

    exceptions_list_str = "\n".join([
        f"  * `{e.source_id}` ({e.merchant_id}): INR {e.amount:,.2f} [{e.record_type}] - {e.reason}"
        for e in _latest_report.exceptions
    ])

    user_prompt = (
        f"I just uploaded two reconciliation files ('{ledger_file.filename}' and '{settlement_file.filename}').\n\n"
        f"EXACT 4-TIER RECONCILIATION AUDIT DATA:\n"
        f"- Total Ledger Entries: {len(ledger_records)} | Total Settlement Line Items: {len(settle_records)}\n"
        f"- 4-Tier Auto-Match Precision: {_latest_report.auto_match_rate_pct}%\n"
        f"- Total Matched Pairs: {_latest_report.matched_count} records\n"
        f"  * Tier 1 Exact ID Matches: {_latest_report.tier1_exact_count} records (Confidence: 1.00)\n"
        f"  * Tier 2 Fuzzy Fee/Date Tolerances: {_latest_report.tier2_fuzzy_count} records (Confidence: 0.95)\n"
        f"  * Tier 3 Semantic Vector ONNX Matches: {_latest_report.tier3_semantic_count} records (Confidence: 0.70-0.90)\n"
        f"- Verified Gross Sales: INR {_latest_report.matched_volume_inr:,.2f}\n"
        f"- Gateway Fee Deductions (MDR + GST): INR {_latest_report.fee_volume_inr:,.2f}\n"
        f"- Net Bank Settlement Realized: INR {settled_net:,.2f}\n"
        f"- Flagged Exceptions ({_latest_report.exception_count} items, Total: INR {sum(e.amount for e in _latest_report.exceptions):,.2f}):\n"
        f"{exceptions_list_str}\n\n"
        f"INSTRUCTIONS:\n"
        f"1. Explain these exact figures in clean, executive-friendly terms.\n"
        f"2. Cite the exact counts for Tier 1 ({_latest_report.tier1_exact_count}), Tier 2 ({_latest_report.tier2_fuzzy_count}), and Tier 3 ({_latest_report.tier3_semantic_count}).\n"
        f"3. List the exact flagged exception items with their real transaction IDs and amounts (never hallucinate IDs or amounts).\n"
        f"4. Provide treasury guidance and next steps."
    )

    llm_reply, model_used, _ = await agent_copilot.router.generate_response(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        max_tokens=2048,
    )

    if not llm_reply:
        llm_reply = (
            f"### 📊 Reconciliation Completed for `{ledger_file.filename}` & `{settlement_file.filename}`\n\n"
            f"- **Auto-Match Rate:** **{_latest_report.auto_match_rate_pct}%** ({_latest_report.matched_count} of {len(ledger_records)} records verified)\n"
            f"- **Tier 1 Exact Matches:** {_latest_report.tier1_exact_count} records (Confidence: 1.00)\n"
            f"- **Tier 2 Fuzzy Tolerances:** {_latest_report.tier2_fuzzy_count} records (Confidence: 0.95)\n"
            f"- **Tier 3 Semantic ONNX Matches:** {_latest_report.tier3_semantic_count} records (Confidence: 0.70-0.90)\n"
            f"- **Gross Processed Sales:** INR {_latest_report.matched_volume_inr:,.2f}\n"
            f"- **Net Bank Settlement:** INR {settled_net:,.2f}\n"
            f"- **Flagged Exceptions ({_latest_report.exception_count} items):**\n"
            f"{exceptions_list_str}\n"
        )

    action_cards = [
        {
            "id": "act_view_matches",
            "action_type": "navigate",
            "label": f"Inspect {_latest_report.matched_count} Matched Pairs",
            "description": "View 4-tier match breakdown and confidence scores",
            "icon": "Layers",
            "target_url": "/reconcile",
        },
        {
            "id": "act_export_pdf",
            "action_type": "export_pdf",
            "label": "Export SOX Audit PDF",
            "description": "Download auditor-certified reconciliation report",
            "icon": "FileText",
            "target_url": f"/api/export/report/pdf?merchant_id={merchant_id}",
            "badge": "SOX Certified",
        },
        {
            "id": "act_auto_close",
            "action_type": "auto_close_books",
            "label": "Confirm & Sign Books",
            "description": f"Sign off ledger with {_latest_report.auto_match_rate_pct}% accuracy",
            "icon": "CheckCircle2",
            "badge": "1-Click Close",
        },
    ]

    return {
        "status": "success",
        "ledger_filename": ledger_file.filename,
        "settlement_filename": settlement_file.filename,
        "metrics": {
            "auto_match_rate_pct": _latest_report.auto_match_rate_pct,
            "total_records": len(ledger_records),
            "matched_count": _latest_report.matched_count,
            "exception_count": _latest_report.exception_count,
            "gross_volume_inr": _latest_report.matched_volume_inr,
            "fee_drag_inr": _latest_report.fee_volume_inr,
            "liquid_cash_inr": settled_net,
        },
        "reply": llm_reply,
        "action_cards": action_cards,
    }


@app.get("/api/export/matches-csv")
async def export_matches_csv(report: ReconciliationReport = Depends(get_current_report)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ledger_txn_id", "settlement_payout_ref", "merchant_id", "gross_amount", "fee_deducted", "net_amount", "match_tier", "confidence"])
    for m in report.matches:
        writer.writerow([m.ledger_txn_id, m.settlement_payout_ref, m.merchant_id, m.settlement_gross, m.fee_deducted, m.settlement_net, m.match_tier.value, m.confidence])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=reconciled_matches.csv"},
    )


@app.get("/api/export/exceptions-csv")
async def export_exceptions_csv(report: ReconciliationReport = Depends(get_current_report)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["source_id", "merchant_id", "record_type", "amount", "risk_level", "reason", "suggested_action"])
    for e in report.exceptions:
        writer.writerow([e.source_id, e.merchant_id, e.record_type, e.amount, e.risk_level, e.reason, e.suggested_action])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=financial_exceptions.csv"},
    )


@app.post("/api/auto-close-loop")
async def auto_close_loop(report: ReconciliationReport = Depends(get_current_report)):
    audit = audit_agent.audit_batch(report)
    now_iso = datetime.now(timezone.utc).isoformat()

    return {
        "status": "closed_and_signed",
        "health_score": audit.financial_health_score,
        "match_rate_pct": audit.reconciliation_match_rate,
        "total_volume_inr": audit.total_audited_volume_inr,
        "fee_leakage_inr": audit.fee_leakage_detected_inr,
        "funds_at_risk_inr": audit.funds_at_risk_inr,
        "exceptions_count": len(report.exceptions),
        "matched_count": report.matched_count,
        "timestamp": now_iso,
        "signed_by": "Autonomous AI Controller (Fintech Kernel v1.0)",
    }


@app.get("/api/merchants")
async def get_merchants():
    return merchant_mgr.list_merchants()


@app.get("/api/disputes")
async def get_disputes():
    return dispute_mgr.list_disputes()


class ResolveDisputeReq(BaseModel):
    dispute_id: str
    outcome: str = "won"


@app.post("/api/disputes/resolve")
async def resolve_dispute(req: ResolveDisputeReq):
    res = dispute_mgr.resolve_dispute(req.dispute_id, outcome=req.outcome)
    if not res:
        raise HTTPException(status_code=404, detail="Dispute not found")
    return res


class SimulateTxnReq(BaseModel):
    amount: float
    merchant_id: str = "merch_001"
    instrument: str = "upi"
    description: str = "Online Checkout Order"


@app.post("/api/simulate-txn")
async def simulate_txn(req: SimulateTxnReq):
    global _latest_report
    res = payout_engine.simulate_and_ingest_transaction(
        merchant_id=req.merchant_id,
        amount=req.amount,
        description=req.description,
        instrument=req.instrument,
    )
    ledger, settle = _load_default_records()
    _latest_report = await reconciler.reconcile_batch(ledger, settle)
    return res


# =============================================================================
# MULTI-TENANT MANAGEMENT
# =============================================================================

class RegisterTenantReq(BaseModel):
    merchant_id: str
    name: str
    business_category: str = "General E-Commerce"
    settlement_cycle: str = "T+1"
    contract_tier: str = "Enterprise"


@app.get("/api/tenants")
async def get_tenants(role: str = "finance_admin", current_merchant: str = "merch_001"):
    """Returns list of active merchant tenants with KYC status and RBAC scoping."""
    return tenant_mgr.list_merchants(user_role=role, current_merchant_id=current_merchant)


@app.post("/api/tenants/register")
async def register_tenant(req: RegisterTenantReq):
    """Registers a new merchant tenant with isolated ledger partitions."""
    meta = tenant_mgr.register_merchant(
        merchant_id=req.merchant_id,
        name=req.name,
        business_category=req.business_category,
        settlement_cycle=req.settlement_cycle,
        contract_tier=req.contract_tier,
    )
    return {"status": "success", "tenant": meta}


@app.get("/api/tenants/{merchant_id}")
async def get_tenant_detail(merchant_id: str, role: str = "finance_admin"):
    """Fetches isolated tenant metadata and operational metrics."""
    try:
        return tenant_mgr.get_merchant_data(merchant_id=merchant_id, user_role=role)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# =============================================================================
# REAL-TIME ALERTS & NOTIFICATIONS
# =============================================================================

@app.get("/api/alerts")
async def get_alerts(merchant_id: str = "merch_001", report: ReconciliationReport = Depends(get_current_report)):
    """Generates and retrieves real-time financial alerts."""
    return alerts_engine.generate_alerts(report=report, merchant_id=merchant_id)


@app.post("/api/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, merchant_id: str = "merch_001"):
    """Marks an alert as acknowledged in the notification center."""
    alert = alerts_engine.acknowledge_alert(alert_id=alert_id, merchant_id=merchant_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "success", "alert": alert}


@app.post("/api/alerts/{alert_id}/dismiss")
async def dismiss_alert(alert_id: str, merchant_id: str = "merch_001"):
    """Dismisses an alert from active notification trays."""
    success = alerts_engine.dismiss_alert(alert_id=alert_id, merchant_id=merchant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "success", "alert_id": alert_id}


# =============================================================================
# ML SMART SUGGESTIONS & ACTIONABLE RECOMMENDATIONS
# =============================================================================

@app.get("/api/recommendations")
async def get_recommendations(merchant_id: str = "merch_001", report: ReconciliationReport = Depends(get_current_report)):
    """Fetches ML pattern recognition recommendations with estimated INR ROI."""
    return smart_advisor.get_recommendations(report=report, merchant_id=merchant_id)


@app.post("/api/recommendations/{rec_id}/apply")
async def apply_recommendation(rec_id: str, merchant_id: str = "merch_001"):
    """Executes actionable suggestion and updates treasury rules."""
    res = smart_advisor.apply_recommendation(rec_id=rec_id, merchant_id=merchant_id)
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res.get("message"))
    return res


# =============================================================================
# HISTORICAL BATCH COMPARISON & TREND ANALYSIS
# =============================================================================

@app.get("/api/trends/comparison")
async def get_trend_comparison(merchant_id: str = "merch_001", report: ReconciliationReport = Depends(get_current_report)):
    """Computes DoD, WoW, and MoM comparative variance telemetry."""
    return trend_analyzer.analyze_trends(report=report, merchant_id=merchant_id)


# =============================================================================
# MULTI-FORMAT EXPORTS & ACCOUNTING SOFTWARE INTEGRATION
# =============================================================================

@app.get("/api/export/report/pdf")
async def export_pdf_report(merchant_id: str = "merch_001", report: ReconciliationReport = Depends(get_current_report)):
    """Returns Executive Treasury Sign-off HTML/PDF printable document."""
    html_content = accounting_exporter.generate_executive_html_report(report=report, merchant_id=merchant_id)
    return HTMLResponse(content=html_content, media_type="text/html")


@app.get("/api/export/accounting")
async def export_accounting_feed(
    system: str = "quickbooks",
    merchant_id: str = "merch_001",
    report: ReconciliationReport = Depends(get_current_report),
):
    """Exports compliant sync payloads for QuickBooks, Xero, or Zoho Books."""
    sys_lower = system.lower()
    if sys_lower in ("quickbooks", "qb"):
        content = accounting_exporter.export_quickbooks_journal(report, merchant_id)
        filename = f"quickbooks_journal_{merchant_id}.csv"
    elif sys_lower == "xero":
        content = accounting_exporter.export_xero_bank_feed(report, merchant_id)
        filename = f"xero_bank_statement_{merchant_id}.csv"
    elif sys_lower in ("zoho", "zoho_books"):
        content = accounting_exporter.export_zoho_books_feed(report, merchant_id)
        filename = f"zoho_books_feed_{merchant_id}.csv"
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported accounting system '{system}'. Choose quickbooks, xero, or zoho.")

    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# # =============================================================================
# STATIC SPA MOUNT & CLIENT-SIDE ROUTING FALLBACK
# =============================================================================

STATIC_DIR = Path(__file__).resolve().parent / "static_dist"

if STATIC_DIR.exists():
    if (STATIC_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # 1. If exact static file exists (e.g. favicon.svg), serve it directly
        target_file = STATIC_DIR / full_path
        if full_path and target_file.is_file():
            return FileResponse(target_file)

        # 2. Fallback to index.html for React Router client-side routes (/forecast, /chat, etc.)
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)

        raise HTTPException(
            status_code=404,
            detail="Frontend static build not found. Run 'npm run build' inside frontend/ directory.",
        )
