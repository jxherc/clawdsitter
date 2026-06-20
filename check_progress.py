#!/usr/bin/env python3
"""progress gate for clawdsitter.

reads progress.json, prints a status table, exits with the number of
incomplete tasks (0 == everything done). a task only counts as done when
status=='done' AND tests >= minTests, so you can't fake-pass by flipping a flag.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent
data = json.loads((ROOT / "progress.json").read_text(encoding="utf-8"))

incomplete = 0
total = 0
print(f"\n  {data['project']} progress\n")
for mv in data["microversions"]:
    tasks = mv["tasks"]
    done = 0
    for t in tasks:
        total += 1
        ok = t.get("status") == "done" and t.get("tests", 0) >= t.get("minTests", 0)
        if ok:
            done += 1
        else:
            incomplete += 1
        mark = "x" if ok else " "
        tcount = f"{t.get('tests',0)}/{t.get('minTests',0)} tests"
        print(f"    [{mark}] {t['id']:<18} {tcount:<14} {t['title']}")
    state = "done" if done == len(tasks) else f"{done}/{len(tasks)}"
    print(f"  {mv['id']} {mv['title']}  -> {state}\n")

print(f"  {total - incomplete}/{total} tasks complete, {incomplete} remaining\n")
sys.exit(incomplete)
