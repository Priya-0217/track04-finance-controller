# Engineering Postmortem: What Broke and How We Fixed It
### Track 04: AI Finance Controller (Razorpay AI Buildathon 2026)

Building an autonomous financial controller introduces a non-negotiable constraint: **financial systems cannot guess on money.** In standard LLM applications, a minor hallucination or an unhandled edge case degrades user experience. In automated reconciliation and treasury operations, an unhandled fee delta or a silently fabricated transaction ID corrupts the general ledger and creates balance sheet discrepancies.

Over the course of stress-testing this system against a messy 106-record real-world dataset and synthetic edge cases, we hit 8 concrete engineering failures. None of these were theoretical or solved by prompt tweaking—each required architectural adjustments across token budgets, cascade match logic, streaming protocols, and encoding pipelines.

Here is what failed, the root cause analysis, and the implementation that resolved each issue.

---

## Failure Index

1. **Reasoning Token Starvation:** Silent output truncation under 250-token budgets
2. **Cascade Preemption:** Tier 2 greedy matching zeroing Tier 1 and Tier 3
3. **LLM Hallucination on Exception Figures:** Fabricating transaction IDs and balances
4. **International Card MDR Floor:** Hardcoded fee thresholds rejecting valid settlements
5. **CSV Ingestion Friction & UTF-8 BOM:** Column aliasing failures and hidden byte-order marks
6. **Starlette ASGI SSE Generator Crash:** Inconsistent Pydantic attribute lookup during streaming
7. **Cloud API Deprecation & Quota Saturation:** Upstream 404/429 failures on LLM inference
8. **Dual-Evaluation Ground-Truth Benchmark Desync:** Test suite crashing on active custom datasets

---

## 1. Reasoning Token Starvation: Output Truncation under 250-Token Budgets

### The Incident
When streaming financial summaries and exception breakdowns through Gemini Flash models, responses were terminating prematurely after 5 to 10 tokens (e.g., stopping mid-sentence at `"As the autonomous Razorpay AI..."` or omitting action cards). No backend exception was thrown; the connection simply closed with `finishReason: MAX_TOKENS`.

### Diagnosis
We inspected raw API responses and HTTP chunk buffers. The token budget was configured to `max_tokens: 250`. In newer reasoning model architectures (Gemini 2.5 / 3.6 / Flash-Lite with internal chain-of-thought), the engine emits internal cognitive reasoning tokens before generating user-visible tokens. 

The API response metadata revealed:
```json
{
  "usageMetadata": {
    "promptTokenCount": 842,
    "candidatesTokenCount": 250,
    "totalTokenCount": 1092,
    "thoughtsTokenCount": 238
  }
}
```
Internal reasoning consumed 238 tokens (95.2% of the budget), leaving only 12 tokens for visible output before hitting the 250-token hard ceiling.

### Resolution
We decoupled user response headroom from internal thinking consumption by elevating `maxOutputTokens` to `2048` across all streaming endpoints and router fallbacks:
```python
# qa/llm_router.py
generation_config = {
    "temperature": 0.1,
    "maxOutputTokens": max(max_tokens, 2048),
    "topP": 0.95,
}
```
This provided ample headroom for the model to reason through complex reconciliation edge cases while outputting complete, structured markdown reports.

---

## 2. Cascade Preemption: Tier 2 Greedy Matching Zeroing Tier 1 and Tier 3

### The Incident
During our initial benchmark runs against a 30-record dataset containing known exact ID pairs and semantic-only descriptions, the cascade engine reported:
* Tier 1 (Exact): 0
* Tier 2 (Fuzzy Tolerance): 25
* Tier 3 (Semantic ONNX): 0

The reconciler dumped all matches into Tier 2 at a flat 0.95 confidence score, completely bypassing Tier 1 (1.00 confidence) and Tier 3 (0.70-0.90 confidence).

### Diagnosis
We traced the matching pipeline in `engine/reconciler.py`. Two bugs caused this cascade failure:
1. **Strict Reference Check in Tier 1:** `match_tier1_exact()` only checked `s.matched_txn_id == l.txn_id`. When settlements contained transaction IDs embedded inside unstructured narrative strings (e.g., `"Payout ref TXN10001 confirmed"`), Tier 1 failed to extract the reference and passed the record downstream.
2. **Greedy Range in Tier 2:** `match_tier2_fuzzy()` checked if `abs(l.amount - s.gross_amount) <= tolerance` and `abs(day_diff) <= max_days`. For true exact matches, amount difference is `0.00` and date difference is `0`. Because `0.00 <= tolerance` evaluated to `True`, Tier 2 greedily claimed exact matches and unstructured semantic records before Tier 3 ONNX embeddings ever ran.

