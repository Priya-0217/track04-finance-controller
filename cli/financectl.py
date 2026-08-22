"""Production CLI for Razorpay AI Finance Controller (`fin`).

Commands:
- `fin config`          : Configure LLM provider (Gemini, OpenAI, Claude, Ollama), API key, and model
- `fin load-data`       : Ingest custom CSV files or generate fresh synthetic batches
- `fin reconcile`       : Run 4-tier batch reconciliation with summary tables & CSV export
- `fin ask "<question>"`: Ask natural language questions about settlement figures with grounded math
- `fin cash-position`   : Display current settled bank cash vs in-transit receivables
- `fin exceptions`      : View and filter unresolved exceptions by merchant or risk level
- `fin auto-close`      : Run autonomous end-to-end books closing and generate signed financial audit report
- `fin audit-ai`        : Scan for fee overcharges, trapped in-transit payouts, and compute Health Score
- `fin merchants`       : View and manage merchant portfolio, fee tiers, and settlement cycles
- `fin simulate-txn`    : Simulate new incoming payment across UPI/Cards with dynamic fee deduction
- `fin disputes`        : List active chargeback holdbacks and resolve disputes
- `fin serve`           : Launch the live interactive Web Dashboard on Port 8010
- `fin benchmark`       : Run the automated ground-truth evaluation benchmark
- `fin mcp`             : Launch the Model Context Protocol (MCP) stdio server
"""

from __future__ import annotations

import asyncio
import csv
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import typer
from rich import print
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from engine.auto_audit import AutoAuditAgent
from engine.config import FinanceConfig
from engine.disputes import DisputeManager
from engine.forecaster import ForwardCashForecaster
from engine.merchants import MerchantManager
from engine.models import LedgerRecord, SettlementRecord
from engine.payout_engine import PayoutEngine
from engine.reconciler import ReconciliationEngine
from qa.settlement_agent import SettlementQAAgent

app = typer.Typer(
    name="fin",
    help="[*] Razorpay AI Finance Controller CLI - Reconcile books, track cash positions & grounded settlement Q&A.",
    add_completion=False,
)
console = Console()
reconciler = ReconciliationEngine()
qa_agent = SettlementQAAgent()
audit_agent = AutoAuditAgent()
merchant_mgr = MerchantManager()
dispute_mgr = DisputeManager()
payout_engine = PayoutEngine()
forecaster = ForwardCashForecaster()

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _normalize_row_keys(row: dict[str, Any]) -> dict[str, Any]:
    """Strip whitespace and lowercase all column keys for ultra-resilient CSV parsing."""
    return {k.strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in row.items() if k is not None}


