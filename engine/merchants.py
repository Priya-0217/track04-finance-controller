"""Merchant Directory and Portfolio Analytics Engine.

Manages merchant accounts, customized fee tiers, volume summaries, and risk ratings.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from engine.fee_rules import PaymentInstrument

MERCHANT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "merchants.json"

DEFAULT_MERCHANTS = [
    {
        "merchant_id": "merch_001",
        "business_name": "UrbanStore Electronics",
        "contact_email": "finance@urbanstore.in",
        "kyc_status": "verified",
        "fee_tier": "enterprise_discount",
        "custom_mdr_discount_pct": 0.25,  # 0.25% discount off standard MDR
        "settlement_cycle": "T+1",
        "risk_rating": "low",
        "active_disputes_count": 0,
    },
    {
        "merchant_id": "merch_002",
        "business_name": "Nova Health Essentials",
        "contact_email": "accounts@novahealth.com",
        "kyc_status": "verified",
        "fee_tier": "standard_retail",
        "custom_mdr_discount_pct": 0.0,
        "settlement_cycle": "T+2",
        "risk_rating": "low",
        "active_disputes_count": 1,
    },
    {
        "merchant_id": "merch_003",
        "business_name": "Apex Cloud Solutions",
        "contact_email": "billing@apexcloud.io",
        "kyc_status": "verified",
        "fee_tier": "saas_startup",
        "custom_mdr_discount_pct": 0.10,
        "settlement_cycle": "T+1",
        "risk_rating": "medium",
        "active_disputes_count": 0,
    },
]


class MerchantManager:
    def __init__(self, db_path: Path = MERCHANT_DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self) -> None:
        if not self.db_path.exists():
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.db_path, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_MERCHANTS, f, indent=2)

    def list_merchants(self) -> list[dict[str, Any]]:
        with open(self.db_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def get_merchant(self, merchant_id: str) -> dict[str, Any] | None:
        merchants = self.list_merchants()
        for m in merchants:
            if m["merchant_id"] == merchant_id:
                return m
        return None

    def add_merchant(
        self,
        merchant_id: str,
        business_name: str,
        contact_email: str,
        fee_tier: str = "standard_retail",
        settlement_cycle: str = "T+1",
    ) -> dict[str, Any]:
        merchants = self.list_merchants()
        new_merchant = {
            "merchant_id": merchant_id,
            "business_name": business_name,
            "contact_email": contact_email,
            "kyc_status": "verified",
            "fee_tier": fee_tier,
            "custom_mdr_discount_pct": 0.0,
            "settlement_cycle": settlement_cycle,
            "risk_rating": "low",
            "active_disputes_count": 0,
        }
        merchants.append(new_merchant)
        with open(self.db_path, "w", encoding="utf-8") as f:
            json.dump(merchants, f, indent=2)
        return new_merchant
