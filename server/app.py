"""FastAPI Server for AI Finance Controller (Track 04).

Exposes:
- `POST /reconcile` (Reconcile uploaded/default CSV records)
- `POST /qa` (Settlement Q&A with grounded math)
- `GET /exceptions` (List flagged exceptions with structured reasons)
- `GET /metrics` (Live reconciliation accuracy & token economics)
- `GET /audit` (RBAC access audit log)
- `GET /` (Interactive visual reconciliation & Q&A dashboard)
"""

from __future__ import annotations

import csv
import io
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from engine.models import (
    LedgerRecord,
    ReconciliationReport,
    SettlementQARequest,
    SettlementQAResponse,
    SettlementRecord,
)
from engine.reconciler import ReconciliationEngine
from qa.permissions import PermissionEngine
from qa.settlement_agent import SettlementQAAgent

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

app = FastAPI(
    title="Razorpay AI Finance Controller",
    description="Automated 4-Tier Financial Reconciliation & Grounded Settlement Q&A Engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

reconciler = ReconciliationEngine()
qa_agent = SettlementQAAgent()
permissions = PermissionEngine()

# In-memory latest report cache
_latest_report: ReconciliationReport | None = None


def _load_default_records() -> tuple[list[LedgerRecord], list[SettlementRecord]]:
    ledger_path = DATA_DIR / "ledger.csv"
    settle_path = DATA_DIR / "settlement.csv"

    if not ledger_path.exists() or not settle_path.exists():
        from data.generate_synthetic_data import save_csv_and_json
        save_csv_and_json(DATA_DIR)

    ledger_records = []
    with open(ledger_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ledger_records.append(
                LedgerRecord(
                    txn_id=row["txn_id"],
                    merchant_id=row["merchant_id"],
                    amount=float(row["amount"]),
                    txn_date=row["txn_date"],
                    order_id=row.get("order_id"),
                    description=row["description"],
                    currency=row.get("currency", "INR"),
                    customer_name=row.get("customer_name"),
                )
            )

    settlement_records = []
    with open(settle_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            settlement_records.append(
                SettlementRecord(
                    payout_ref=row["payout_ref"],
                    merchant_id=row["merchant_id"],
                    gross_amount=float(row["gross_amount"]),
                    fee_deducted=float(row["fee_deducted"]),
                    tax_deducted=float(row.get("tax_deducted", 0.0)),
                    net_amount=float(row["net_amount"]),
                    settlement_date=row["settlement_date"],
                    utr=row.get("utr"),
                    description=row["description"],
                    matched_txn_id=row.get("matched_txn_id") or None,
                )
            )

    return ledger_records, settlement_records


@app.on_event("startup")
async def startup_event():
    """Pre-compute reconciliation for instant demo availability."""
    global _latest_report
    ledger, settle = _load_default_records()
    _latest_report = await reconciler.reconcile_batch(ledger, settle)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ai-finance-controller", "version": "1.0.0"}


@app.post("/reconcile", response_model=ReconciliationReport)
async def reconcile_data(
    ledger_file: UploadFile | None = File(None),
    settlement_file: UploadFile | None = File(None),
):
    """Reconciles uploaded CSVs or uses default synthetic dataset."""
    global _latest_report
    if ledger_file and settlement_file:
        ledger_content = (await ledger_file.read()).decode("utf-8")
        settle_content = (await settlement_file.read()).decode("utf-8")

        ledger_records = [
            LedgerRecord(
                txn_id=r["txn_id"],
                merchant_id=r["merchant_id"],
                amount=float(r["amount"]),
                txn_date=r["txn_date"],
                order_id=r.get("order_id"),
                description=r["description"],
            )
            for r in csv.DictReader(io.StringIO(ledger_content))
        ]

        settlement_records = [
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
            for r in csv.DictReader(io.StringIO(settle_content))
        ]
    else:
        ledger_records, settlement_records = _load_default_records()

    _latest_report = await reconciler.reconcile_batch(ledger_records, settlement_records)
    return _latest_report


@app.post("/qa", response_model=SettlementQAResponse)
async def settlement_qa(request: SettlementQARequest):
    """Grounded Settlement Q&A."""
    global _latest_report
    if _latest_report is None:
        ledger, settle = _load_default_records()
        _latest_report = await reconciler.reconcile_batch(ledger, settle)

    return await qa_agent.answer_question(
        question=request.question,
        merchant_id=request.merchant_id,
        report=_latest_report,
        role=request.role,
        max_tokens=request.max_tokens,
    )


@app.get("/exceptions")
async def get_exceptions(merchant_id: str | None = None):
    """List all unverified / anomalous records with reasons."""
    global _latest_report
    if _latest_report is None:
        ledger, settle = _load_default_records()
        _latest_report = await reconciler.reconcile_batch(ledger, settle)

    if merchant_id:
        return [e for e in _latest_report.exceptions if e.merchant_id == merchant_id]
    return _latest_report.exceptions


@app.get("/metrics")
async def get_metrics():
    """Live reconciliation performance & token metrics."""
    global _latest_report
    if _latest_report is None:
        ledger, settle = _load_default_records()
        _latest_report = await reconciler.reconcile_batch(ledger, settle)

    return {
        "auto_match_rate_pct": _latest_report.auto_match_rate_pct,
        "total_ledger": _latest_report.total_ledger_records,
        "total_settlement": _latest_report.total_settlement_records,
        "matched_count": _latest_report.matched_count,
        "exception_count": _latest_report.exception_count,
        "tier1_exact": _latest_report.tier1_exact_count,
        "tier2_fuzzy": _latest_report.tier2_fuzzy_count,
        "tier3_semantic": _latest_report.tier3_semantic_count,
        "matched_volume_inr": _latest_report.matched_volume_inr,
        "fee_volume_inr": _latest_report.fee_volume_inr,
    }


@app.get("/audit")
async def get_audit_trail(limit: int = 50):
    """Retrieve RBAC audit trail logs."""
    return permissions.get_audit_logs(limit=limit)


@app.get("/", response_class=HTMLResponse)
async def dashboard():
    """Interactive visual dashboard for judges and testing."""
    global _latest_report
    if _latest_report is None:
        ledger, settle = _load_default_records()
        _latest_report = await reconciler.reconcile_batch(ledger, settle)

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Razorpay AI Finance Controller — Track 04</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
            body {{ background: #0c1017; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }}
            .card {{ background: #161b22; border: 1px solid #30363d; border-radius: 10px; }}
            .badge-exact {{ background: #238636; color: white; }}
            .badge-fuzzy {{ background: #1f6feb; color: white; }}
            .badge-semantic {{ background: #8957e5; color: white; }}
            .badge-exc {{ background: #da3633; color: white; }}
            .table-dark {{ background: #161b22; }}
            pre {{ background: #0d1117; color: #58a6ff; padding: 15px; border-radius: 8px; border: 1px solid #30363d; }}
        </style>
    </head>
    <body class="p-4">
        <div class="container-fluid">
            <div class="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom border-secondary">
                <div>
                    <h2 class="fw-bold text-white mb-0">⚡ Razorpay AI Finance Controller</h2>
                    <small class="text-secondary">Track 04: Automated 4-Tier Reconciliation & Grounded Settlement Q&A</small>
                </div>
                <div>
                    <span class="badge bg-success p-2">Port 8010 Online</span>
                    <span class="badge bg-primary p-2 ms-2">Builder: Pratik Singh (ECE '27)</span>
                </div>
            </div>

            <!-- Metrics Summary Cards -->
            <div class="row g-3 mb-4">
                <div class="col-md-3">
                    <div class="card p-3">
                        <div class="text-secondary small">Auto-Match Rate</div>
                        <h2 class="text-success fw-bold">{_latest_report.auto_match_rate_pct}%</h2>
                        <small class="text-muted">{_latest_report.matched_count} of {_latest_report.total_ledger_records} records</small>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card p-3">
                        <div class="text-secondary small">Matched Volume (INR)</div>
                        <h2 class="text-white fw-bold">₹{_latest_report.matched_volume_inr:,.2f}</h2>
                        <small class="text-muted">Total Gross Volume</small>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card p-3">
                        <div class="text-secondary small">Gateway Deductions (MDR)</div>
                        <h2 class="text-warning fw-bold">₹{_latest_report.fee_volume_inr:,.2f}</h2>
                        <small class="text-muted">Verified 2% + 18% GST</small>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card p-3">
                        <div class="text-secondary small">Flagged Exceptions</div>
                        <h2 class="text-danger fw-bold">{_latest_report.exception_count}</h2>
                        <small class="text-muted">Structured reasons attached</small>
                    </div>
                </div>
            </div>

            <div class="row g-4">
                <!-- Interactive Settlement Q&A -->
                <div class="col-md-5">
                    <div class="card p-4 h-100">
                        <h5 class="fw-bold mb-3">💬 Settlement Q&A Layer (Grounded Math)</h5>
                        <div class="mb-3">
                            <label class="small text-secondary">Merchant Selection:</label>
                            <select id="merchantSelect" class="form-select bg-dark text-white border-secondary">
                                <option value="merch_001">merch_001 (UrbanStore Electronics)</option>
                                <option value="merch_002">merch_002 (Nova Health Essentials)</option>
                                <option value="merch_003">merch_003 (Apex Cloud Solutions)</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="small text-secondary">Ask a natural language settlement question:</label>
                            <textarea id="questionInput" class="form-control bg-dark text-white border-secondary" rows="3">Why did I receive ₹9,400 instead of ₹10,000 on my recent payout batch?</textarea>
                        </div>
                        <button onclick="askQA()" class="btn btn-primary fw-bold w-100 mb-3">Ask Settlement Controller</button>
                        <div id="qaResponse" class="small mt-2"></div>
                    </div>
                </div>

                <!-- 4-Tier Match Breakdown -->
                <div class="col-md-7">
                    <div class="card p-4 h-100">
                        <h5 class="fw-bold mb-3">🔍 4-Tier Reconciliation Pipeline Breakdown</h5>
                        <div class="d-flex justify-content-between mb-2">
                            <span><span class="badge badge-exact me-2">Tier 1</span> Exact Txn ID Match (1.00):</span>
                            <span class="fw-bold">{_latest_report.tier1_exact_count}</span>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                            <span><span class="badge badge-fuzzy me-2">Tier 2</span> Fuzzy Tolerance Match (0.95):</span>
                            <span class="fw-bold">{_latest_report.tier2_fuzzy_count}</span>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                            <span><span class="badge badge-semantic me-2">Tier 3</span> Semantic ONNX Embedding Match (0.70+):</span>
                            <span class="fw-bold">{_latest_report.tier3_semantic_count}</span>
                        </div>
                        <div class="d-flex justify-content-between mb-4">
                            <span><span class="badge badge-exc me-2">Tier 4</span> Explicit Exception List (Unmatched):</span>
                            <span class="fw-bold text-danger">{_latest_report.exception_count}</span>
                        </div>

                        <h6 class="fw-bold border-top border-secondary pt-3 mb-2">Recent Flagged Exceptions (Sample)</h6>
                        <div class="table-responsive" style="max-height: 250px; overflow-y: auto;">
                            <table class="table table-dark table-sm small">
                                <thead>
                                    <tr>
                                        <th>Source ID</th>
                                        <th>Type</th>
                                        <th>Amount</th>
                                        <th>Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {"".join(f"<tr><td><code>{e.source_id}</code></td><td><span class='badge bg-danger'>{e.record_type}</span></td><td>₹{e.amount:,.2f}</td><td>{e.reason}</td></tr>" for e in _latest_report.exceptions[:6])}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            async function askQA() {{
                const merchant = document.getElementById('merchantSelect').value;
                const question = document.getElementById('questionInput').value;
                const out = document.getElementById('qaResponse');
                out.innerHTML = '<span class="text-warning">Running grounded token compressor & verification...</span>';
                
                try {{
                    const res = await fetch('/qa', {{
                        method: 'POST',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify({{ merchant_id: merchant, question: question, role: 'merchant' }})
                    }});
                    const data = await res.json();
                    out.innerHTML = `<pre>${{data.answer}}\n\n[Tokens Used: ${{data.tokens_used}} | Tokens Saved: ${{data.tokens_saved}} | Audit ID: ${{data.audit_id}}]</pre>`;
                }} catch (e) {{
                    out.innerHTML = `<span class="text-danger">Error: ${{e.message}}</span>`;
                }}
            }}
        </script>
    </body>
    </html>
    """
