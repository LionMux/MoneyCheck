from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4] / "memory-obsidian"
DAILY_DIR = ROOT / "daily"
LOG_FILE = ROOT / "knowledge" / "log.md"


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stdin, "reconfigure"):
        sys.stdin.reconfigure(encoding="utf-8")
    summary = sys.stdin.read().strip().lstrip("\ufeff")
    if not summary:
        print("No summary provided", file=sys.stderr)
        sys.exit(1)

    today = datetime.now(timezone.utc).astimezone()
    daily_path = DAILY_DIR / f"{today.strftime('%Y-%m-%d')}.md"
    DAILY_DIR.mkdir(parents=True, exist_ok=True)

    time_str = today.strftime("%H:%M")

    if not daily_path.exists():
        daily_path.write_text(
            f"# Daily Log: {today.strftime('%Y-%m-%d')}\n\n## Sessions\n\n",
            encoding="utf-8",
        )

    entry = f"### Session ({time_str})\n\n{summary}\n\n"
    with open(daily_path, "a", encoding="utf-8") as f:
        f.write(entry)

    print(f"Saved daily entry to {daily_path.name}")

    if LOG_FILE.exists():
        first_line = summary.splitlines()[0] if summary else "(empty)"
        log_entry = (
            f"\n## [{today.strftime('%Y-%m-%d %H:%M')}] session-save | Daily log updated\n"
            f"- daily: {daily_path.name}\n"
            f"- summary: {first_line}\n"
        )
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(log_entry)
        print(f"Updated {LOG_FILE.name}")


if __name__ == "__main__":
    main()
