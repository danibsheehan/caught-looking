#!/usr/bin/env python3
"""Fail if README / project-stack stack versions drift from manifests and CI.

Sources of truth:
  - frontend/package.json — react, typescript, vite
  - backend/go.mod — `go` directive (and optional toolchain)
  - .nvmrc — Node major (preferred); else verify.yml node-version
  - .github/workflows/verify.yml — go-version (and node-version if no .nvmrc)

Checked docs:
  - README.md badges, Tech stack table, Prerequisites
  - AGENTS.md Stack line
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _strip_npm_range(version: str) -> str:
    return version.strip().lstrip("^~>=< ")


def npm_major(version: str) -> str:
    return _strip_npm_range(version).split(".")[0]


def npm_major_minor(version: str) -> str:
    parts = _strip_npm_range(version).split(".")
    if len(parts) < 2:
        raise ValueError(f"expected major.minor in npm version {version!r}")
    return f"{parts[0]}.{parts[1]}"


def major_minor(version: str) -> str:
    parts = version.strip().split(".")
    if len(parts) < 2:
        raise ValueError(f"expected major.minor in version {version!r}")
    return f"{parts[0]}.{parts[1]}"


def read_package_versions(package_json: Path) -> dict[str, str]:
    data = json.loads(package_json.read_text(encoding="utf-8"))
    deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
    missing = [name for name in ("react", "typescript", "vite") if name not in deps]
    if missing:
        raise ValueError(f"{package_json}: missing {', '.join(missing)}")
    return {
        "react_major": npm_major(deps["react"]),
        "typescript_mm": npm_major_minor(deps["typescript"]),
        "vite_major": npm_major(deps["vite"]),
    }


def read_go_mod(go_mod: Path) -> dict[str, str]:
    text = go_mod.read_text(encoding="utf-8")
    go_match = re.search(r"(?m)^go\s+(\d+\.\d+)\s*$", text)
    if not go_match:
        raise ValueError(f"{go_mod}: no `go X.Y` directive")
    out = {"go_mm": go_match.group(1)}
    toolchain = re.search(r"(?m)^toolchain\s+go(\d+\.\d+(?:\.\d+)?)\s*$", text)
    if toolchain:
        out["toolchain"] = toolchain.group(1)
    return out


def read_node_major(root: Path, verify_yml: Path) -> str:
    nvmrc = root / ".nvmrc"
    if nvmrc.is_file():
        lines = [
            line.strip()
            for line in nvmrc.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.strip().startswith("#")
        ]
        if not lines:
            raise ValueError(f"{nvmrc}: empty")
        raw = lines[0].lstrip("v")
        major = raw.split(".")[0]
        if not major.isdigit():
            raise ValueError(f"{nvmrc}: expected Node version, got {lines[0]!r}")
        return major

    text = verify_yml.read_text(encoding="utf-8")
    node = re.search(r"(?m)^\s*node-version:\s*['\"]?(\d+)['\"]?\s*$", text)
    if not node:
        raise ValueError(f"{verify_yml}: no node-version and no .nvmrc")
    return node.group(1)


def read_verify_versions(root: Path, verify_yml: Path) -> dict[str, str]:
    # Node's version now comes from .nvmrc via dani-actions' npm-verify.yml default --
    # there's no literal node-version-file: string left in this repo's own workflow file
    # to cross-check (unlike go-version, which stays a literal string here since Backend
    # is a native job, not delegated to a shared workflow).
    text = verify_yml.read_text(encoding="utf-8")
    go = re.search(r"(?m)^\s*go-version:\s*['\"]?([\d.]+)['\"]?\s*$", text)
    if not go:
        raise ValueError(f"{verify_yml}: no go-version")
    node_major = read_node_major(root, verify_yml)
    return {"node_major": node_major, "go_version": go.group(1)}


def require_regex(text: str, pattern: str, label: str, errors: list[str]) -> re.Match[str] | None:
    match = re.search(pattern, text)
    if not match:
        errors.append(f"missing {label} (/{pattern}/)")
    return match


def check_readme(
    readme: str,
    *,
    react_major: str,
    typescript_mm: str,
    vite_major: str,
    go_mm: str,
    node_major: str,
    errors: list[str],
) -> None:
    go_badge = require_regex(
        readme,
        r"img\.shields\.io/badge/Go-([\d.]+)-",
        "Go badge",
        errors,
    )
    if go_badge and go_badge.group(1) != go_mm:
        errors.append(f"README Go badge {go_badge.group(1)!r} != go.mod {go_mm!r}")

    react_badge = require_regex(
        readme,
        r"img\.shields\.io/badge/React-(\d+)-",
        "React badge",
        errors,
    )
    if react_badge and react_badge.group(1) != react_major:
        errors.append(
            f"README React badge {react_badge.group(1)!r} != package.json react {react_major!r}"
        )

    ts_badge = require_regex(
        readme,
        r"img\.shields\.io/badge/TypeScript-([\d.]+)-",
        "TypeScript badge",
        errors,
    )
    if ts_badge and ts_badge.group(1) != typescript_mm:
        errors.append(
            f"README TypeScript badge {ts_badge.group(1)!r} != package.json typescript {typescript_mm!r}"
        )

    vite_badge = require_regex(
        readme,
        r"img\.shields\.io/badge/Vite-(\d+)-",
        "Vite badge",
        errors,
    )
    if vite_badge and vite_badge.group(1) != vite_major:
        errors.append(
            f"README Vite badge {vite_badge.group(1)!r} != package.json vite {vite_major!r}"
        )

    if not re.search(rf"(?m)^\|\s*Frontend\s*\|\s*React {re.escape(react_major)}\b", readme):
        errors.append(f"README Tech stack Frontend row missing React {react_major}")
    if not re.search(rf"(?m)^\|\s*Backend\s*\|\s*Go {re.escape(go_mm)}\b", readme):
        errors.append(f"README Tech stack Backend row missing Go {go_mm}")

    if not re.search(rf"(?m)^-\s*\*\*Go\*\*\s+{re.escape(go_mm)}\+", readme):
        errors.append(f"README Prerequisites missing Go {go_mm}+")
    if not re.search(
        rf"(?m)^-\s*\*\*Node\.js\*\*\s+{re.escape(node_major)}\+.*\bCI uses Node {re.escape(node_major)}\b",
        readme,
    ):
        errors.append(
            f"README Prerequisites missing Node.js {node_major}+ (with 'CI uses Node {node_major}')"
        )


def check_stack_line(
    text: str,
    *,
    label: str,
    react_major: str,
    go_mm: str,
    errors: list[str],
) -> None:
    if not re.search(rf"\bGo {re.escape(go_mm)}\b", text):
        errors.append(f"{label} missing Go {go_mm}")
    if not re.search(rf"\bReact {re.escape(react_major)}\b", text):
        errors.append(f"{label} missing React {react_major}")


def main() -> int:
    package_json = ROOT / "frontend" / "package.json"
    go_mod = ROOT / "backend" / "go.mod"
    verify_yml = ROOT / ".github" / "workflows" / "verify.yml"
    readme_path = ROOT / "README.md"
    agents_md = ROOT / "AGENTS.md"

    try:
        pkg = read_package_versions(package_json)
        go = read_go_mod(go_mod)
        ci = read_verify_versions(ROOT, verify_yml)
        readme = readme_path.read_text(encoding="utf-8")
        agents_text = agents_md.read_text(encoding="utf-8")
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"check_stack_docs: {exc}", file=sys.stderr)
        return 1

    errors: list[str] = []

    ci_go_mm = major_minor(ci["go_version"])
    if ci_go_mm != go["go_mm"]:
        errors.append(
            f"CI go-version {ci['go_version']!r} major.minor {ci_go_mm!r} != go.mod {go['go_mm']!r}"
        )
    if "toolchain" in go and ci["go_version"] != go["toolchain"]:
        errors.append(
            f"CI go-version {ci['go_version']!r} != go.mod toolchain {go['toolchain']!r}"
        )

    check_readme(
        readme,
        react_major=pkg["react_major"],
        typescript_mm=pkg["typescript_mm"],
        vite_major=pkg["vite_major"],
        go_mm=go["go_mm"],
        node_major=ci["node_major"],
        errors=errors,
    )
    check_stack_line(
        agents_text,
        label="AGENTS.md",
        react_major=pkg["react_major"],
        go_mm=go["go_mm"],
        errors=errors,
    )

    if errors:
        print("Stack docs out of sync:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        print(
            "Update README badges/Prerequisites/Tech stack (and AGENTS.md) to match "
            "frontend/package.json, backend/go.mod, .nvmrc, and .github/workflows/verify.yml.",
            file=sys.stderr,
        )
        return 1

    print(
        "Stack docs OK "
        f"(Go {go['go_mm']}, React {pkg['react_major']}, "
        f"TypeScript {pkg['typescript_mm']}, Vite {pkg['vite_major']}, "
        f"Node {ci['node_major']}, CI Go {ci['go_version']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
