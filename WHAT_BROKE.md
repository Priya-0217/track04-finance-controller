# 🛠️ The "What Broke" Chronicles: Building the Autonomous Razorpay AI Finance Controller OS (Track 4)

---

## 📖 Executive Overview

Financial engineering and Autonomous AI agents operate under a zero-tolerance mandate: **"Never let the system silently guess on money."** 

Throughout the development and rigorous stress-testing of the **Track 4: Autonomous Financial Reconciler & Finance Controller OS**, we encountered 7 major real-world failure modes. These were not theoretical bugs — they were systemic edge cases spanning LLM reasoning token caps, streaming protocol crashes, CSV schema friction, cascade preemption in multi-tier matching algorithms, and LLM generative hallucinations.

Here is the authentic, unvarnished story of **what broke, where we got stuck, how we diagnosed each issue, and how we engineered resilient fixes**.

---

```
                       ┌────────────────────────────────────────────────────────┐
                       │          7 CRITICAL "WHAT BROKE" MILESTONES             │
                       └────────────────────────────────────────────────────────┘
                                                   │
   [1. Cloud API Blockade] ──────► [2. Token Truncation (5-Tokens)] ─────► [3. CSV Schema 500 Crash]
   (404 / 429 Deprecations)        (Hidden Thoughts vs MaxTokens)          (KeyError: 'merchant_id')
                                                   │
                                                   ▼
   [6. Real-World Edge Cases] ◄─── [5. LLM Narration Hallucination] ◄──── [4. Cascade Preemption]
   (Int'l Card MDR & Noise)        (Fabricated Transaction IDs)            (Tier 1 & Tier 3 Zeroed)
                                                   │
                                                   ▼
                                  [7. The SSE Stream Crash]
                                  (AttributeError: 'record_id')
```

---

## 1. The Cloud API Blockade: LiteLLM 404s & Deprecated Models

### 💥 The Breakdown
At the start of the project, LLM queries routed through standard SDKs were failing with `litellm.NotFoundError: Vertex_ai_betaException` and `HTTP 404: This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use gemini-3.6-flash`. Fallback endpoints also triggered HTTP 429 rate limit saturation.

### 📍 Where We Got Stuck
The AI Copilot was completely disabled. Every chat query threw unhandled backend exceptions, making the conversational interface appear dead on arrival.

### 🔍 Root Cause Analysis
Default provider wrappers relied on outdated model aliases and third-party middleware proxies that lacked direct support for Google's latest Gemini REST API endpoints and direct header-based API key authentication (`X-goog-api-key`).

