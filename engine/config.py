"""Configuration Manager for AI Finance Controller CLI (`fin`).

Manages local API keys, default LLM providers, and merchant defaults in `~/.financectl/config.json`
or local `.env` file.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

CONFIG_DIR = Path.home() / ".financectl"
CONFIG_FILE = CONFIG_DIR / "config.json"


class FinanceConfig:
    @staticmethod
    def load() -> dict[str, Any]:
        defaults = {
            "llm_provider": os.getenv("LLM_PROVIDER", "gemini"),
            "llm_model": os.getenv("LLM_MODEL", "gemini-3.6-flash"),
            "api_key": os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY") or "",
            "default_merchant": "merch_001",
            "server_port": 8010,
        }
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    defaults.update(saved)
            except Exception:
                pass
        return defaults

    @staticmethod
    def save(updates: dict[str, Any]) -> dict[str, Any]:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        current = FinanceConfig.load()
        current.update(updates)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=2)

        # Set environment variables for current session
        if "llm_provider" in updates:
            os.environ["LLM_PROVIDER"] = updates["llm_provider"]
        if "llm_model" in updates:
            os.environ["LLM_MODEL"] = updates["llm_model"]
        if "api_key" in updates and updates["api_key"]:
            prov = current.get("llm_provider", "gemini")
            if prov == "openai":
                os.environ["OPENAI_API_KEY"] = updates["api_key"]
            elif prov == "anthropic":
                os.environ["ANTHROPIC_API_KEY"] = updates["api_key"]
            else:
                os.environ["GEMINI_API_KEY"] = updates["api_key"]

        return current
