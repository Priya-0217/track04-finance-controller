# 🚀 Onboarding Guide: Razorpay AI Finance Controller OS (Track 4)

Welcome to the **Razorpay AI Finance Controller OS** — an autonomous, conversational-first treasury intelligence and 4-tier financial reconciliation platform designed to eliminate cash drag, automate daily books closure, audit contract fees, and provide real-time financial ground truth.

---

## ⚡ Quick 1-Click Setup

To get the entire system running with zero manual configuration:

### On Linux / macOS / WSL:
```bash
chmod +x setup.sh
./setup.sh
```

### On Windows (PowerShell):
```powershell
.\setup.ps1
```

The script will automatically configure your Python environment, install dependencies, compile the React UI, verify test suites, and launch the server on **[http://localhost:8010](http://localhost:8010)**.

---

## 📁 Included Dummy Benchmark Datasets (`data/`)

We have pre-packaged ready-to-test benchmark CSV files inside the `data/` directory. You can test reconciliation immediately with these files or upload your own exports:

| File Path | Description | Key Scenarios Included |
|---|---|---|
| [`data/ledger.csv`](file:///c:/Users/Dell/Downloads/RIP/buildathon/track04-finance-controller/data/ledger.csv) | Internal ERP / E-commerce sales records (gross orders, UPI, Card, NetBanking). | Clean payments, high-value wires, messy descriptions, holiday shifts. |
| [`data/settlement.csv`](file:///c:/Users/Dell/Downloads/RIP/buildathon/track04-finance-controller/data/settlement.csv) | Bank statement line items and payment gateway payout credits. | Exact IDs, MDR fee deductions, duplicate notices (`STL1079B`), split payouts, and chargebacks. |

> 💡 **Flexible Column Normalization:** The system automatically accepts custom column variants (`txn_id`, `id`, `ref`, `date`, `txn_date`, `merchant`, `merchant_id`, `amount`, `gross_amount`, etc.) without requiring pre-formatting.

---

## 🏗️ Core Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   RAZORPAY AI FINANCE CONTROLLER OS                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Conversational Agent Hub: Real-time streaming with 11 MCP Tools         │
│  2. 4-Tier Hybrid Matching Engine: Deterministic, Fuzzy, Semantic & Rules   │
│  3. Contract Fee Audit: MDR + GST variance & duplicate charge detection     │
│  4. Forward Cash Forecaster: 7-30 day cash projections with RBI calendar    │
│  5. 1-Click Autonomous Books Close: SOX-compliant ledger sign-off & PDF     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 How the 4-Tier Reconciliation Cascade Works

The platform operates under the ironclad principle: **"Never let the system silently guess on money."**

```
                     [Ingested Ledger & Settlement Records]
                                       │
                                       ▼
     ┌──────────────────────────────────────────────────────────────────┐
     │ Tier 1: Exact Deterministic ID Match                             │ ──► Confidence: 1.00
     │ (Exact Txn ID in ref/description + Exact Amount + T+0 Date)      │
     └─────────────────────────────────┬────────────────────────────────┘
                                       │ (Unmatched records)
                                       ▼
     ┌──────────────────────────────────────────────────────────────────┐
     │ Tier 2: Deterministic Fuzzy Tolerance                            │ ──► Confidence: 0.95
     │ (MDR Fee deductions ≤4.8% OR Banking Clearing Lag T+1 to T+4)    │
     └─────────────────────────────────┬────────────────────────────────┘
                                       │ (Unmatched records)
                                       ▼
     ┌──────────────────────────────────────────────────────────────────┐
     │ Tier 3: Semantic Vector Embeddings + Cross-Encoder Reranker       │ ──► Confidence: 0.70 - 0.90
     │ (Discovers matches on unstructured/messy banking narratives)     │
     └─────────────────────────────────┬────────────────────────────────┘
                                       │ (Remaining anomalies)
                                       ▼
     ┌──────────────────────────────────────────────────────────────────┐
     │ Tier 4: Explicit Flagged Exception Queue                         │ ──► 0% Guessing on Funds
     │ (In-transit sales, duplicate notices, unmapped credits, etc.)    │
     └──────────────────────────────────────────────────────────────────┘
```

---

## 💻 3 Ways to Use the Platform

### Option 1: The AI Copilot Chat Hub (Recommended)
1. Open **[http://localhost:8010/chat](http://localhost:8010/chat)**.
2. Click the **Paperclip 📎 icon** in the bottom floating dock to upload your `ledger.csv` and `settlement.csv` files.
3. The AI Copilot will automatically run the 4-tier engine and stream an executive summary of matched pairs and exceptions.
4. **Ask anything directly in chat:**
   * *"Why did TXN1035 and TXN1040 match in Tier 2?"*
   * *"Why did STL1079B get flagged as an exception?"*
   * *"Project our liquid cash balance for the next 7 days"*
   * *"Close today's verified books and sign off"*

---

### Option 2: The Interactive Web Dashboard
* **Overview & Cash Position (`/`):** Real-time liquid bank cash, in-transit receivables, auto-match precision rate, and proactive ML recommendations.
* **4-Tier Matches Explorer (`/reconcile`):** Sortable, paginated data table showing all 89+ verified matches, categorized by tier badge colors with 1-click CSV export.
* **Forward Cash Forecaster (`/forecast`):** Interactive 7 to 30-day liquidity projections with RBI banking holiday clearing adjustments.
* **Disputes & Holdbacks (`/disputes`):** Review active chargebacks and escrow holdback pools.
* **LLM & Provider Settings (`/settings`):** Switch between Google Gemini, OpenAI, Anthropic, or offline local Ollama air-gapped inference.

---

### Option 3: Terminal CLI Tool (`financectl`)
For DevOps, automation pipelines, and headless servers:

```powershell
# Run 4-Tier Reconciliation on custom files and export report
python cli/financectl.py reconcile --ledger "data/ledger.csv" --settlement "data/settlement.csv" --export "data/reconciled_output.csv"

# Inspect unresolved exceptions in formatted JSON
python cli/financectl.py exceptions --format json

# Check live liquid cash vs in-transit receivables
python cli/financectl.py cash-position

# Generate 7-day cash forecast
python cli/financectl.py forecast --days 7

# Perform contract fee audit
python cli/financectl.py audit

# Close daily books autonomously
python cli/financectl.py close-books
```

---

## 🛠️ Armed Model Context Protocol (MCP) Tools Catalog

The AI Copilot has live execution access to **11 Model Context Protocol (MCP) tools**:

1. `mcp::finance_get_metrics`: Live match rates, volume & fee analytics.
2. `mcp::finance_get_forecast`: 7-30 day cash flow & RBI holiday clearing projections.
3. `mcp::finance_auto_audit`: Detect contract fee leakage, duplicate charges & risk anomalies.
4. `mcp::finance_auto_close_loop`: 1-click autonomous books closure & daily ledger sign-off.
5. `mcp::finance_create_payout`: Trigger instant T+0 vendor & merchant liquidity payouts.
6. `mcp::finance_list_disputes`: Inspect chargeback dispute reserves & escrow holdbacks.
7. `mcp::finance_simulate_traffic`: Stress-test batch reconciliation with simulated spikes.
8. `mcp::finance_list_merchants`: Multi-tenant merchant directory & fee tiers.
9. `mcp::finance_export_report`: Generate auditor-grade SOX compliance PDF & GL CSV feeds.
10. `mcp::finance_run_reconciliation`: Trigger full 4-tier matching on live ledger batches.
11. `mcp::finance_explain_architecture`: 4-tier match pipeline architecture & security docs.

---

## 🧪 Self-Check Test Suite

Run the full automated test suite anytime to verify system health:

```bash
pytest tests/
```
All 8 test suites should pass in `< 0.5s`.
