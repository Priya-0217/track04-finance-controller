"""Role-Based Access Control and Governance with SQLite Audit Trail.

Lifted and adapted from Context Gateway gateway/core/permissions/engine.py.
Enforces merchant data isolation and logs all queries to an audit trail.
"""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

AUDIT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "audit_trail.db"


class PermissionEngine:
    """Enforces role-based visibility over financial records."""

    def __init__(self, db_path: Path = AUDIT_DB_PATH):
        self.db_path = db_path
        self._init_audit_table()

    def _init_audit_table(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    audit_id TEXT PRIMARY KEY,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    user_role TEXT NOT NULL,
                    merchant_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    records_accessed_count INTEGER NOT NULL,
                    query_summary TEXT NOT NULL
                )
            """)
            conn.commit()

    def filter_records_for_role(
        self,
        records: list[dict[str, Any]],
        role: str,
        requesting_merchant_id: str,
    ) -> list[dict[str, Any]]:
        """Filters data based on user role."""
        if role == "finance_admin":
            # Full visibility across all merchants
            return records
        elif role == "support_agent":
            # Mask sensitive customer PII but allow merchant records
            filtered = []
            for r in records:
                masked = dict(r)
                if "customer_name" in masked:
                    masked["customer_name"] = "REDACTED"
                filtered.append(masked)
            return filtered
        else:
            # Default 'merchant' role: Strict tenant isolation (only see own merchant_id)
            return [
                r for r in records
                if r.get("merchant_id") == requesting_merchant_id
            ]

    def log_access(
        self,
        role: str,
        merchant_id: str,
        action: str,
        records_count: int,
        query: str,
    ) -> str:
        audit_id = str(uuid.uuid4())
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute(
                "INSERT INTO audit_logs (audit_id, user_role, merchant_id, action, records_accessed_count, query_summary) VALUES (?, ?, ?, ?, ?, ?)",
                (audit_id, role, merchant_id, action, records_count, query[:300]),
            )
            conn.commit()
        return audit_id

    def get_audit_logs(self, limit: int = 50) -> list[dict[str, Any]]:
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "SELECT audit_id, timestamp, user_role, merchant_id, action, records_accessed_count, query_summary FROM audit_logs ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            )
            return [dict(row) for row in cursor.fetchall()]
