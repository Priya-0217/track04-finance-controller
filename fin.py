#!/usr/bin/env python
"""Direct launcher for `fin` CLI."""

import sys
from pathlib import Path

# Ensure package root is in sys.path
root_dir = str(Path(__file__).resolve().parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from cli.financectl import app

if __name__ == "__main__":
    app()
