# Track 04: AI Finance Controller — Task Tracker

## Phase 1: Environment & Scaffolding
- [x] Standalone folder `buildathon/track04-finance-controller/`
- [x] Pinned `pyproject.toml` with `fin` and `financectl` executable entries
- [x] Global system tool installation via `uv tool install --editable buildathon/track04-finance-controller`
- [x] Directory structure (`data/`, `engine/`, `qa/`, `cli/`, `mcp/`, `eval/`, `tests/`)

## Phase 2: Synthetic Datasets & Ingestion Engine
- [x] `data/generate_synthetic_data.py` (Messy ledger/settlement pairs + ground truth matrix)
- [x] `fin load-data` (Batch generation and custom CSV ingestion)

## Phase 3: 4-Tier Reconciliation & Dynamic Fee Engine
- [x] Pydantic models in `engine/models.py`
- [x] Dynamic MDR Fee Schedule in `engine/fee_rules.py` (UPI 0%, Debit 0.9%, Credit 1.99%, Corporate 2.85%, International 3.5% + 18% GST)
- [x] Tier 1 & Tier 2 Rule Matchers in `engine/matcher_rules.py`
- [x] Tier 3 Semantic Vector Embedder & Cross-Encoder in `engine/embedder.py` and `engine/reranker.py` with SQLite SHA-256 caching
- [x] 4-Tier Reconciler in `engine/reconciler.py` (6.7ms latency, 98.89% precision)

## Phase 4: Cash Position, Merchant Portfolio & Anomaly Audits
- [x] `fin cash-position` (Liquid cash in bank, in-transit receivables, MDR fee drag, holdbacks)
- [x] `fin merchants` (Merchant accounts, fee tiers, settlement cycles, risk ratings)
- [x] `fin auto-close` (Autonomous end-to-end books closing and signed financial health sign-off)
- [x] `fin audit-ai` (AI anomaly scan for fee overcharges, trapped in-transit payouts, and orphan credits)
- [x] `fin simulate-txn` (Live transaction simulator with dynamic fee deductions and instant ledger balancing)
- [x] `fin disputes` (Track, flag, and resolve customer chargebacks and reserve holdbacks)

## Phase 5: Multi-LLM Routing & Grounded Settlement Q&A
- [x] Universal LLM Router in `qa/llm_router.py` (Gemini, Claude, GPT-4o, Ollama, OpenRouter, Groq with math-grounded fallback)
- [x] `fin config` (Switch providers, models, API keys, and default merchant)
- [x] Exact `tiktoken` budget compressor in `qa/compressor.py`
- [x] Role-Based Access Control & persistent SQLite audit logging in `qa/permissions.py`
- [x] Grounded Financial Explanation Agent in `qa/settlement_agent.py` (`fin ask "<question>"`)

## Phase 6: Standards-Compliant MCP Server & Web API
- [x] Native MCP Stdio Server in `mcp/server.py` (`fin mcp`) exposing 10 deep tools for Claude Desktop / Cursor
- [x] Interactive visual dashboard and REST API on Port 8010 (`fin serve`)
- [x] Automated Benchmark Suite in `eval/run_benchmarks.py` (`fin benchmark`)
- [x] Unit tests in `tests/test_reconciler.py` and `tests/test_enterprise_features.py` (Passed ✔)

## Phase 7: Documentation & Packaging
- [x] Comprehensive `README.md` with full CLI reference, MCP integration schema, and failure/recovery breakdown
- [x] Hatchling wheel packaging fix with force-included `app.py` and `static_dist/` for clean `uv tool install`

## Phase 8: Production Frontend Architecture (Vite + React 19 + TypeScript)
- [x] Replaced inline HTML with modular React 19 + TypeScript + Tailwind CSS application in `frontend/`
- [x] Component-driven UI: `StatCard`, `Badge`, `DataTable`, `Modal`, `ToastProvider`, `Skeleton`, `Sidebar`, `Layout`
- [x] Collapsible sidebar navigation with state persistence in `useSidebarStore`
- [x] Minimalist full-width AI Chat with floating prompt bar and instant pre-filled chips
- [x] Live LLM Connection Probe in Settings screen (`POST /api/config/test`) with latency readout (ms) and status feedback

