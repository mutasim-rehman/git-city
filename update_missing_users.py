#!/usr/bin/env python3
"""
Fill missing GitHub API columns in a users CSV.

Only rows where enrichment columns are empty or N/A are fetched and updated.
Rows that already have real Public_Repositories values are left unchanged.

Usage:
  py update_missing_users.py
  py update_missing_users.py --csv docs/github_users_islamabad_full.csv
  py update_missing_users.py --dry-run          # count only, no API/CSV writes
  py update_missing_users.py --line 15610       # only that CSV line (incl. header)
  py update_missing_users.py --username mutasim-rehman
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import os
import sys
import time
from pathlib import Path

import aiohttp

# ── defaults (override with CLI) ───────────────────────────────────────────────
DEFAULT_CSV = "docs/github_users_islamabad_full.csv"
CHECKPOINT_FILE = "checkpoint_unified.json"
GRAPHQL_URL = "https://api.github.com/graphql"
MAX_CONCURRENT = 5
CHECKPOINT_EVERY = 100
MAX_REPOS_METADATA = 30

API_COLUMNS = [
    "Public_Repositories",
    "Lifetime_Commits",
    "Followers",
    "Total_Stars",
    "Repo_Names",
    "Repo_Metadata",
]

UNIFIED_USER_QUERY = """
query($login: String!, $cursor: String) {
  user(login: $login) {
    followers { totalCount }
    publicRepos: repositories(ownerAffiliations: OWNER, privacy: PUBLIC) {
      totalCount
    }
    ownedRepos: repositories(
      first: 100
      after: $cursor
      ownerAffiliations: OWNER
      isFork: false
      orderBy: { field: UPDATED_AT, direction: DESC }
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        description
        stargazerCount
        forkCount
        issues { totalCount }
        createdAt
        updatedAt
        primaryLanguage { name }
        repositoryTopics(first: 10) { nodes { topic { name } } }
        licenseInfo { spdxId }
        isArchived
        isFork
        defaultBranchRef {
          target {
            ... on Commit {
              history { totalCount }
            }
          }
        }
      }
    }
  }
}
"""


def repo_root() -> Path:
    return Path(__file__).resolve().parent


def load_github_key() -> str | None:
    key = os.environ.get("GITHUB_KEY", "").strip()
    if key:
        return key
    env_path = repo_root() / ".env"
    if not env_path.exists():
        return None
    for line in env_path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        if name.strip() == "GITHUB_KEY":
            value = value.strip().strip('"').strip("'")
            return value or None
    return None


def is_missing_value(value: str | None) -> bool:
    if value is None:
        return True
    v = str(value).strip()
    return v == "" or v.upper() == "N/A"


def row_needs_update(row: dict) -> bool:
    """True if API enrichment is missing or placeholder."""
    return is_missing_value(row.get("Public_Repositories"))


def row_is_filled(row: dict) -> bool:
    return not row_needs_update(row)


def load_checkpoint(path: Path) -> dict:
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        print(f"Checkpoint: {len(data):,} users in {path.name}")
        return data
    return {}


def save_checkpoint(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data), encoding="utf-8")


def load_csv(csv_path: Path) -> tuple[list[dict], list[str]]:
    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fields = list(reader.fieldnames or [])
        rows = list(reader)
    if "Username" not in fields:
        raise ValueError(f"{csv_path} must have a Username column")
    for col in API_COLUMNS:
        if col not in fields:
            fields.append(col)
    return rows, fields


def write_csv(csv_path: Path, rows: list[dict], fields: list[str]) -> None:
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def gql_node_to_metadata(node: dict) -> dict:
    topics = [
        n["topic"]["name"]
        for n in (node.get("repositoryTopics") or {}).get("nodes", [])
        if n.get("topic")
    ]
    return {
        "name": node.get("name"),
        "language": (node.get("primaryLanguage") or {}).get("name"),
        "stars": node.get("stargazerCount", 0),
        "forks": node.get("forkCount", 0),
        "open_issues": (node.get("issues") or {}).get("totalCount", 0),
        "created_at": node.get("createdAt"),
        "updated_at": node.get("updatedAt"),
        "description": (node.get("description") or "")[:500],
        "topics": topics,
        "license": (node.get("licenseInfo") or {}).get("spdxId"),
        "archived": node.get("isArchived", False),
        "fork": node.get("isFork", False),
    }


class GitHubClient:
    def __init__(self, token: str):
        self._token = token

    async def graphql(
        self,
        session: aiohttp.ClientSession,
        query: str,
        variables: dict,
        retry: int = 0,
    ) -> dict | None:
        if retry > 5:
            return None
        headers = {
            "Authorization": f"bearer {self._token}",
            "Content-Type": "application/json",
        }
        try:
            async with session.post(
                GRAPHQL_URL,
                json={"query": query, "variables": variables},
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=90),
            ) as resp:
                if resp.status == 401:
                    print("GraphQL 401 — check GITHUB_KEY in .env", file=sys.stderr)
                    return None
                if resp.status in (403, 429):
                    print("Rate limited — waiting 10 minutes...")
                    await asyncio.sleep(600)
                    return await self.graphql(session, query, variables, retry + 1)
                if resp.status != 200:
                    print(f"GraphQL HTTP {resp.status}", file=sys.stderr)
                    return None
                body = await resp.json()
                if body.get("errors"):
                    msg = body["errors"][0].get("message", body["errors"])
                    low = str(msg).lower()
                    if retry < 5 and ("rate limit" in low or "secondary" in low):
                        print(f"GraphQL: {msg} — waiting 60s")
                        await asyncio.sleep(60)
                        return await self.graphql(session, query, variables, retry + 1)
                    print(f"GraphQL error: {msg}", file=sys.stderr)
                    return None
                return body.get("data")
        except Exception as exc:
            print(f"GraphQL request failed: {exc}", file=sys.stderr)
            return None

    async def fetch_user_bundle(
        self, session: aiohttp.ClientSession, username: str
    ) -> dict | None:
        login = username.strip()
        cursor = None
        followers = public_repos = None
        lifetime_commits = 0
        total_stars = 0
        names: list[str] = []
        meta_nodes: list[dict] = []

        while True:
            data = await self.graphql(
                session,
                UNIFIED_USER_QUERY,
                {"login": login, "cursor": cursor},
            )
            user = (data or {}).get("user")
            if not user:
                return None

            if followers is None:
                followers = (user.get("followers") or {}).get("totalCount", 0)
                public_repos = (user.get("publicRepos") or {}).get("totalCount", 0)

            conn = user.get("ownedRepos") or {}
            for node in conn.get("nodes") or []:
                names.append(node.get("name") or "")
                total_stars += int(node.get("stargazerCount") or 0)
                meta_nodes.append(node)
                ref = node.get("defaultBranchRef")
                if ref and ref.get("target"):
                    lifetime_commits += ref["target"]["history"]["totalCount"]

            page = conn.get("pageInfo") or {}
            if page.get("hasNextPage"):
                cursor = page.get("endCursor")
            else:
                break

        names = [n for n in names if n]
        metadata = [gql_node_to_metadata(n) for n in meta_nodes[:MAX_REPOS_METADATA]]

        return {
            "Public_Repositories": public_repos,
            "Lifetime_Commits": lifetime_commits,
            "Followers": followers,
            "Total_Stars": total_stars,
            "Repo_Names": "|".join(names),
            "Repo_Metadata": json.dumps(metadata, ensure_ascii=False),
        }


async def run(
    csv_path: Path,
    checkpoint_path: Path,
    *,
    dry_run: bool = False,
    only_line: int | None = None,
    only_username: str | None = None,
) -> int:
    token = load_github_key()
    if not token and not dry_run:
        print("ERROR: Set GITHUB_KEY in .env or environment.", file=sys.stderr)
        return 1

    rows, fields = load_csv(csv_path)
    checkpoint = load_checkpoint(checkpoint_path)

    pending: list[dict] = []
    already_ok = 0

    for i, row in enumerate(rows):
        csv_line = i + 2  # 1-based + header
        username = row["Username"].strip()
        if only_line is not None and csv_line != only_line:
            continue
        if only_username is not None and username.lower() != only_username.lower():
            continue
        if username in checkpoint and row_is_filled(checkpoint[username]):
            for col in API_COLUMNS:
                row[col] = checkpoint[username][col]
            already_ok += 1
        elif row_is_filled(row):
            already_ok += 1
        else:
            pending.append(row)

    if only_line is not None or only_username is not None:
        label = (
            f"user {only_username}"
            if only_username
            else f"line {only_line}"
        )
        if not pending:
            target = None
            if only_username:
                target = next((r for r in rows if r["Username"].strip().lower() == only_username.lower()), None)
            elif only_line and 2 <= only_line <= len(rows) + 1:
                target = rows[only_line - 2]
            if target and row_is_filled(target):
                print(f"{label} ({target['Username']}): already filled")
                print(f"  Public_Repositories={target.get('Public_Repositories')}")
                return 0
            print(f"No matching row for {label}")
            return 1

    missing_total = sum(1 for r in rows if row_needs_update(r))
    print(f"CSV: {csv_path}")
    print(f"Total rows: {len(rows):,}")
    print(f"Already filled: {already_ok:,}")
    print(f"To update: {len(pending):,} (missing/empty/N/A in file: {missing_total:,})")

    if dry_run:
        print("\nDry run — no API calls or CSV writes.")
        if pending[:5]:
            print("First users to update:")
            for r in pending[:5]:
                print(f"  - {r['Username']}")
        return 0

    if not pending:
        print("Nothing to do.")
        return 0

    client = GitHubClient(token)
    cp_lock = asyncio.Lock()
    sem = asyncio.Semaphore(MAX_CONCURRENT)
    start = time.time()
    done = 0
    failed = 0

    async def process_one(session: aiohttp.ClientSession, row: dict) -> None:
        nonlocal done, failed
        username = row["Username"].strip()
        async with sem:
            bundle = await client.fetch_user_bundle(session, username)
            if bundle is None:
                failed += 1
                return
            for col in API_COLUMNS:
                row[col] = bundle[col]
            async with cp_lock:
                checkpoint[username] = {col: row[col] for col in API_COLUMNS}
            done += 1
            if done % CHECKPOINT_EVERY == 0:
                save_checkpoint(checkpoint_path, checkpoint)
                write_csv(csv_path, rows, fields)
                rate = done / max(time.time() - start, 0.001)
                eta = (len(pending) - done) / rate / 60 if rate else 0
                print(
                    f"  [{done:,}/{len(pending):,}] {rate:.1f}/s | "
                    f"ETA {eta:.1f} min | saved"
                )

    async with aiohttp.ClientSession(
        connector=aiohttp.TCPConnector(limit=200)
    ) as session:
        await asyncio.gather(
            *[asyncio.create_task(process_one(session, r)) for r in pending]
        )

    save_checkpoint(checkpoint_path, checkpoint)
    write_csv(csv_path, rows, fields)

    still_missing = sum(1 for r in rows if row_needs_update(r))
    print()
    if still_missing == 0:
        if checkpoint_path.exists():
            checkpoint_path.unlink()
        print(f"Done — all rows filled in {csv_path}")
    else:
        print(
            f"Finished — updated {done:,}, failed {failed:,}, "
            f"still missing {still_missing:,}."
        )
        print(f"Re-run to continue. Checkpoint: {checkpoint_path}")
    return 0 if still_missing == 0 else 2


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Update CSV rows where API columns are empty or N/A."
    )
    parser.add_argument(
        "--csv",
        default=DEFAULT_CSV,
        help=f"Input/output CSV path (default: {DEFAULT_CSV})",
    )
    parser.add_argument(
        "--checkpoint",
        default=CHECKPOINT_FILE,
        help=f"Resume checkpoint JSON (default: {CHECKPOINT_FILE})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only report how many rows need updates",
    )
    parser.add_argument(
        "--line",
        type=int,
        default=None,
        help="Process a single CSV line number only (e.g. 15610)",
    )
    parser.add_argument(
        "--username",
        default=None,
        help="Process a single GitHub username only",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.is_absolute():
        csv_path = repo_root() / csv_path
    checkpoint_path = Path(args.checkpoint)
    if not checkpoint_path.is_absolute():
        checkpoint_path = repo_root() / checkpoint_path

    if not csv_path.exists():
        print(f"ERROR: CSV not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    if args.line and args.username:
        print("ERROR: Use only one of --line or --username", file=sys.stderr)
        sys.exit(1)

    code = asyncio.run(
        run(
            csv_path,
            checkpoint_path,
            dry_run=args.dry_run,
            only_line=args.line,
            only_username=args.username,
        )
    )
    sys.exit(code)


if __name__ == "__main__":
    main()