### 🔧 The Engineering Fix
* Built a dedicated `UniversalLLMRouter` directly calling `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.
* Established a prioritized model fallback cascade:
  1. `gemini-flash-lite-latest` (sub-1.5s latency)
  2. `gemini-3.5-flash-lite`
  3. `gemini-3.6-flash`
* Coupled this with a **sub-millisecond deterministic mathematical grounding fallback** ensuring the system never fails even during complete network partitions.

---

## 2. The 5-Token Truncation Mystery: Hidden Reasoning Tokens

### 💥 The Breakdown
Once connected to Gemini, the chat copilot began sending responses, but every reply stopped abruptly after just 5 to 10 words (e.g., `As the autonomous **Razorpay AI...` or `Export Executive PDF...` with truncated action cards).

### 📍 Where We Got Stuck
Initially, this looked like a frontend SSE buffer issue, a broken chunk parser, or a dropped socket connection. We inspected network packets and verified the client stream was reading chunks cleanly.

### 🔍 Root Cause Analysis
Google's newest reasoning architectures (Gemini 2.5/3.6/3.7) generate internal cognitive "thoughts" before emitting candidate output. These thoughts consume tokens under `thoughtsTokenCount` (typically ~240 tokens). 
Because `max_tokens` was configured to `250`, the model burned almost its entire budget on internal reasoning, leaving only ~5–10 tokens for visible output before hitting `finishReason: MAX_TOKENS`!

```
┌────────────────────────────────────────────────────────────────┐
│ Total Token Budget: 250 Tokens                                 │
├────────────────────────────────────────┬───────────────────────┤
│ Internal Thoughts: ~240 Tokens (96%)   │ Output: ~10 Tokens (4%) │ ──► TRUNCATED!
└────────────────────────────────────────┴───────────────────────┘
```

### 🔧 The Engineering Fix
Updated `maxOutputTokens` to `2048` across all router endpoints and copilot streaming calls (`max(max_tokens, 2048)`), providing ample headroom for deep internal reasoning and complete financial analysis.

---

## 3. CSV Schema Rigidity: The HTTP 500 Crash on Real Files

### 💥 The Breakdown
When testing in-chat CSV file reconciliation with customer-provided files, the upload crashed immediately with `HTTP 500: KeyError: 'merchant_id'`.

### 📍 Where We Got Stuck
The original CSV parser assumed strict database schema column names (`txn_id`, `txn_date`, `merchant_id`, `gross_amount`). Real accounting exports from external ERPs (Stripe, Razorpay, SAP, Zoho) use varying headers:
- `ledger.csv` had `date, merchant` instead of `txn_date, merchant_id`.
- `settlement.csv` had `settlement_ref, date, amount, merchant` instead of `payout_ref, settlement_date, gross_amount, merchant_id`.

### 🔧 The Engineering Fix
Created `_normalize_row_keys()` in both `app.py` and `cli/financectl.py` to support dynamic column alias mapping:
- **Identifiers:** `txn_id`, `id`, `reference`, `ref`, `settlement_ref`, `payout_ref`
- **Dates:** `date`, `txn_date`, `settlement_date`, `timestamp`, `created_at`
- **Merchants / Accounts:** `merchant`, `merchant_id`, `merch_id`, `account`, `store`
- **Monetary Amounts:** `amount`, `gross_amount`, `net_amount`, `gross`, `net`

---

## 4. The 4-Tier Cascade Preemption Bug: Exact & Semantic Matches Zeroed

### 💥 The Breakdown
In initial reconciliation runs against a 30-record dataset with known exact matches and semantic-only matches, the engine output was completely distorted:
```
Tier 1 Exact Matches     | 0   (Expected: 17)
Tier 2 Fuzzy Tolerances  | 25  (Expected: 5)
Tier 3 Semantic ONNX     | 0   (Expected: 2)
```

### 📍 Where We Got Stuck
The tier cascade was completely non-functional — everything was being dumped into Tier 2. The brief specifically demanded tier-by-tier confidence signals (1.00 for Exact, 0.95 for Tolerance, 0.80+ for Semantic), but the system was outputting a flat 0.95 across the board.

### 🔍 Root Cause Analysis
Two compounding flaws in the cascade matcher:
1. **Tier 1 Exact Match Bypass:** `match_tier1_exact` strictly checked `s.matched_txn_id`. When settlements had the ID embedded inside narrative descriptions (`"TXN10001 payout confirmed"`), Tier 1 failed to detect it and passed the record down.
2. **Tier 2 Greedy Preemption:** `match_tier2_fuzzy` had too wide a net: it checked if amount and date matched within tolerance. Since exact matches have 0 amount difference and 0 date lag, Tier 2 greedily claimed them before Tier 3 Semantic ONNX or Cross-Encoders ever had a chance to evaluate the narrative text.

### 🔧 The Engineering Fix
* Added `_extract_txn_ref()` regex scanner to detect embedded transaction IDs in narrative descriptions and reference strings for **Tier 1 Exact Matches**.
* Constrained **Tier 2** strictly to true fee variances (`0.01 <= diff <= 3.5%`) or date clearing lag (`1 <= day_diff <= 3`).
* Routed unstructured text without explicit IDs (`"Card settlement batch 2"` ↔ `"Payout ref batch-two settled"`) to **Tier 3 Semantic ONNX Vector + Cross-Encoder Reranking**.

```
[Incoming Ledger & Settlement Batches]
                 │
                 ▼
     ┌───────────────────────┐
     │ Tier 1: Exact ID      │ ──► ID in Ref/Desc + Exact Amount + T+0 Date  (Conf: 1.00)
     └───────────┬───────────┘
                 │ (Unmatched)
                 ▼
     ┌───────────────────────┐
     │ Tier 2: Fuzzy Toler.  │ ──► Fee Variance (≤4.8%) OR Date Lag (T+1 to T+4) (Conf: 0.95)
     └───────────┬───────────┘
                 │ (Unmatched)
                 ▼
     ┌───────────────────────┐
     │ Tier 3: Semantic ONNX │ ──► Vector Embeddings + Cross-Encoder Rerank (Conf: 0.70-0.90)
     └───────────┬───────────┘
                 │ (Remaining)
                 ▼
     ┌───────────────────────┐
     │ Tier 4: Exceptions    │ ──► Explicit Exception Matrix (0% Guessing on Funds)
     └───────────────────────┘