def _get_records(ledger_path: Path | None = None, settle_path: Path | None = None):
    l_path = ledger_path or (DATA_DIR / "ledger.csv")
    s_path = settle_path or (DATA_DIR / "settlement.csv")

    if not l_path.exists() or not s_path.exists():
        from data.generate_synthetic_data import save_csv_and_json
        save_csv_and_json(DATA_DIR)

    ledger_records = []
    with open(l_path, "r", encoding="utf-8-sig") as f:
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

    settle_records = []
    with open(s_path, "r", encoding="utf-8-sig") as f:
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

            settle_records.append(
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

    return ledger_records, settle_records


# =============================================================================
# 1. Config Command
# =============================================================================
@app.command("config")
def config(
    provider: Optional[str] = typer.Option(None, "--provider", "-p", help="Set default LLM provider: gemini | openai | anthropic | ollama | openrouter | groq"),
    model: Optional[str] = typer.Option(None, "--model", "-m", help="Set model ID e.g. gemini/gemini-2.5-flash, gpt-4o-mini, ollama/llama3.2"),
    key: Optional[str] = typer.Option(None, "--key", "-k", help="Set API key for the chosen cloud provider"),
    merchant: Optional[str] = typer.Option(None, "--merchant", help="Set default merchant ID e.g. merch_001"),
    show: bool = typer.Option(False, "--show", "-s", help="Show current active configuration"),
):
    """View or configure LLM providers, API keys, and merchant defaults."""
    updates = {}
    if provider:
        updates["llm_provider"] = provider
    if model:
        updates["llm_model"] = model
    if key:
        updates["api_key"] = key
    if merchant:
        updates["default_merchant"] = merchant

    if updates:
        cfg = FinanceConfig.save(updates)
        console.print("[green][+] Configuration updated successfully![/green]")
    else:
        cfg = FinanceConfig.load()

    table = Table(title="[*] Active AI Finance Controller Configuration")
    table.add_column("Key", style="cyan")
    table.add_column("Value", style="bold white")

    masked_key = f"{cfg.get('api_key', '')[:6]}...{cfg.get('api_key', '')[-4:]}" if cfg.get("api_key") else "[dim]Not Set (Using Math Fallback)[/dim]"
    table.add_row("LLM Provider", cfg.get("llm_provider", "gemini"))
    table.add_row("Model ID", cfg.get("llm_model", "gemini/gemini-2.5-flash"))
    table.add_row("API Key", masked_key)
    table.add_row("Default Merchant", cfg.get("default_merchant", "merch_001"))
    table.add_row("Server Port", str(cfg.get("server_port", 8010)))

    console.print(table)
    console.print("[dim]Tip: Run 'fin config -p openai -k sk-...' to switch providers anytime.[/dim]")


# =============================================================================
# 2. Load Data Command
# =============================================================================
@app.command("load-data")
def load_data(
    ledger: Optional[Path] = typer.Option(None, "--ledger", "-l", help="Path to custom ledger CSV file"),
    settlement: Optional[Path] = typer.Option(None, "--settlement", "-s", help="Path to custom settlement CSV file"),
    generate: bool = typer.Option(False, "--generate", "-g", help="Generate fresh synthetic financial dataset"),
    records: int = typer.Option(100, "--records", "-n", help="Number of records to generate"),
):
    """Ingest custom CSV reports or generate synthetic datasets."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if generate or (not ledger and not settlement):
        from data.generate_synthetic_data import save_csv_and_json
        with console.status(f"[bold green]Generating {records} synthetic financial records...[/bold green]"):
            save_csv_and_json(DATA_DIR)
        console.print(f"[green][+] Generated {records} records in:[/green] {DATA_DIR}")
        return

    if ledger and ledger.exists():
        dest = DATA_DIR / "ledger.csv"
        shutil.copyfile(ledger, dest)
        console.print(f"[green][+] Loaded ledger CSV into:[/green] {dest}")

    if settlement and settlement.exists():
        dest = DATA_DIR / "settlement.csv"
        shutil.copyfile(settlement, dest)
        console.print(f"[green][+] Loaded settlement CSV into:[/green] {dest}")


# =============================================================================
# 3. Reconcile Command
# =============================================================================
@app.command("reconcile")
def reconcile(
    ledger: Optional[Path] = typer.Option(None, "--ledger", "-l", help="Path to custom ledger CSV"),
    settlement: Optional[Path] = typer.Option(None, "--settlement", "-s", help="Path to custom settlement CSV"),
    export: Optional[Path] = typer.Option(None, "--export", "-e", help="Path to export reconciliation report CSV"),
):
    """Run 4-tier financial reconciliation across ledger and settlement records."""
    ledger_recs, settle_recs = _get_records(ledger, settlement)

    with console.status("[bold green]Executing 4-tier reconciliation engine...[/bold green]"):
        report = asyncio.run(reconciler.reconcile_batch(ledger_recs, settle_recs))

    table = Table(title="[*] Financial Reconciliation Batch Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="bold white")

    table.add_row("Auto-Match Rate", f"[green]{report.auto_match_rate_pct}%[/green]")
    table.add_row("Total Processed", f"{report.total_ledger_records} records")
    table.add_row("Tier 1 Exact Matches", f"{report.tier1_exact_count} (Confidence: 1.00)")
    table.add_row("Tier 2 Fuzzy Tolerances", f"{report.tier2_fuzzy_count} (Confidence: 0.95)")
    table.add_row("Tier 3 Semantic ONNX", f"{report.tier3_semantic_count} (Confidence: 0.70+)")
    table.add_row("Flagged Exceptions", f"[red]{report.exception_count}[/red]")
    table.add_row("Gross Sales Matched", f"INR {report.matched_volume_inr:,.2f}")
    table.add_row("Gateway Deductions (MDR)", f"INR {report.fee_volume_inr:,.2f}")
    table.add_row("Net Verified Settlement", f"INR {report.matched_volume_inr - report.fee_volume_inr:,.2f}")

    console.print(table)

    if export:
        export.parent.mkdir(parents=True, exist_ok=True)
        with open(export, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["ledger_txn_id", "settlement_payout_ref", "merchant_id", "gross", "fee", "net", "tier", "confidence"])
            writer.writeheader()
            for m in report.matches:
                writer.writerow({
                    "ledger_txn_id": m.ledger_txn_id,
                    "settlement_payout_ref": m.settlement_payout_ref,
                    "merchant_id": m.merchant_id,
                    "gross": m.settlement_gross,
                    "fee": m.fee_deducted,
                    "net": m.settlement_net,
                    "tier": m.match_tier.value,
                    "confidence": m.confidence,
                })
        console.print(f"[green][+] Exported {len(report.matches)} matches to:[/green] {export}")


# =============================================================================
# 4. Ask Command (Settlement Q&A)
# =============================================================================
@app.command("ask")
def ask(
    question: str = typer.Argument(..., help="Settlement or fee question in plain English"),
    merchant: Optional[str] = typer.Option(None, "--merchant", "-m", help="Merchant ID (defaults to config)"),
    provider: Optional[str] = typer.Option(None, "--provider", "-p", help="Override LLM Provider: gemini | openai | anthropic | ollama"),
    model: Optional[str] = typer.Option(None, "--model", help="Override specific Model ID"),
):
    """Ask natural language questions about payouts, deductions, and discrepancies."""
    cfg = FinanceConfig.load()
    merch_id = merchant or cfg.get("default_merchant", "merch_001")
    prov = provider or cfg.get("llm_provider", "gemini")
    mod = model or cfg.get("llm_model", "gemini/gemini-2.5-flash")

    if cfg.get("api_key"):
        if prov == "openai":
            os.environ["OPENAI_API_KEY"] = cfg["api_key"]
        elif prov == "anthropic":
            os.environ["ANTHROPIC_API_KEY"] = cfg["api_key"]
        else:
            os.environ["GEMINI_API_KEY"] = cfg["api_key"]

    ledger_recs, settle_recs = _get_records()
    report = asyncio.run(reconciler.reconcile_batch(ledger_recs, settle_recs))

    with console.status(f"[bold green]Synthesizing grounded explanation via {prov} ({mod})...[/bold green]"):
        res = asyncio.run(
            qa_agent.answer_question(
                question=question,
                merchant_id=merch_id,
                report=report,
                provider=prov,
                model=mod,
            )
        )

    console.print(Panel(res.answer, title=f"[*] Grounded Settlement Breakdown (Merchant: {merch_id})", border_style="cyan"))
    console.print(f"[dim]Tokens Used: {res.tokens_used} | Tokens Saved: {res.tokens_saved} | Audit ID: {res.audit_id}[/dim]")


# =============================================================================
# 5. Exceptions Command
# =============================================================================
@app.command("exceptions")
def exceptions(
    merchant: Optional[str] = typer.Option(None, "--merchant", "-m", help="Filter by merchant ID"),
    risk: Optional[str] = typer.Option(None, "--risk", "-r", help="Filter by risk level: high | medium | low"),
    format_type: Optional[str] = typer.Option("table", "--format", "-f", help="Output format: table | json"),
):
    """View and filter unresolved exceptions and discrepancies."""
    ledger_recs, settle_recs = _get_records()
    report = asyncio.run(reconciler.reconcile_batch(ledger_recs, settle_recs))

    filtered = report.exceptions
    if merchant:
        filtered = [e for e in filtered if e.merchant_id == merchant]
    if risk:
        filtered = [e for e in filtered if e.risk_level.lower() == risk.lower()]

    if format_type.lower() == "json":
        import json
        data = [
            {
                "source_id": e.source_id,
                "merchant_id": e.merchant_id,
                "record_type": e.record_type,
                "amount": e.amount,
                "date": e.date,
                "reason": e.reason,
                "suggested_action": e.suggested_action,
                "risk_level": e.risk_level,
            }
            for e in filtered
        ]
        console.print_json(json.dumps(data, indent=2))
        return

    table = Table(title=f"[*] Flagged Exceptions ({len(filtered)} items)")
    table.add_column("Source ID", style="cyan")
    table.add_column("Merchant", style="magenta")
    table.add_column("Type", style="yellow")
    table.add_column("Amount (INR)", style="bold white")
    table.add_column("Reason & Suggested Action", style="white")

    for e in filtered:
        table.add_row(
            e.source_id,
            e.merchant_id,
            e.record_type,
            f"INR {e.amount:,.2f}",
            f"{e.reason}\n[dim]Action: {e.suggested_action}[/dim]",
        )

    console.print(table)


# =============================================================================
# 6. Cash Position Command
# =============================================================================
@app.command("cash-position")
def cash_position():
    """Display real-time liquid cash vs in-transit gateway receivables."""
    ledger_recs, settle_recs = _get_records()
    report = asyncio.run(reconciler.reconcile_batch(ledger_recs, settle_recs))

    settled_gross = report.matched_volume_inr
    fee_drag = report.fee_volume_inr
    net_liquid_cash = settled_gross - fee_drag

    in_transit = sum(e.amount for e in report.exceptions if e.record_type == "unmatched_ledger")
    disputed_holdbacks = sum(e.amount for e in report.exceptions if e.record_type == "unmatched_settlement")

    table = Table(title="[*] Real-Time Cash Position & Books Status")
    table.add_column("Category", style="cyan")
    table.add_column("Amount (INR)", style="bold white")
    table.add_column("Status / Liquidity", style="green")

    table.add_row("Liquid Cash in Bank", f"INR {net_liquid_cash:,.2f}", "[bold green]100% Settled & Available[/bold green]")
    table.add_row("In-Transit Receivables", f"INR {in_transit:,.2f}", "[yellow]Pending (T+1/T+2 Window)[/yellow]")
    table.add_row("Gateway MDR Fee Drag", f"INR {fee_drag:,.2f}", "[dim]Processing Cost (MDR + GST)[/dim]")
    table.add_row("Disputed / Holdback Credits", f"INR {disputed_holdbacks:,.2f}", "[red]Under Review / Chargeback[/red]")

    console.print(table)


# =============================================================================
# 7. Autonomous Books Close Loop (`fin auto-close`)
# =============================================================================
@app.command("auto-close")
def auto_close():
    """Execute end-to-end autonomous books closing & financial audit report."""
    ledger_recs, settle_recs = _get_records()
    with console.status("[bold green]Executing Autonomous Finance Ops Loop...[/bold green]"):
        report = asyncio.run(reconciler.reconcile_batch(ledger_recs, settle_recs))
        audit = audit_agent.audit_batch(report)

    console.print(Panel(
        f"[bold white][*] AUTONOMOUS BOOKS CLOSURE REPORT[/bold white]\n\n"
        f"- [bold green]Financial Health Score:[/bold green] {audit.financial_health_score}/100\n"
        f"- [bold cyan]Reconciliation Auto-Match Rate:[/bold cyan] {audit.reconciliation_match_rate}%\n"
        f"- [bold white]Total Audited Volume:[/bold white] INR {audit.total_audited_volume_inr:,.2f}\n"
        f"- [bold yellow]Fee Overcharges / Leakage Detected:[/bold yellow] INR {audit.fee_leakage_detected_inr:,.2f}\n"
        f"- [bold red]Unsettled Funds at Risk:[/bold red] INR {audit.funds_at_risk_inr:,.2f}\n"
        f"- [bold magenta]Active Discrepancies:[/bold magenta] {len(report.exceptions)} items quarantined",
        title="[*] Daily Finance Controller Sign-Off",
        border_style="green",
    ))


# =============================================================================
# 8. AI Anomaly Audit Command (`fin audit-ai`)
# =============================================================================
@app.command("audit-ai")
def audit_ai():
    """Run automated AI anomaly detection to surface fee leakage & trapped funds."""
    ledger_recs, settle_recs = _get_records()
    report = asyncio.run(reconciler.reconcile_batch(ledger_recs, settle_recs))
    audit = audit_agent.audit_batch(report)

    table = Table(title=f"[*] AI Anomaly Audit Findings (Health Score: {audit.financial_health_score}/100)")
    table.add_column("Severity", style="bold red")
    table.add_column("Category", style="yellow")
    table.add_column("Impact", style="bold white")
    table.add_column("Description & Recommended Action", style="white")

    for f in audit.findings:
        sev_color = "red" if f.severity == "CRITICAL" else "yellow"
        table.add_row(
            f"[{sev_color}]{f.severity}[/{sev_color}]",
            f.category,
            f"INR {f.impact_amount_inr:,.2f}",
            f"{f.description}\n[dim]Action: {f.recommended_action}[/dim]",
        )

    console.print(table)


# =============================================================================
# 9. Merchants Directory Command (`fin merchants`)
# =============================================================================
@app.command("merchants")
def merchants():
    """Display merchant accounts, fee schedules, and settlement cycles."""
    merchants_list = merchant_mgr.list_merchants()

    table = Table(title="[*] Active Merchant Accounts & Fee Schedules")
    table.add_column("Merchant ID", style="cyan")
    table.add_column("Business Name", style="bold white")
    table.add_column("Fee Tier", style="magenta")
    table.add_column("Cycle", style="green")
    table.add_column("KYC Status", style="green")
    table.add_column("Risk Rating", style="yellow")

    for m in merchants_list:
        table.add_row(
            m["merchant_id"],
            m["business_name"],
            m["fee_tier"],
            m["settlement_cycle"],
            f"[green]{m['kyc_status'].upper()}[/green]",
            m["risk_rating"].upper(),
        )

    console.print(table)


# =============================================================================
# 10. Simulate Transaction Command (`fin simulate-txn`)
# =============================================================================
@app.command("simulate-txn")
def simulate_txn(
    amount: float = typer.Argument(..., help="Gross transaction amount in INR"),
    merchant: str = typer.Option("merch_001", "--merchant", "-m", help="Merchant ID"),
    instrument: str = typer.Option("upi", "--instrument", "-i", help="Payment rail: upi | debit_card | credit_card | corporate_card | international"),
    description: str = typer.Option("Online Order Checkout", "--desc", "-d", help="Transaction description"),
):
    """Simulate incoming payment with dynamic fee deductions and instant ledger entry."""
    res = payout_engine.simulate_and_ingest_transaction(
        merchant_id=merchant,
        amount=amount,
        description=description,
        instrument=instrument,
    )

    table = Table(title=f"[*] Ingested Live Transaction: {res['txn_id']}")
    table.add_column("Field", style="cyan")
    table.add_column("Value", style="bold white")

    table.add_row("Transaction ID", res["txn_id"])
    table.add_row("Payout Ref", res["payout_ref"])
    table.add_row("Merchant ID", res["merchant_id"])
    table.add_row("Payment Instrument", res["instrument"].upper())
    table.add_row("Gross Amount", f"INR {res['gross_amount']:,.2f}")
    table.add_row("Base Gateway MDR Fee", f"INR {res['fee_deducted']:,.2f}")
    table.add_row("GST on Processing Fee (18%)", f"INR {res['gst_deducted']:,.2f}")
    table.add_row("Net Merchant Settlement", f"[green]INR {res['net_amount']:,.2f}[/green]")
    table.add_row("Assigned Bank UTR", res["utr"])

    console.print(table)
    console.print("[green][+] Transaction appended to ledger and settlement records successfully![/green]")


# =============================================================================
# 11. Disputes Management Command (`fin disputes`)
# =============================================================================
@app.command("disputes")
def disputes(
    resolve: Optional[str] = typer.Option(None, "--resolve", "-r", help="Dispute ID to resolve"),
    outcome: str = typer.Option("won", "--outcome", "-o", help="Resolution outcome: won | lost"),
):
    """View and resolve active payment disputes and holdbacks."""
    if resolve:
        res = dispute_mgr.resolve_dispute(resolve, outcome=outcome)
        if res:
            console.print(f"[green][+] Dispute {resolve} marked as {res['status']} (Holdback Released: {not res['holdback_active']})[/green]")
        else:
            console.print(f"[red][!] Dispute {resolve} not found.[/red]")
        return

    disp_list = dispute_mgr.list_disputes()
    table = Table(title="[*] Active Payment Disputes & Holdbacks")
    table.add_column("Dispute ID", style="cyan")
    table.add_column("Merchant", style="magenta")
    table.add_column("Amount (INR)", style="bold white")
    table.add_column("Status", style="yellow")
    table.add_column("Holdback", style="red")
    table.add_column("Reason", style="white")

    for d in disp_list:
        hb_str = "[red]ACTIVE[/red]" if d["holdback_active"] else "[green]RELEASED[/green]"
        table.add_row(
            d["dispute_id"],
            d["merchant_id"],
            f"INR {d['amount']:,.2f}",
            d["status"].upper(),
            hb_str,
            d["reason"],
        )

    console.print(table)
    console.print("[dim]Tip: Resolve a dispute using 'fin disputes --resolve disp_001 --outcome won'[/dim]")


# =============================================================================
# 12. Forward Cash Forecast Command (`fin forecast`)
# =============================================================================
@app.command("forecast")
def forecast(
    days: int = typer.Option(7, "--days", "-d", help="Forecast horizon in days (e.g. 7, 14, 30)"),
    merchant: Optional[str] = typer.Option(None, "--merchant", "-m", help="Filter forecast for a specific merchant ID"),
):
    """Project future daily cash positions incorporating clearing cycles and RBI bank holidays."""
    ledger, settle = _get_records()
    report = asyncio.run(reconciler.reconcile_batch(ledger, settle))
    fc = forecaster.calculate_forecast(report, horizon_days=days, merchant_id=merchant)

    console.print(Panel.fit(
        f"[bold white]{fc.forecast_horizon_days}-Day Forward Cash Forecast[/bold white]\n"
        f"[dim]Starting Verified Balance: INR {fc.current_liquid_balance_inr:,.2f}[/dim]",
        style="bold black on white",
    ))

    table = Table(title=f"[*] Day-by-Day Cash Position Forecast ({fc.forecast_horizon_days} Days)")
    table.add_column("Day", style="cyan", justify="center")
    table.add_column("Date", style="magenta")
    table.add_column("Day Name", style="white")
    table.add_column("Expected Gross", style="bold white", justify="right")
    table.add_column("MDR Fee Drag", style="red", justify="right")
    table.add_column("Net Settlement", style="green", justify="right")
    table.add_column("Projected Balance", style="bold green", justify="right")
    table.add_column("Clearing Status", style="yellow")

    for p in fc.daily_projections:
        status_str = f"[bold green]{p.settlement_status}[/bold green]"
        if p.is_bank_holiday:
            status_str = f"[bold red]{p.holiday_reason or 'HOLIDAY'}[/bold red]"

        table.add_row(
            f"Day {p.day_offset}",
            p.forecast_date,
            p.day_name,
            f"INR {p.expected_gross_sales_inr:,.2f}",
            f"INR {p.projected_fee_deductions_inr:,.2f}",
            f"+INR {p.projected_net_settlement_inr:,.2f}",
            f"INR {p.ending_balance_inr:,.2f}",
            status_str,
        )

    console.print(table)

    # Alerts
    if fc.alerts:
        console.print("\n[bold yellow][!] Forward Treasury & Clearing Alerts:[/bold yellow]")
        for a in fc.alerts:
            console.print(f"  - [{a.severity}] [bold]{a.title}[/bold]: {a.description}")
            console.print(f"    [dim]Action: {a.recommended_action}[/dim]")

    console.print(f"\n[bold green][+] Treasury Guidance:[/bold green] {fc.treasury_recommendation}")


# =============================================================================
# 13. Benchmark Command
# =============================================================================
@app.command("benchmark")
def benchmark():
    """Run automated precision/recall evaluation against ground-truth data."""
    from eval.run_benchmarks import run_evaluation
    asyncio.run(run_evaluation())


# =============================================================================
# 13. Serve Command
# =============================================================================
@app.command("serve")
def serve(
    port: int = typer.Option(8010, "--port", "-p", help="Server port number"),
    host: str = typer.Option("0.0.0.0", "--host", "-h", help="Host binding address"),
):
    for p in [Path.cwd(), Path(__file__).resolve().parent.parent, Path(__file__).resolve().parent]:
        if p.exists() and str(p) not in sys.path:
            sys.path.insert(0, str(p))

    from app import app as fastapi_app
    import uvicorn

    uvicorn.run(fastapi_app, host=host, port=port)


# =============================================================================
# 14. MCP Command
# =============================================================================
@app.command("mcp")
def run_mcp():
    """Launch the Model Context Protocol (MCP) stdio server."""
    from mcp.server import main
    main()


if __name__ == "__main__":
    app()
