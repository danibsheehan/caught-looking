#!/usr/bin/env python3
"""Fail if .claude/skills/*/SKILL.md drifts from the routing list that points to them.

A new (or removed) skill directory is easy to forget to wire up — this repo has no
automated check for it today, unlike stack-docs versions.

Source of truth: directories under .claude/skills/ that contain a SKILL.md.

Checked docs:
  - AGENTS.md — "Step-by-step playbooks" bullet list
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

BACKTICK_NAME = re.compile(r"`([a-z][a-z0-9-]*)`")


def actual_skills(skills_dir: Path) -> set[str]:
    return {
        path.name
        for path in skills_dir.iterdir()
        if path.is_dir() and (path / "SKILL.md").is_file()
    }


def _bullet_names(section: str) -> set[str]:
    """Backtick-wrapped names before the first em dash on each top-level bullet.

    Skill bullets are always `- \\`name\\` ... — description` (AGENTS.md); names
    after the em dash are prose references (e.g. `TTLCache`), not skill names.
    """
    names: set[str] = set()
    for line in section.splitlines():
        if not re.match(r"^\s*-\s+", line):
            continue
        head = line.split("—", 1)[0]
        names.update(BACKTICK_NAME.findall(head))
    return names


def agents_md_skills(text: str) -> set[str]:
    match = re.search(r"Step-by-step playbooks.*?\n\n(.*?)(?=\n##\s+)", text, re.DOTALL)
    if not match:
        raise ValueError("AGENTS.md: no 'Step-by-step playbooks' section found")
    return _bullet_names(match.group(1))


def diff_errors(label: str, actual: set[str], listed: set[str]) -> list[str]:
    errors = [
        f"{name}: has .claude/skills/{name}/SKILL.md but missing from {label}"
        for name in sorted(actual - listed)
    ]
    errors += [
        f"{name}: listed in {label} but no .claude/skills/{name}/SKILL.md"
        for name in sorted(listed - actual)
    ]
    return errors


def main() -> int:
    skills_dir = ROOT / ".claude" / "skills"
    agents_md = ROOT / "AGENTS.md"

    try:
        actual = actual_skills(skills_dir)
        agents_listed = agents_md_skills(agents_md.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"check_skills_docs: {exc}", file=sys.stderr)
        return 1

    errors = diff_errors("AGENTS.md Step-by-step playbooks", actual, agents_listed)

    if errors:
        print("Skills docs out of sync:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        print(
            "Add or remove the skill in AGENTS.md's Step-by-step playbooks list to match "
            ".claude/skills/.",
            file=sys.stderr,
        )
        return 1

    print(f"Skills docs OK ({len(actual)} skills: {', '.join(sorted(actual))})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
