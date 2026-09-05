# Autonomous Razorpay AI Finance Controller OS
### Track 04: AI Finance Controller — Razorpay AI Buildathon 2026

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-38B2AC.svg)](https://tailwindcss.com/)
[![MCP Compliant](https://img.shields.io/badge/MCP-11_Tools_Armed-purple.svg)](https://modelcontextprotocol.io/)
[![Auto-Match Rate](https://img.shields.io/badge/Auto--Match_Rate-83.96%25-success.svg)](#reconciliation-metrics)
[![Ground Truth](https://img.shields.io/badge/Benchmark_Precision-98.89%25-brightgreen.svg)](#benchmark-verification)
[![Test Suite](https://img.shields.io/badge/Tests-8%2F8_Passed-brightgreen.svg)](#automated-testing)

---

## Overview

In enterprise finance operations, **verification capacity, not generation speed, is the bottleneck.** Financial operations cannot guess on money. A single fabricated transaction ID or an unverified deduction creates balance sheet discrepancies, breaks tax compliance, and corrupts the general ledger.

The **Autonomous Razorpay AI Finance Controller OS** is an end-to-end treasury and reconciliation platform designed to close the finance-ops loop across messy real-world transaction batches. It combines a deterministic 4-tier matching cascade, automated MDR fee deduction analysis, forward liquidity forecasting, and a mathematically grounded conversational agent.

---

## System Architecture

```
                  [ERP General Ledger]             [Bank Settlement Statement]
                  (Orders, Refunds, Invoices)       (Payouts, Net Credits, UTRs)
                               │                               │
                               └───────────────┬───────────────┘
                                               ▼
                              ┌─────────────────────────────────┐
                              │     Schema Normalizer Engine    │
                              │  (Aliasing & UTF-8 BOM Filter)  │
                              └────────────────┬────────────────┘
                                               ▼
                     ┌───────────────────────────────────────────────────┐
                     │            4-TIER RECONCILIATION CASCADE          │
                     ├───────────────────────────────────────────────────┤
                     │ Tier 1: Exact ID & Reference Match (Conf: 1.00)   │
                     │         Regex extraction, T+0 date, exact amount  │
                     │ Tier 2: Fuzzy Fee Tolerance Match (Conf: 0.95)   │
                     │         MDR delta (<=4.8%) or T+1 to T+4 clearing │
                     │ Tier 3: Semantic ONNX Vector Match (Conf: 0.70+)  │
                     │         Cross-Encoder rerank on messy narratives  │
                     │ Tier 4: Quarantined Exceptions (0% Guessing)      │
                     │         Split payouts, lump sums, fee leakages    │
                     └─────────────────────────┬─────────────────────────┘
                                               ▼
          ┌────────────────────────────────────┼────────────────────────────────────┐
          ▼                                    ▼                                    ▼
┌──────────────────┐                 ┌───────────────────┐                ┌──────────────────┐
│   FastAPI Core   │                 │ Terminal CLI Suite│                │  Native MCP Stdio│
│   (Port 8010)    │                 │   (fin.py / fin)  │                │  (Cursor/Claude) │
├──────────────────┤                 ├───────────────────┤                ├──────────────────┤
│ React 19 Web App │                 │ 13 Operational    │                │ 11 Deep Tools    │
│ SSE Token Stream │                 │ Batch Commands    │                │ Audit Automation │
│ Multi-Tenant RBAC│                 │ SOX Sign-Off      │                │ Safe Execution   │
└──────────────────┘                 └───────────────────┘                └──────────────────┘
```

---

## Core Capabilities

1. **4-Tier Hybrid Reconciliation Engine:**
   * **Tier 1 (Exact):** Identifies exact transaction IDs embedded in references and narration with zero amount discrepancy and T+0 clearing.
   * **Tier 2 (Fuzzy Tolerance):** Validates legitimate payment gateway fee deductions (up to 4.80% covering International MDR + ₹7 flat fee + 18% GST) and holiday banking lags (T+1 to T+4).
   * **Tier 3 (Semantic Vector Embeddings):** Discovers matches across unstructured bank narration using ONNX sentence embeddings and cross-encoder reranking.
   * **Tier 4 (Zero-Guessing Exception Queue):** Quarantines split payouts, merged lump-sum deposits, duplicate notices, and contract fee overcharges with actionable recommendations.
2. **Forward Cash Forecaster:**
   * Computes 7 to 30-day forward daily liquid cash projections.
   * Automatically detects RBI bank holidays and Sunday clearing network pauses, rolling expected settlements to the next working business day.
3. **Grounded Financial Copilot:**
   * Real-time streaming conversational agent powered by Google Gemini (with fallbacks to OpenAI, Claude, or local Ollama).
   * **Deterministic Grounding:** Cites only verified IDs and amounts from memory. If upstream LLMs are unavailable, a sub-millisecond mathematical fallback generates exact financial summaries.
4. **Autonomous Daily Books Closure & SOX Sign-Off:**
   * 1-click execution that audits ledger discrepancies, assesses balance-sheet risk, and generates a signed daily closure certificate.
5. **Model Context Protocol (MCP) Server:**
   * Stdio server exposing 11 tools for Claude Desktop and Cursor, enabling external AI environments to query balances, audit anomalies, and trigger disbursements.

---

## Reconciliation Metrics

### Real-World 106-Record Challenge Dataset (`data/ledger.csv` & `data/settlement.csv`)

| Metric | Value | Architectural Notes |
|---|---|---|
| **Auto-Match Rate** | **83.96%** (89 / 106 records) | Verified matched pairs across Tiers 1-3 |
| **Tier 1 (Exact Matches)** | **49 pairs** (Confidence: 1.00) | Exact ID extracted via regex from narrative |
| **Tier 2 (Fuzzy Tolerances)**| **26 pairs** (Confidence: 0.95) | Legitimate MDR fee & clearing shifts |
| **Tier 3 (Semantic ONNX)** | **14 pairs** (Confidence: 0.70+) | Unstructured narrative cross-encoding |
| **Quarantined Exceptions** | **39 items** | Zero false positives on safety-critical discrepancies |
| **Gross Volume Matched** | **INR 1,048,647.23** | Audited sales revenue |
| **Gateway Deductions** | **INR 7,180.07** | Verified MDR + GST processing costs |
| **Net Verified Settlement** | **INR 1,041,467.16** | 100% verified liquid cash |

### Benchmark Verification

The canonical evaluation suite (`fin benchmark`) measures classification precision and recall against ground-truth pairings:
* **Precision:** **98.89%** (Target: >= 98%)
* **Recall:** **98.89%** (Target: >= 95%)
* **F1-Score:** **98.89%**
* **Execution Latency:** **~34.5 ms**

---

## System Requirements

* **Python:** 3.11 or 3.12 (Python 3.13 supported)
* **Node.js:** 18+ and npm (only needed if modifying frontend source)
* **Operating System:** Windows, macOS, or Linux

---

## Installation & Setup

### Option 1: 1-Click Automated Setup

#### On Linux / macOS:
```bash
chmod +x setup.sh
./setup.sh
```

#### On Windows (PowerShell):
```powershell
.\setup.ps1
```

---

### Option 2: Manual Setup

#### 1. Clone the repository:
```bash
git clone <your-repo-url>
cd track04-finance-controller
```

#### 2. Create and activate a virtual environment:
```bash
# Linux / macOS:
python3 -m venv .venv
source .venv/bin/activate

# Windows (PowerShell):
python -m venv .venv
.venv\Scripts\Activate.ps1
```

#### 3. Install Python dependencies:
```bash
pip install --upgrade pip
pip install -r requirements.txt
pip install -e .
```

#### 4. Build Frontend Assets (Optional - pre-built `static_dist/` included):
```bash
cd frontend
npm install
npm run build
cd ..
```

#### 5. Configure LLM API Key (Optional):
The system runs 100% offline using deterministic mathematical models. For live LLM conversational streaming, set your Gemini API key:
```bash
# Linux / macOS:
export GEMINI_API_KEY="your-gemini-api-key"

# Windows (PowerShell):
$env:GEMINI_API_KEY="your-gemini-api-key"
```

---

## Running the System

### 1. Launch the Live Web Dashboard

Starts the FastAPI server on port 8010 serving the React 19 application:

```bash
python fin.py serve
```
*or via CLI script entry point:*
```bash
fin serve
```

Open your browser to:
* **Overview & Cash Position:** [http://localhost:8010/](http://localhost:8010/)
* **Reconciled Transactions Explorer:** [http://localhost:8010/reconcile](http://localhost:8010/reconcile)
* **Conversational AI Copilot:** [http://localhost:8010/chat](http://localhost:8010/chat)
* **Historical Batch Trends:** [http://localhost:8010/trends](http://localhost:8010/trends)
* **LLM & Gateway Settings:** [http://localhost:8010/settings](http://localhost:8010/settings)

---

### 2. Terminal CLI Suite (`fin`)

The standalone command-line interface provides direct access to all controller operations:

```bash
# Run 4-tier batch reconciliation across default or custom CSV datasets
python fin.py reconcile

# Run automated ground-truth precision & recall benchmark
python fin.py benchmark

# Display real-time settled bank cash, in-transit receivables, and fee drag
python fin.py cash-position

# Project 7-day forward liquidity incorporating RBI banking holidays
python fin.py forecast --days 7

# Run autonomous end-to-end books closure & signed SOX financial audit report
python fin.py auto-close

# Run AI anomaly audit for contract fee leakage and trapped payouts
python fin.py audit-ai

# Ask natural language questions with exact mathematical grounding
python fin.py ask "What is our current cash position and matched settlements?" --merchant "Om Traders"

# Inspect and filter quarantined exceptions
python fin.py exceptions --risk high

# Display merchant portfolio accounts, fee schedules, and settlement cycles
python fin.py merchants

# View active chargeback holdbacks and resolve disputes
python fin.py disputes

# Simulate incoming transaction with dynamic MDR deductions and ledger update
python fin.py simulate-txn --amount 25000 --method card --merchant merch_001

# Ingest custom ERP CSV files or generate fresh synthetic batches
python fin.py load-data --ledger "data/ledger.csv" --settlement "data/settlement.csv"
```

---

### 3. Model Context Protocol (MCP) Server

Launch the native stdio MCP server:
```bash
python fin.py mcp
```

#### Connecting to Claude Desktop / Cursor:
Add the following to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "razorpay-finance-controller": {
      "command": "python",
      "args": [
        "C:/path/to/track04-finance-controller/mcp/server.py"
      ],
      "env": {
        "PYTHONPATH": "C:/path/to/track04-finance-controller"
      }
    }
  }
}
```

#### Exposed MCP Tools:
| Tool Name | Purpose |
|---|---|
| `finance_get_metrics` | Retrieve live auto-match rate, verified volumes, and fee drag |
| `finance_get_forecast` | 7-to-30 day cash position forecast with holiday adjustments |
| `finance_auto_audit` | Surface contract fee overcharges and trapped in-transit funds |
| `finance_auto_close_loop` | Execute 1-click autonomous books closing & audit certificate |
| `finance_create_payout` | Dispatch T+0 merchant and vendor disbursements |
| `finance_list_disputes` | Inspect customer chargeback reserves and escrow holdbacks |
| `finance_simulate_traffic` | Stress-test reconciliation engine under transaction spikes |
| `finance_list_merchants` | Access multi-tenant merchant directory and fee schedules |
| `finance_export_report` | Generate SOX audit report PDF and GL journal CSV exports |
| `finance_run_reconciliation`| Trigger 4-tier matching engine on active ledger batches |
| `finance_explain_architecture`| Explain pipeline algorithms, security boundaries, and tiers |

---

## Automated Testing

Run the test suite:
```bash
pytest tests/
```

Expected output:
```text
============================= test session starts =============================
platform win32 -- Python 3.13.7, pytest-9.1.0, pluggy-1.6.0
collected 8 items

tests\test_enterprise_features.py .....                                  [ 62%]
tests\test_reconciler.py ...                                             [100%]

============================== 8 passed in 0.52s ==============================
```

---

## Project Structure

```text
track04-finance-controller/
├── cli/
│   └── financectl.py           # Production Typer CLI application (fin)
├── engine/
│   ├── accounting_exporter.py  # SOX PDF, QuickBooks, Xero, Zoho GL exporters
│   ├── agent_copilot.py        # Autonomous copilot with fast-path audit lookups
│   ├── alerts_engine.py        # Anomaly detection & real-time notification queue
│   ├── auto_audit.py           # Fee overcharge & trapped capital scanner
│   ├── config.py               # Application configuration & provider settings
│   ├── disputes.py             # Chargeback dispute & holdback reserve manager
│   ├── embedder.py             # Tier 3 ONNX semantic vector embedder
│   ├── fee_rules.py            # Dynamic MDR fee schedules (UPI, Cards, Int'l)
│   ├── forecaster.py           # 7-to-30 day forward liquidity & holiday logic
│   ├── matcher_rules.py        # Tier 1 Exact and Tier 2 Fuzzy matchers
│   ├── merchants.py            # Multi-tenant merchant directory manager
│   ├── models.py               # Pydantic schemas for ledgers, reports, matches
│   ├── multi_tenant.py         # Multi-tenant isolation & RBAC permissions
│   ├── payout_engine.py        # Simulated transaction injection engine
│   ├── reconciler.py           # Core 4-Tier Reconciliation Cascade Kernel
│   ├── reranker.py             # Cross-encoder semantic narrative reranker
│   ├── smart_advisor.py        # Actionable financial recommendations
│   └── trend_analyzer.py       # Period-over-period batch variance analyzer
├── frontend/                   # React 19 + TypeScript + Tailwind CSS application
│   ├── src/                    # Modular components, views, stores, hooks
│   └── package.json
├── static_dist/                # Compiled production frontend bundle
├── qa/
│   ├── compressor.py           # Tiktoken context compressor
│   ├── llm_router.py           # Universal LLM Router (Gemini Direct REST + fallbacks)
│   ├── permissions.py          # Persistent SQLite audit logging & RBAC
│   └── settlement_agent.py     # Grounded financial explanation agent
├── mcp/
│   └── server.py               # Model Context Protocol stdio server
├── eval/
│   └── run_benchmarks.py       # Automated ground-truth precision/recall benchmark
├── data/
│   ├── ledger.csv              # 106-record real-world ERP sales ledger
│   ├── settlement.csv          # 111-record real-world bank settlement report
│   ├── ground_truth.json       # Ground-truth pairing annotations
│   └── generate_synthetic_data.py # Synthetic data generation engine
├── tests/                      # Automated unit test suite
├── app.py                      # FastAPI backend server & operations REST API
├── fin.py                      # Root launcher script for CLI
├── pyproject.toml              # Build & packaging configuration
├── requirements.txt            # Pinned dependencies
├── setup.sh                    # Linux / macOS 1-click setup script
├── setup.ps1                   # Windows PowerShell 1-click setup script
├── WHAT_BROKE.md               # Detailed engineering postmortem & failure log
└── README.md                   # System documentation
```

---

## Engineering Postmortem ("What Broke")

For the complete technical postmortem detailing the 8 real-world production failure modes encountered, root cause analyses, and architectural solutions, read **[WHAT_BROKE.md](WHAT_BROKE.md)**.