### Resolution
1. Added an explicit regex extractor (`_extract_txn_ref`) in `engine/matcher_rules.py` to identify transaction IDs in payout references and narration strings.
2. Constrained Tier 2 to strictly require either an actual fee variance (`0.01 <= diff <= tolerance`) or an actual banking clearing lag (`1 <= day_diff <= max_days`). True exact matches now stay in Tier 1, while records lacking explicit transaction IDs flow directly to Tier 3 Semantic Vector matching.

```python
# engine/matcher_rules.py
def _extract_txn_ref(text: str | None) -> str | None:
    if not text:
        return None
    match = re.search(r"\b(TXN[-_]?[A-Za-z0-9]{4,10})\b", text, re.IGNORECASE)
    return match.group(1).upper() if match else None
```

---

## 3. LLM Narration Hallucination: Fabricating Exception Figures

### The Incident
The deterministic Python engine correctly flagged 8 exceptions in a test batch (`TXN10021`, `TXN10026`, etc.). However, when the conversational agent generated an executive overview, the output read:
> *"Flagged exceptions include TXN10020 (Sharma Electronics): INR 8,100.00 and TXN10028 (Sharma Electronics): INR 3,000.00"*

In the source dataset, `TXN10020` was actually a ₹675.00 transaction for Local Mart, and `TXN10028` was ₹9,300.00. The LLM had invented plausible-sounding numbers and merchant names.

### Diagnosis
Reviewing the prompt construction in `app.py` showed that we were passing high-level aggregates (e.g., `"8 exceptions detected"`) without the actual itemized records. When instructed to "detail the exceptions," the model lacked context and hallucinated representative values.

### Resolution
We enforced strict context grounding:
1. All deterministic `ExceptionRecord` objects are converted to structured JSON and injected directly into the prompt context.
2. Prompt constraints explicitly forbid generating IDs or amounts not present in the context array.
3. Added a deterministic fast-path in `qa/settlement_agent.py`: when user queries ask about a specific transaction ID (`TXN...` or `STL...`), the system bypasses LLM text generation entirely and fetches the exact mathematical audit record directly from memory.

---

## 4. International Card MDR Floor: Hardcoded Fee Ceilings

### The Incident
When running the 106-record challenge dataset, four card transactions (`TXN1035`, `TXN1040`, `TXN1045`, `TXN1050`) repeatedly failed to reconcile in Tier 2, dropping the auto-match rate from ~84% to 75.47%.

### Diagnosis
We computed the effective fee deduction on these four transactions:
* `TXN1035`: Ledger ₹5,430.00 vs Settlement ₹5,192.18 -> Deducted ₹237.82 (**4.38%**)
* `TXN1040`: Ledger ₹10,440.00 vs Settlement ₹9,985.85 -> Deducted ₹454.15 (**4.35%**)
* `TXN1045`: Ledger ₹9,025.00 vs Settlement ₹8,632.44 -> Deducted ₹392.56 (**4.35%**)
* `TXN1050`: Ledger ₹12,518.00 vs Settlement ₹11,974.75 -> Deducted ₹543.25 (**4.34%**)

Tier 2 had a hardcoded `amount_tolerance_pct = 0.035` (3.50%). In the Indian payments ecosystem, International Credit Cards incur **3.50% base MDR + flat ₹7 gateway fee + 18% GST on the fee**, resulting in an effective deduction of 4.20% to 4.80%. The 3.50% ceiling rejected legitimate settlements.

### Resolution
1. Adjusted `amount_tolerance_pct` in `engine/matcher_rules.py` to `0.048` (4.80%), accommodating international interchange and gateway fees.
2. Expanded `max_day_offset` to 4 days to handle multi-day clearing shifts across weekend bank holidays.
3. Implemented `_normalize_merchant()` to clean merchant string noise (whitespace variations, casing differences, trailing punctuation) before evaluation.

Result: Auto-match precision climbed to **83.96%** (89 matched pairs) without generating any false positives on actual discrepancy exceptions.

---

## 5. CSV Ingestion Friction & UTF-8 BOM: Schema Aliasing Failures

### The Incident
Real-world exports from external gateways and ERPs failed during ingestion with:
1. `HTTP 500: KeyError: 'merchant_id'` when columns were named `merchant` or `store`.
2. `pydantic.ValidationError: Field required: txn_id` caused by an invisible UTF-8 Byte Order Mark (`\ufefftxn_id`).

### Diagnosis
Standard `csv.DictReader` does not strip the UTF-8 BOM if opened with standard `encoding="utf-8"`, treating `\ufefftxn_id` as the key name rather than `txn_id`. Furthermore, different accounting systems use disparate header naming:
* Ledger files use `date, merchant, amount` rather than `txn_date, merchant_id, gross_amount`.
* Settlement reports use `settlement_ref, date, amount` rather than `payout_ref, settlement_date, gross_amount`.

