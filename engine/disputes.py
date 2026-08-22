"""Dispute and Chargeback Holdback Manager.

Tracks payment disputes, holdbacks, merchant evidence submission, and resolution.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

DISPUTE_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "disputes.json"

DEFAULT_DISPUTES = [
    {
        "dispute_id": "disp_001",
        "merchant_id": "merch_002",
        "payout_ref": "pay_s_0088",
        "amount": 7500.0,
        "reason": "Customer claimed product not received",
        "status": "under_review",
        "evidence_due_date": "2026-08-28",
        "holdback_active": True,
    },
    {
        "dispute_id": "disp_002",
        "merchant_id": "merch_001",
        "payout_ref": "pay_s_0092",
        "amount": 25000.0,
        "reason": "Duplicate transaction authorization reported by issuing bank",
        "status": "merchant_evidence_submitted",
        "evidence_due_date": "2026-08-25",
        "holdback_active": True,
    },
]


class DisputeManager:
    def __init__(self, db_path: Path = DISPUTE_DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self) -> None:
        if not self.db_path.exists():
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.db_path, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_DISPUTES, f, indent=2)

    def list_disputes(self, merchant_id: str | None = None) -> list[dict[str, Any]]:
        with open(self.db_path, "r", encoding="utf-8") as f:
            disputes = json.load(f)
        if merchant_id:
            return [d for d in disputes if d["merchant_id"] == merchant_id]
        return disputes

    def resolve_dispute(self, dispute_id: str, outcome: str = "won") -> dict[str, Any] | None:
        disputes = self.list_disputes()
        target = None
        for d in disputes:
            if d["dispute_id"] == dispute_id:
                d["status"] = "resolved_won" if outcome == "won" else "resolved_lost"
                d["holdback_active"] = False if outcome == "won" else True
                target = d
                break
        if target:
            with open(self.db_path, "w", encoding="utf-8") as f:
                json.dump(disputes, f, indent=2)
        return target
