"""Shared path analysis and PR guide content for caught-looking."""

from __future__ import annotations

import re
from collections import defaultdict

OPENAPI_PREFIXES = (
    "backend/apidocs/",
    "frontend/src/types/api.generated.ts",
    "frontend/src/types/api.compat.ts",
    "frontend/src/api/client.ts",
)

AREA_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("openapi", OPENAPI_PREFIXES),
    ("frontend", ("frontend/",)),
    ("backend", ("backend/",)),
    ("ci", (".github/",)),
    ("docs", ("README.md", "docs/")),
]

AREA_DISPLAY = {
    "openapi": "OpenAPI / API types",
    "frontend": "frontend",
    "backend": "backend",
    "ci": "CI / GitHub",
    "docs": "docs",
    "other": "other",
}

META_START = "<!-- pr-guide:meta -->"
META_END = "<!-- /pr-guide:meta -->"

SUMMARY_PROMPT = (
    "<!--\n"
    "Why this change (motivation), then what changed for users/API/data.\n"
    "Prefer 1–3 short bullets. Do not list files or paste the PR guide checklist here.\n"
    "-->"
)
VERIFY_PROMPT = (
    "<!--\n"
    "User-facing steps: routes/pages to exercise, expected behavior, or \"N/A\" for tooling-only.\n"
    "CI commands belong in the sticky PR guide comment — not here.\n"
    "-->"
)

LEGACY_TEMPLATE_MARKERS = (
    "## Checklist",
    "`frontend`: `npm run lint`",
)


def matches(path: str, prefixes: tuple[str, ...]) -> bool:
    return any(path == prefix or path.startswith(prefix) for prefix in prefixes)


def areas_for(path: str) -> list[str]:
    areas: list[str] = []
    for area, prefixes in AREA_RULES:
        if matches(path, prefixes):
            areas.append(area)
    return areas or ["other"]


def analyze_paths(paths: list[str]) -> tuple[set[str], dict[str, int]]:
    area_counts: dict[str, int] = defaultdict(int)
    for path in paths:
        for area in areas_for(path):
            area_counts[area] += 1
    return set(area_counts), area_counts


def format_touches(areas: set[str]) -> str:
    ordered = [area for area, _ in AREA_RULES if area in areas]
    if "other" in areas:
        ordered.append("other")
    if not ordered:
        return "—"
    return ", ".join(AREA_DISPLAY[area] for area in ordered)


def verify_commands(areas: set[str]) -> list[str]:
    commands: list[str] = []
    if areas & {"frontend", "backend"}:
        commands.append("`make dev` — run API (:8080) and Vite together")
    if "openapi" in areas:
        commands.append("`make check-openapi` — OpenAPI lint + generated type drift check")
    if "frontend" in areas:
        commands.append(
            "`make test-frontend` — or from `frontend/`: "
            "`npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`"
        )
    if "backend" in areas:
        commands.append(
            "`make test-backend` — or from `backend/`: `go vet ./...`, "
            "`go run golang.org/x/vuln/cmd/govulncheck@latest ./...`, "
            "`go test ./... -race`, `go build .`"
        )
    if not commands:
        commands.append("N/A — tooling/docs only; confirm locally if anything user-facing changed")
    return commands


def checklist_items(areas: set[str]) -> list[str]:
    items: list[str] = []
    if "frontend" in areas:
        items.append(
            "Frontend: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`"
        )
    if "backend" in areas:
        items.append(
            "Backend: `go vet ./...`, `go run golang.org/x/vuln/cmd/govulncheck@latest ./...`, "
            "`go test ./... -race`, `go build .`"
        )
    if "openapi" in areas:
        items.append(
            "API: `backend/apidocs/openapi.yaml` updated; `npm run api:types` in `frontend/` "
            "if needed; `api.compat.ts` / `client.ts` updated; `make check-openapi` passes"
        )
    items.append("No unintended secrets or local-only config committed")
    return items


def reviewer_focus(areas: set[str], paths: list[str]) -> list[str]:
    focus: list[str] = []
    if "openapi" in areas:
        focus.append("API contract stays aligned with Go handlers and generated frontend types")
    if "frontend" in areas:
        focus.append("User-visible UI behavior and routes (`frontend/src/App.tsx`, pages)")
    if "backend" in areas and "openapi" not in areas:
        focus.append("HTTP handlers, MLB/Savant clients, and response shapes")
    if "ci" in areas:
        focus.append("Workflow changes and required status check names")
    if any("/test" in path or path.endswith("_test.go") for path in paths):
        focus.append("Test coverage and assertions for changed behavior")
    if not focus:
        focus.append("Scope looks tooling- or docs-only — confirm no hidden runtime impact")
    return focus


def _strip_html_comments(text: str) -> str:
    return re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL).strip()


def is_legacy_template(body: str) -> bool:
    return any(marker in body for marker in LEGACY_TEMPLATE_MARKERS)


def summary_section_is_empty(body: str) -> bool:
    match = re.search(r"## Summary\s*\n+(.*?)\n+## How to verify", body, re.DOTALL | re.IGNORECASE)
    if not match:
        return True
    return not _strip_html_comments(match.group(1))


def should_full_scaffold(body: str) -> bool:
    stripped = body.strip()
    if not stripped:
        return True
    if is_legacy_template(body):
        return True
    if "## Summary" in body and "## How to verify" in body and summary_section_is_empty(body):
        return META_START not in body
    return False


def has_meta_block(body: str) -> bool:
    return META_START in body and META_END in body


def build_meta_block(areas: set[str]) -> str:
    return (
        f"**Touches:** {format_touches(areas)}\n\n"
        "Supporting checklist (CI commands, path-based reviewer focus): see the sticky "
        "**PR guide** comment — not a substitute for **Summary** above."
    )


def build_full_body(areas: set[str]) -> str:
    return "\n".join(
        [
            "## Summary",
            "",
            SUMMARY_PROMPT,
            "",
            "## How to verify",
            "",
            VERIFY_PROMPT,
            "",
            "_Suggested local check:_ `make ci-local`",
            "",
            META_START,
            build_meta_block(areas),
            META_END,
            "",
        ]
    )


def merge_pr_body(current: str, areas: set[str]) -> str | None:
    if should_full_scaffold(current):
        return build_full_body(areas)
    if has_meta_block(current):
        meta = f"{META_START}\n{build_meta_block(areas)}\n{META_END}"
        return re.sub(
            re.escape(META_START) + r".*?" + re.escape(META_END),
            meta,
            current,
            count=1,
            flags=re.DOTALL,
        )
    return None