```

---

## 5. The LLM Narration Hallucination: Fabricating Transaction Numbers

### 💥 The Breakdown
The deterministic Python engine correctly flagged 8 exceptions (`TXN10021`, `TXN10026`, `TXN10028`, etc.). However, when the Chat UI asked Google Gemini to generate the Executive Summary, the LLM narrated:
> *"Flagged exceptions include TXN10020 (Sharma Electronics): INR 8,100.00 and TXN10028 (Sharma Electronics): INR 3,000.00"*

Neither ₹8,100 nor ₹3,000 existed anywhere in the user's dataset (`TXN10020` was actually Local Mart, ₹675; `TXN10028` was ₹9,300).

### 📍 Where We Got Stuck
This violated our fundamental architectural promise: **Zero Hallucination, 100% Grounded Financial Reporting.**

### 🔍 Root Cause Analysis
The chat upload endpoint only provided aggregate metrics in the prompt (`"8 exceptions detected"`). When the LLM was asked to "break down any exceptions", without having the actual records in its context window, it was forced to invent sample IDs and figures to fulfill the prompt instructions.

### 🔧 The Engineering Fix
* Modified `app.py` to inject the **exact deterministic array of `ExceptionRecord` objects** (`source_id`, `merchant_id`, `amount`, `date`, `reason`) directly into the LLM system prompt.
* Added explicit negative constraints instructing the model to cite **only** the provided transaction IDs and exact INR amounts.

---

## 6. Real-World Challenge Edge Cases: International MDR & String Noise

### 💥 The Breakdown
When stress-tested with an expanded 106-record dataset containing complex real-world edge cases:
1. Four records (`TXN1035`, `TXN1040`, `TXN1045`, `TXN1050`) failed to match in Tier 2.
2. Four noisy merchant string records (`TXN1092`, `TXN1093`, `TXN1094`, `TXN1095`) failed to match.

### 🔍 Root Cause Analysis
1. **International Card MDR Floor:** All 4 failing tolerance records were International Card transactions. International Card pricing in India incurs **3.5% base MDR + flat ₹7 gateway fee + 18% GST on the fee**. The effective deduction was ~4.2%–4.8%, which fell just outside our hardcoded 3.5% tolerance ceiling.
2. **Merchant String Noise:** Merchant comparisons performed strict equality without sanitization:
   - `"OM TRADERS"` failed due to uppercase.
   - `" kavya textiles "` failed due to leading/trailing whitespace.
   - `"Rani  Bakery"` failed due to internal double spaces.
   - `"sharma electronics."` failed due to trailing punctuation.

### 🔧 The Engineering Fix
* **Fee Tier Ceiling:** Updated `amount_tolerance_pct` to `0.048` (4.8%) and `max_day_offset` to `4` (supporting T+4 holiday clearing shifts).
* **Merchant Normalizer:** Built `_normalize_merchant()` to lowercase, strip non-alphanumeric punctuation, and collapse internal whitespace before comparison.
* **Impact:** Auto-match precision jumped from **75.47% to 83.96%** (89 verified matched pairs) with **zero false positives on safety-critical wrong-amount mismatches**.

---

## 7. The SSE Stream Crash: `AttributeError: 'record_id'`

### 💥 The Breakdown
When asking the chat copilot questions about specific exception items like:
- *"Why did STL1079B get flagged as an exception?"*
- *"How many exceptions were flagged and what is our total in-transit exposure?"*

The frontend chat displayed: `Error: network error`.

### 🔍 Root Cause Analysis
In `engine/agent_copilot.py`, the fast-path exception triage attempted to read `e.record_id` and `e.description` from `report.exceptions`. In Pydantic model `ExceptionRecord`, the attributes are named `source_id` and `reason`. The unhandled `AttributeError` crashed the Starlette ASGI SSE generator mid-stream.

### 🔧 The Engineering Fix
* Fixed model field references to `e.source_id` and `e.reason`.
* Implemented a dedicated **Direct Transaction & Record ID Audit Lookup Fast-Path**:
  - Whenever a user query mentions `TXN...` or `STL...`, the copilot instantly searches `report.matches` and `report.exceptions`.
  - Returns the exact resolution tier, gross/net amounts, fee variance, confidence score, and root-cause reasons with sub-millisecond latency.

---

## 📊 Final Post-Resolution Scorecard

| Milestone | Before Fix | After Fix | Status |
|---|---|---|---|
| **LLM Inference** | 404 / 429 Errors | Sub-2s Streaming via Gemini Flash Lite + Math Fallback | ✅ Operational |
| **Token Output** | Truncated at 5-10 words | Full 2048 token headroom for comprehensive reports | ✅ Operational |
| **CSV Ingestion** | HTTP 500 on custom headers | Resilient multi-column aliasing (`_normalize_row_keys`) | ✅ Operational |
| **Cascade Separation** | 100% lumped in Tier 2 | T1 Exact: 49, T2 Fuzzy: 26, T3 Semantic: 14 | ✅ Operational |
| **Grounding Precision** | Hallucinated amounts | 100% deterministic grounding from real ledger records | ✅ Zero Hallucination |
| **Edge Case Tolerance** | 75.47% match rate | **83.96% match rate** (Int'l MDR + Noise Sanitized) | ✅ Operational |
| **Chat Stability** | Network error on exception queries | Instant deep-dive audit for any `TXN`/`STL` ID | ✅ Operational |
| **Safety-Critical Tests** | 0% silent guesses on money | 100% of wrong-amount & split/merge cases flagged | ✅ 100% Safe |

---
*Razorpay Track 4: Autonomous Financial Reconciler & Finance Controller OS Submission*
