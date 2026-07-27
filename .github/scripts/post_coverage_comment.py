#!/usr/bin/env python3
"""Post a sticky PR coverage comment from a Cobertura XML file."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import urllib.error
import urllib.request

MAX_COVERAGE_BYTES = 2_000_000


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    sys.exit(1)


def github_request(method: str, path: str, payload: object | None = None) -> bytes:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        os.environ.get("GITHUB_API_URL", "https://api.github.com") + path,
        data=body,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        fail(f"GitHub API {method} {path} failed with HTTP {error.code}: {detail}")


def github_json(method: str, path: str, payload: object | None = None) -> object:
    response = github_request(method, path, payload)
    return json.loads(response.decode("utf-8")) if response else None


def read_coverage_file(path: str) -> str:
    try:
        size = os.path.getsize(path)
    except OSError as error:
        fail(f"Could not read coverage file {path!r}: {error}")
    if size > MAX_COVERAGE_BYTES:
        fail(f"Coverage XML is larger than {MAX_COVERAGE_BYTES} bytes")
    try:
        with open(path, encoding="utf-8", errors="replace") as handle:
            return handle.read()
    except OSError as error:
        fail(f"Could not read coverage file {path!r}: {error}")


def read_coverage_attrs(text: str) -> dict[str, str]:
    match = re.search(r"<coverage\b([^>]*)>", text)
    if not match:
        fail("Could not find Cobertura <coverage> root element")
    return {
        key: double if double != "" else single
        for key, double, single in re.findall(
            r'([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|\'([^\']*)\')',
            match.group(1),
        )
    }


def parse_float(attrs: dict[str, str], key: str) -> float:
    try:
        return float(attrs[key])
    except (KeyError, ValueError):
        fail(f"Coverage XML is missing numeric {key!r}")


def parse_int(attrs: dict[str, str], key: str) -> int | None:
    try:
        return int(attrs[key])
    except (KeyError, ValueError):
        return None


def build_comment(component: str, attrs: dict[str, str], minimum: float, run_url: str) -> str:
    line_rate = parse_float(attrs, "line-rate")
    if not math.isfinite(line_rate) or line_rate < 0 or line_rate > 1:
        fail("Coverage XML has an invalid line-rate")

    covered = parse_int(attrs, "lines-covered")
    valid = parse_int(attrs, "lines-valid")
    covered_text = f" ({covered}/{valid} lines)" if covered is not None and valid else ""
    percent = line_rate * 100
    status = "PASS" if percent >= minimum else "FAIL"
    marker = f"<!-- caught-looking:coverage:{component} -->"

    return "\n".join(
        [
            marker,
            f"## {component.capitalize()} coverage",
            "",
            f"Line coverage: **{percent:.2f}%**{covered_text}",
            f"Minimum: **{minimum:.0f}%** ({status})",
            "",
            f"Run: {run_url}",
        ]
    )


def post_sticky_comment(repo: str, pr_number: str, component: str, body: str) -> None:
    marker = f"<!-- caught-looking:coverage:{component} -->"
    existing_id = None
    page = 1
    while existing_id is None:
        comments = github_json(
            "GET",
            f"/repos/{repo}/issues/{pr_number}/comments?per_page=100&page={page}",
        )
        if not comments:
            break
        if not isinstance(comments, list):
            fail("GitHub comments response was not a list")
        for comment in comments:
            if isinstance(comment, dict) and marker in comment.get("body", ""):
                existing_id = comment["id"]
                break
        page += 1

    if existing_id is None:
        github_json("POST", f"/repos/{repo}/issues/{pr_number}/comments", {"body": body})
    else:
        github_json("PATCH", f"/repos/{repo}/issues/comments/{existing_id}", {"body": body})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", required=True)
    parser.add_argument("--coverage-file", required=True)
    args = parser.parse_args()

    repo = os.environ["GITHUB_REPOSITORY"]
    pr_number = os.environ["PR_NUMBER"]
    run_url = os.environ["SOURCE_RUN_URL"]
    minimum = float(os.environ["MINIMUM_COVERAGE"])

    coverage_text = read_coverage_file(args.coverage_file)
    body = build_comment(args.component, read_coverage_attrs(coverage_text), minimum, run_url)
    post_sticky_comment(repo, pr_number, args.component, body)


if __name__ == "__main__":
    main()