## Phase 9: Real-Time Alerts & Notification Center (`engine/alerts_engine.py`)
- [x] Continuous anomaly detection engine for critical MDR fee variance, in-transit capital aging, fuzzy spike review, and close readiness
- [x] Interactive top bar Notification Bell with unread counter badge and animated flyout drawer (`NotificationCenter.tsx`)
- [x] 1-Click Acknowledge and Dismiss state management (`GET /api/alerts`, `POST /api/alerts/{id}/acknowledge`, `POST /api/alerts/{id}/dismiss`)

## Phase 10: Multi-Format Reports & Accounting Integrations (`engine/accounting_exporter.py`)
- [x] Executive Treasury & SOX Sign-Off PDF/HTML printable document (`GET /api/export/report/pdf`)
- [x] QuickBooks General Ledger Journal Entries CSV export with GST input tax credit receivable mapping
- [x] Xero Bank Statement Feeds CSV export with 200-REV account code mapping
- [x] Zoho Books Banking Feed CSV export with 18% GST rate breakdown
- [x] Top-bar "Export Reports" modal (`ExportReportModal.tsx`) with 1-click downloads

## Phase 11: Historical Batch Comparison & Trend Analysis (`engine/trend_analyzer.py`)
- [x] Period-over-period variance engine tracking Day-over-Day (DoD), Week-over-Week (WoW), and Month-over-Month (MoM) metrics
- [x] Auto-Match rate delta (±%), gateway fee drag drift (basis points), volume growth, and settlement velocity
- [x] Dedicated Historical Batch Comparison screen (`BatchTrends.tsx`) mounted at `/trends`

## Phase 12: ML Smart Suggestions & Actionable Financial Advisor (`engine/smart_advisor.py`)
- [x] Pattern recognition engine detecting high-ROI financial actions with estimated annual INR savings
- [x] UPI AutoPay recurring mandate migration recommendation (+₹79,560/yr ROI)
- [x] Weekend liquidity acceleration via T+0 Friday payout cutoff (+₹32,400/yr value)
- [x] Automated gateway MDR variance clawback dispute claims
- [x] Embedded Smart Advisor widget on Overview screen with 1-click execution

## Phase 13: Enterprise Multi-Tenant Architecture & RBAC (`engine/multi_tenant.py`)
- [x] `TenantManager` with merchant registration, KYC verification statuses (`verified`, `pending_review`, `action_required`), and contract tiers
- [x] Strict partition scoping for ledgers, settlements, forecasts, and alerts
- [x] Role-Based Access Control (`finance_admin` cross-merchant audit vs `merchant_viewer` tenant isolation)
- [x] Top bar `MerchantSwitcher.tsx` for seamless multi-tenant switching and RBAC role toggling

## Phase 14: Razorpay Conversational-First Agentic Platform & One-Click Actions
- [x] Conversational-First AI Hero Interface with categorized Agent Studio directives (*Settlements & Liquidity*, *Reconciliation & Audit*, *Autonomous Actions*)
- [x] Embedded One-Click Action Cards rendered directly beneath assistant responses (`ChatActionCard.tsx`)
- [x] Live MCP Tool Telemetry visualizers in assistant message headers
- [x] Proactive daily treasury greeting pill with 1-click autonomous books close shortcut

## Phase 15: Real-World 106-Record Challenge Validation, Bug Fixes & 1-Click Onboarding
- [x] Fixed LiteLLM/Vertex 404 deprecations with native Google Gemini REST API router & mathematical fallback
- [x] Fixed hidden reasoning token truncation (`thoughtsTokenCount`) by boosting `maxOutputTokens: 2048`
- [x] Resilient multi-column header normalization (`_normalize_row_keys`) handling arbitrary ERP CSV formats
- [x] Resolved 4-tier cascade preemption bug: restored Tier 1 Exact (49 records) and Tier 3 Semantic ONNX (14 records)
- [x] In-Chat CSV Upload & Direct AI Reconcile modal (`POST /api/chat/upload-and-reconcile`) with paperclip 📎 button
- [x] Grounded LLM prompt context eliminating hallucinations on transaction IDs and amounts
- [x] Added International Card fee tier tolerance (4.8% MDR + ₹7 + GST ceiling) & `_normalize_merchant()` string sanitizer
- [x] Resolved SSE stream crash on exception queries (`AttributeError: 'record_id'`) with direct ID audit lookups
- [x] Rebuilt frontend production bundle into `static_dist/` with updated tier badge colors and filters
- [x] Created cross-platform 1-click setup scripts (`setup.sh`, `setup.ps1`), `ONBOARDING.md`, and master `README.md`
- [x] All 8 automated unit test suites passing in 0.48s with 83.96% auto-match precision rate on 106-record dataset

