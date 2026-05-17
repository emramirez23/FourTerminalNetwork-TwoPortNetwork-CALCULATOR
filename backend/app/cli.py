from __future__ import annotations

import argparse
import json
from pathlib import Path

from backend.app.services import solve_netlist


def main() -> None:
    parser = argparse.ArgumentParser(description="Solve MVP1 two-port netlists.")
    parser.add_argument("netlist_file", type=Path)
    parser.add_argument("--family", choices=["Z", "Y"], action="append", dest="families")
    args = parser.parse_args()

    payload = solve_netlist(args.netlist_file.read_text(encoding="utf-8"), args.families or ["Z", "Y"])
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
