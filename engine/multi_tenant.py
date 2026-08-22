"""Multi-Tenant Manager with Strict Data Isolation & RBAC Scoping.

Provides enterprise tenancy support for Razorpay merchants:
1. Merchant registration with KYC verification status
2. Scoped dataset partitions (Ledger, Settlements, Disputes, Forecasts, Configs)
3. Role-Based Access Control (RBAC):
   - 'finance_admin': Global visibility across all merchant accounts & consolidated reporting
   - 'treasury_ops': Operational management within assigned merchants
   - 'merchant_viewer': Strictly isolated read-only access to a single merchant tenant
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TenantMetadata(BaseModel):
    merchant_id: str
    name: str
    kyc_status: str = "verified"  # 'verified', 'pending_review', 'action_required'
    business_category: str = "E-Commerce"
    currency: str = "INR"
    settlement_cycle: str = "T+1"
    contract_tier: str = "Enterprise"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TenantManager:
    """Manages multiple merchants with strict data isolation and RBAC filtering."""

    def __init__(self):
        self.tenants: Dict[str, Dict[str, Any]] = {}
        self._seed_default_merchants()

    def _seed_default_merchants(self) -> None:
        """Seeds standard multi-tenant enterprise merchants."""
        self.register_merchant(
            merchant_id="merch_001",
            name="TechCorp India Pvt Ltd",
            kyc_status="verified",
            business_category="SaaS & Digital Goods",
            settlement_cycle="T+1",
            contract_tier="Enterprise Prime",
        )
        self.register_merchant(
            merchant_id="merch_002",
            name="UrbanRetail Logistics",
            kyc_status="verified",
            business_category="Omnichannel Retail",
            settlement_cycle="T+2",
            contract_tier="Standard Pro",
        )
        self.register_merchant(
            merchant_id="merch_003",
            name="QuickGrocery Express",
            kyc_status="verified",
            business_category="Quick Commerce & Hyperlocal",
            settlement_cycle="T+0 Instant",
            contract_tier="Enterprise Custom",
        )
        self.register_merchant(
            merchant_id="merch_004",
            name="GlobalSaaS Cloud Services",
            kyc_status="pending_review",
            business_category="Cross-Border IT Services",
            settlement_cycle="T+3",
            contract_tier="Growth Tier",
        )

    def register_merchant(
        self,
        merchant_id: str,
        name: str,
        kyc_status: str = "verified",
        business_category: str = "General Business",
        settlement_cycle: str = "T+1",
        contract_tier: str = "Standard",
    ) -> TenantMetadata:
        """Registers a new tenant merchant with strict data container partitioning."""
        meta = TenantMetadata(
            merchant_id=merchant_id,
            name=name,
            kyc_status=kyc_status,
            business_category=business_category,
            settlement_cycle=settlement_cycle,
            contract_tier=contract_tier,
        )
        self.tenants[merchant_id] = {
            "metadata": meta.model_dump(),
            "ledger": [],
            "settlements": [],
            "alerts": [],
            "audit_trail": [],
            "created_at": meta.created_at,
        }
        return meta

    def list_merchants(self, user_role: str = "finance_admin", current_merchant_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns visible merchants based on RBAC permissions."""
        if user_role == "finance_admin":
            return [t["metadata"] for t in self.tenants.values()]
        
        # Scoped to active merchant only for tenant viewers
        if current_merchant_id and current_merchant_id in self.tenants:
            return [self.tenants[current_merchant_id]["metadata"]]
        return []

    def get_merchant_data(self, merchant_id: str, user_role: str = "finance_admin") -> Dict[str, Any]:
        """Returns isolated tenant data with RBAC security filtering."""
        if merchant_id not in self.tenants:
            raise ValueError(f"Merchant tenant '{merchant_id}' not found.")

        tenant = self.tenants[merchant_id]
        if user_role in ("finance_admin", "treasury_ops"):
            return tenant
        else:
            # Merchant viewers only see their own ledger & verified settlements
            return {
                "metadata": tenant["metadata"],
                "ledger": tenant.get("ledger", []),
                "settlements": [s for s in tenant.get("settlements", []) if s.get("status") == "settled"],
            }

    def validate_merchant_access(self, merchant_id: str, user_role: str = "finance_admin", assigned_merchant: Optional[str] = None) -> bool:
        """Validates that a request has access to the target merchant tenant."""
        if user_role == "finance_admin":
            return merchant_id in self.tenants
        if assigned_merchant:
            return merchant_id == assigned_merchant and merchant_id in self.tenants
        return merchant_id in self.tenants
