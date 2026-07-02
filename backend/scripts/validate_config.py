#!/usr/bin/env python3
"""Validate shared config and pipeline references."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from agents.graph import load_pipeline_config  # noqa: E402
from shared_config import get_app_config  # noqa: E402


def main() -> int:
    errors: list[str] = []
    try:
        get_app_config()
    except Exception as exc:  # noqa: BLE001
        errors.append(f"app config: {exc}")

    try:
        load_pipeline_config()
    except Exception as exc:  # noqa: BLE001
        errors.append(f"pipeline config: {exc}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("Config validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