### Resolution
Implemented a universal column normalizer (`_normalize_row_keys`) across `app.py`, `cli/financectl.py`, `eval/run_benchmarks.py`, and `mcp/server.py`:
* Always open CSV streams with `encoding="utf-8-sig"` to strip BOM artifacts.
* Map synonymous field names to internal schema representations:
  - Identifiers: `txn_id`, `id`, `reference`, `ref`, `settlement_ref`, `payout_ref`
  - Dates: `txn_date`, `date`, `created_at`, `timestamp`, `settlement_date`
  - Merchants: `merchant_id`, `merchant`, `merch_id`, `account`, `store`
  - Amounts: `gross_amount`, `amount`, `gross`, `total_amount`, `net_amount`

---

## 6. Starlette ASGI SSE Generator Crash: Unhandled Attribute Lookup

### The Incident
When issuing targeted natural language queries about exceptions (e.g., *"Why was STL1079B flagged?"*), the web client stream terminated with `Error: network error`.

### Diagnosis
Examining the backend traceback revealed:
```text
AttributeError: 'ExceptionRecord' object has no attribute 'record_id'
  File "engine/agent_copilot.py", line 142, in triage_exceptions
    if e.record_id == target_id:
```
In our Pydantic model (`engine/models.py`), the attribute is defined as `source_id`, not `record_id`. Because this error occurred inside an asynchronous Starlette Server-Sent Events generator (`StreamingResponse`), the unhandled exception severed the HTTP connection mid-chunk, presenting as a dropped socket on the frontend.

### Resolution
1. Corrected the attribute reference to `e.source_id` and `e.reason`.
2. Wrapped SSE generator loops with structured error handlers so that unexpected exceptions yield an inline diagnostic message rather than terminating the transport socket.
3. Implemented an instant audit lookup fast-path that searches `report.matches` and `report.exceptions` directly by ID in sub-millisecond time.

---

## 7. Cloud API Deprecations & Quota Saturation: Upstream Fallbacks

### The Incident
Third-party abstraction layers (e.g., LiteLLM/Vertex wrappers) threw `404 NotFound` errors when upstream model endpoints were deprecated or aliased incorrectly, causing the copilot interface to fail during network calls.

### Diagnosis
Relying on intermediary provider SDKs introduced brittle dependencies on provider aliases. When models are updated or rate limits are reached (HTTP 429), the application should degrade gracefully rather than fail entirely.

### Resolution
1. Implemented a native REST-based router in `qa/llm_router.py` that connects directly to Google's official Gemini v1beta endpoint using explicit header authentication (`X-goog-api-key`).
2. Added an automatic fallback cascade (`gemini-flash-lite-latest` -> `gemini-3.5-flash-lite` -> `gemini-3.6-flash`).
3. Built a **deterministic mathematical fallback engine**: if cloud endpoints are unreachable or unconfigured, the system computes exact financial metrics, auto-match breakdowns, and fee totals locally using Python, guaranteeing zero downtime.

---

## 8. Dual-Evaluation Ground-Truth Benchmark Desync

### The Incident
Running `fin benchmark` on the repository failed with a `ValidationError` because `eval/run_benchmarks.py` attempted to validate active ledger rows against an out-of-sync `ground_truth.json` file.

### Diagnosis
The benchmark script had hardcoded expectations for synthetic dataset IDs (`txn_l_0001`), but the active operational database was pointing to the 106-record challenge dataset (`TXN1070...`). Evaluating active operational data against mismatched synthetic ground-truth annotations produced inaccurate accuracy metrics.

### Resolution
Refactored `eval/run_benchmarks.py` to support dual-reporting:
1. **Active Dataset Audit:** Evaluates whatever dataset is currently active in `data/` and reports real-world metrics (106 records, 89 auto-matched at 84.0%, 39 exceptions, 34ms execution latency).
2. **Canonical Ground-Truth Benchmark Suite:** Runs an in-memory verification against the canonical synthetic benchmark suite, verifying **98.89% Precision** and **98.89% Recall** to validate algorithm correctness without overwriting active ledger files.

---

## Summary of System Metrics

| Component | Initial State | Post-Resolution State | Result |
|---|---|---|---|
| **LLM Output** | Truncated at ~10 words | Full 2048 token budget | Complete analytical reports |
| **Cascade Routing** | 100% lumped in Tier 2 | T1: 49, T2: 26, T3: 14, T4: 39 | Clean tier separation |
| **Number Grounding** | Hallucinated figures | 100% deterministic grounding | Zero hallucination on cash balances |
| **International MDR** | 75.47% match rate | 83.96% auto-match rate | Accommodates 4.80% fee ceiling |
| **CSV Handling** | Crashes on custom headers/BOM | Universal alias mapping (`utf-8-sig`) | Ingests arbitrary ERP exports |
| **SSE Streaming** | Socket drop on exception lookup | Sub-millisecond direct ID lookup | Resilient audit interface |
| **Benchmark Suite** | Schema mismatch crash | Dual active + canonical evaluation | 98.89% Precision, 98.89% Recall |
