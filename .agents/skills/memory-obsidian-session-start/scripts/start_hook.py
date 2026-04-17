from __future__ import annotations

import sys
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[4] / "memory-obsidian"
AGENTS = ROOT / "AGENTS.md"
INDEX = ROOT / "knowledge" / "index.md"
DAILY_DIR = ROOT / "daily"


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print("=== AGENTS.md ===")
    if AGENTS.exists():
        print(AGENTS.read_text(encoding="utf-8"))
    else:
        print("(not found)")

    print("\n=== knowledge/index.md ===")
    if INDEX.exists():
        print(INDEX.read_text(encoding="utf-8"))
    else:
        print("(not found)")

    print("\n=== latest daily log ===")
    if DAILY_DIR.exists():
        logs = sorted(DAILY_DIR.glob("*.md"))
        if logs:
            latest = logs[-1]
            print(f"File: {latest.name}")
            print(latest.read_text(encoding="utf-8"))
        else:
            print("(no daily logs)")
    else:
        print("(no daily directory)")


if __name__ == "__main__":
    main()
