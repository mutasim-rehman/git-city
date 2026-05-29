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
MAX_CONCURRENT = 3
CHECKPOINT_EVERY = 50
MAX_REPOS_METADATA = 30
MAX_OWNED_REPO_PAGES = 50
MAX_COMMIT_SAMPLE_REPOS = 30
REQUEST_DELAY_SEC = 0.4
PROGRESS_EVERY = 1
TRANSIENT_HTTP = frozenset({502, 503, 504})
CHECKPOINT_MISSING_KEY = "_account_missing"

API_COLUMNS = [
    "Public_Repositories",
    "Lifetime_Commits",
    "Followers",
    "Total_Stars",
    "Repo_Names",
    "Repo_Metadata",
]

REPO_NODES_LIGHT_FRAGMENT = """
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
"""

REPO_COMMIT_HISTORY_FRAGMENT = """
        defaultBranchRef {
          target {
            ... on Commit {
              history { totalCount }
            }
          }
        }
"""

COMMITS_USER_QUERY = f"""
query($login: String!) {{
  user(login: $login) {{
    ownedRepos: repositories(
      first: {MAX_COMMIT_SAMPLE_REPOS}
      ownerAffiliations: OWNER
      isFork: false
      orderBy: {{ field: UPDATED_AT, direction: DESC }}
    ) {{
      nodes {{
{REPO_COMMIT_HISTORY_FRAGMENT}
      }}
    }}
  }}
}}
"""

COMMITS_ORG_QUERY = f"""
query($login: String!) {{
  organization(login: $login) {{
    ownedRepos: repositories(
      first: {MAX_COMMIT_SAMPLE_REPOS}
      privacy: PUBLIC
      isFork: false
      orderBy: {{ field: UPDATED_AT, direction: DESC }}
    ) {{
      nodes {{
{REPO_COMMIT_HISTORY_FRAGMENT}
      }}
    }}
  }}
}}
"""

UNIFIED_USER_QUERY = f"""
query($login: String!, $cursor: String) {{
  user(login: $login) {{
    followers {{ totalCount }}
    publicRepos: repositories(ownerAffiliations: OWNER, privacy: PUBLIC) {{
      totalCount
    }}
    ownedRepos: repositories(
      first: 100
      after: $cursor
      ownerAffiliations: OWNER
      isFork: false
      orderBy: {{ field: UPDATED_AT, direction: DESC }}
    ) {{
      pageInfo {{ hasNextPage endCursor }}
      nodes {{
{REPO_NODES_LIGHT_FRAGMENT}
      }}
    }}
  }}
}}
"""

UNIFIED_ORG_QUERY = f"""
query($login: String!, $cursor: String) {{
  organization(login: $login) {{
    publicRepos: repositories(privacy: PUBLIC) {{
      totalCount
    }}
    ownedRepos: repositories(
      first: 100
      after: $cursor
      privacy: PUBLIC
      isFork: false
      orderBy: {{ field: UPDATED_AT, direction: DESC }}
    ) {{
      pageInfo {{ hasNextPage endCursor }}
      nodes {{
{REPO_NODES_LIGHT_FRAGMENT}
      }}
    }}
  }}
}}
"""

REST_USER_URL = "https://api.github.com/users/{login}"


def repo_root() -> Path:
    return Path(__file__).resolve().parent


def log(msg: str) -> None:
    print(msg, flush=True)


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


def checkpoint_done(entry: dict) -> bool:
    """True if this login should not be fetched again."""
    if entry.get(CHECKPOINT_MISSING_KEY):
        return True
    return row_is_filled(entry)


def not_found_bundle() -> dict:
    return {
        "Public_Repositories": 0,
        "Lifetime_Commits": 0,
        "Followers": 0,
        "Total_Stars": 0,
        "Repo_Names": "",
        "Repo_Metadata": "[]",
        CHECKPOINT_MISSING_KEY: True,
    }


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
        self._rate_limit_until = 0.0
        self._rate_limit_lock = asyncio.Lock()

    async def _wait_global_rate_limit(self) -> None:
        while True:
            async with self._rate_limit_lock:
                wait = self._rate_limit_until - time.time()
            if wait <= 0:
                return
            print(f"Rate limited - pausing all workers for {wait:.0f}s...", flush=True)
            await asyncio.sleep(min(wait, 30))

    async def _extend_global_rate_limit(self, seconds: float) -> None:
        async with self._rate_limit_lock:
            self._rate_limit_until = max(
                self._rate_limit_until, time.time() + seconds
            )

    async def graphql(
        self,
        session: aiohttp.ClientSession,
        query: str,
        variables: dict,
        retry: int = 0,
        *,
        quiet: bool = False,
    ) -> tuple[dict | None, str | None]:
        """Return (data, error_message). error_message is set only on failure."""
        if retry > 8:
            return None, "max retries exceeded"
        await self._wait_global_rate_limit()
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
                    msg = "GraphQL 401 — check GITHUB_KEY in .env"
                    if not quiet:
                        print(msg, file=sys.stderr)
                    return None, msg
                if resp.status in (403, 429):
                    retry_after = resp.headers.get("Retry-After")
                    wait = (
                        int(retry_after)
                        if retry_after and str(retry_after).isdigit()
                        else min(600, 45 * (2**retry))
                    )
                    await self._extend_global_rate_limit(wait)
                    return await self.graphql(
                        session, query, variables, retry + 1, quiet=quiet
                    )
                if resp.status in TRANSIENT_HTTP:
                    wait = min(90, 4 * (2**retry))
                    if not quiet and retry == 0:
                        print(
                            f"GraphQL HTTP {resp.status} — retrying in {wait}s...",
                            file=sys.stderr,
                        )
                    await asyncio.sleep(wait)
                    return await self.graphql(
                        session, query, variables, retry + 1, quiet=quiet
                    )
                if resp.status != 200:
                    return None, f"GraphQL HTTP {resp.status}"
                body = await resp.json()
                if body.get("errors"):
                    msg = body["errors"][0].get("message", body["errors"])
                    low = str(msg).lower()
                    if retry < 8 and ("rate limit" in low or "secondary" in low):
                        wait = min(600, 45 * (2**retry))
                        await self._extend_global_rate_limit(wait)
                        return await self.graphql(
                            session, query, variables, retry + 1, quiet=quiet
                        )
                    return None, str(msg)
                return body.get("data"), None
        except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
            if retry < 8:
                wait = min(60, 3 * (2**retry))
                await asyncio.sleep(wait)
                return await self.graphql(
                    session, query, variables, retry + 1, quiet=quiet
                )
            return None, f"GraphQL request failed: {exc}"

    async def rest_account_meta(
        self, session: aiohttp.ClientSession, login: str, retry: int = 0
    ) -> dict | None:
        if retry > 5:
            return None
        await self._wait_global_rate_limit()
        headers = {
            "Authorization": f"Bearer {self._token}",
            "Accept": "application/vnd.github+json",
        }
        try:
            async with session.get(
                REST_USER_URL.format(login=login),
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status == 404:
                    return None
                if resp.status in (403, 429):
                    retry_after = resp.headers.get("Retry-After")
                    wait = (
                        int(retry_after)
                        if retry_after and str(retry_after).isdigit()
                        else min(600, 30 * (2**retry))
                    )
                    await self._extend_global_rate_limit(wait)
                    return await self.rest_account_meta(session, login, retry + 1)
                if resp.status in TRANSIENT_HTTP:
                    await asyncio.sleep(min(60, 4 * (2**retry)))
                    return await self.rest_account_meta(session, login, retry + 1)
                if resp.status != 200:
                    return None
                body = await resp.json()
                return {
                    "type": body.get("type", "User"),
                    "followers": body.get("followers", 0),
                    "public_repos": body.get("public_repos", 0),
                }
        except (aiohttp.ClientError, asyncio.TimeoutError):
            if retry < 5:
                await asyncio.sleep(min(30, 3 * (2**retry)))
                return await self.rest_account_meta(session, login, retry + 1)
            return None

    @staticmethod
    def _accumulate_repos(
        account: dict,
        *,
        names: list[str],
        meta_nodes: list[dict],
    ) -> None:
        conn = account.get("ownedRepos") or {}
        for node in conn.get("nodes") or []:
            names.append(node.get("name") or "")
            meta_nodes.append(node)

    @staticmethod
    def _sum_commit_history(nodes: list[dict]) -> int:
        total = 0
        for node in nodes:
            ref = node.get("defaultBranchRef")
            if ref and ref.get("target"):
                total += ref["target"]["history"]["totalCount"]
        return total

    async def _fetch_lifetime_commits(
        self,
        session: aiohttp.ClientSession,
        login: str,
        *,
        kind: str,
    ) -> int:
        query = COMMITS_USER_QUERY if kind == "user" else COMMITS_ORG_QUERY
        root_key = "user" if kind == "user" else "organization"
        data, err = await self.graphql(
            session, query, {"login": login}, quiet=True
        )
        if not data:
            if err:
                log(f"    {login}: commit sample skipped ({err})")
            return 0
        account = data.get(root_key) or {}
        nodes = (account.get("ownedRepos") or {}).get("nodes") or []
        return self._sum_commit_history(nodes)

    async def _fetch_graphql_bundle(
        self,
        session: aiohttp.ClientSession,
        login: str,
        *,
        kind: str,
        rest_meta: dict | None = None,
    ) -> tuple[dict | None, str | None]:
        query = UNIFIED_USER_QUERY if kind == "user" else UNIFIED_ORG_QUERY
        root_key = "user" if kind == "user" else "organization"
        cursor = None
        followers = public_repos = None
        total_stars = 0
        names: list[str] = []
        meta_nodes: list[dict] = []
        page_num = 0

        while True:
            page_num += 1
            if page_num > 1:
                log(f"    {login}: loading repo page {page_num}...")
            data, err = await self.graphql(
                session,
                query,
                {"login": login, "cursor": cursor},
                quiet=True,
            )
            account = (data or {}).get(root_key)
            if not account:
                return None, err

            if followers is None:
                if kind == "user":
                    followers = (account.get("followers") or {}).get("totalCount", 0)
                public_repos = (account.get("publicRepos") or {}).get("totalCount", 0)

            self._accumulate_repos(account, names=names, meta_nodes=meta_nodes)
            total_stars = sum(int(n.get("stargazerCount") or 0) for n in meta_nodes)

            page = (account.get("ownedRepos") or {}).get("pageInfo") or {}
            if page.get("hasNextPage") and page_num < MAX_OWNED_REPO_PAGES:
                cursor = page.get("endCursor")
            else:
                break

        if rest_meta:
            if rest_meta.get("public_repos") is not None:
                public_repos = rest_meta["public_repos"]
            if kind == "user" and rest_meta.get("followers") is not None:
                followers = rest_meta["followers"]
        if kind == "organization":
            followers = (rest_meta or {}).get("followers", 0)

        lifetime_commits = await self._fetch_lifetime_commits(
            session, login, kind=kind
        )

        names = [n for n in names if n]
        metadata = [gql_node_to_metadata(n) for n in meta_nodes[:MAX_REPOS_METADATA]]

        return {
            "Public_Repositories": public_repos,
            "Lifetime_Commits": lifetime_commits,
            "Followers": followers if followers is not None else 0,
            "Total_Stars": total_stars,
            "Repo_Names": "|".join(names),
            "Repo_Metadata": json.dumps(metadata, ensure_ascii=False),
        }, None

    async def fetch_account_bundle(
        self, session: aiohttp.ClientSession, username: str
    ) -> dict | None:
        login = username.strip()
        log(f"  -> {login}")
        meta = await self.rest_account_meta(session, login)
        if meta is None:
            log(f"  skip {login}: account not found (checkpointed)")
            return not_found_bundle()

        kind = "organization" if meta.get("type") == "Organization" else "user"
        bundle, err = await self._fetch_graphql_bundle(
            session, login, kind=kind, rest_meta=meta
        )
        if bundle is not None:
            return bundle

        if kind == "user" and err and "could not resolve to a user" in err.lower():
            bundle, err = await self._fetch_graphql_bundle(
                session, login, kind="organization", rest_meta=meta
            )
            if bundle is not None:
                return bundle

        if err and "max retries" not in err.lower():
            print(f"GraphQL error ({login}): {err}", file=sys.stderr)
        return None


async def run(
    csv_path: Path,
    checkpoint_path: Path,
    *,
    dry_run: bool = False,
    only_line: int | None = None,
    only_username: str | None = None,
    concurrency: int = MAX_CONCURRENT,
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
        if username in checkpoint and checkpoint_done(checkpoint[username]):
            cp = checkpoint[username]
            if not cp.get(CHECKPOINT_MISSING_KEY):
                for col in API_COLUMNS:
                    row[col] = cp[col]
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
        print("\nDry run - no API calls or CSV writes.")
        if pending[:5]:
            print("First users to update:")
            for r in pending[:5]:
                print(f"  - {r['Username']}")
        return 0

    if not pending:
        print("Nothing to do.")
        return 0

    log(
        f"\nFetching {len(pending):,} users "
        f"({concurrency} workers, progress every {PROGRESS_EVERY})..."
    )

    client = GitHubClient(token)
    cp_lock = asyncio.Lock()
    start = time.time()
    done = 0
    failed = 0
    processed = 0
    not_found = 0

    async def apply_bundle(username: str, row: dict, bundle: dict) -> None:
        nonlocal done, not_found
        is_missing = bool(bundle.get(CHECKPOINT_MISSING_KEY))
        cp_entry = dict(bundle)
        if not is_missing:
            for col in API_COLUMNS:
                row[col] = bundle[col]
        async with cp_lock:
            checkpoint[username] = cp_entry
        if is_missing:
            not_found += 1
        else:
            done += 1

    async def process_one(session: aiohttp.ClientSession, row: dict) -> None:
        nonlocal failed, processed
        username = row["Username"].strip()
        await asyncio.sleep(REQUEST_DELAY_SEC)
        t0 = time.time()
        bundle = await client.fetch_account_bundle(session, username)
        processed += 1
        elapsed = time.time() - t0
        if bundle is None:
            failed += 1
            if processed % PROGRESS_EVERY == 0 or processed <= 3:
                log(
                    f"  [{processed:,}/{len(pending):,}] {username} FAILED "
                    f"({elapsed:.1f}s) | fail={failed:,}"
                )
            return
        await apply_bundle(username, row, bundle)
        if processed % PROGRESS_EVERY == 0 or processed <= 3:
            log(
                f"  [{processed:,}/{len(pending):,}] {username} ok "
                f"({elapsed:.1f}s) | updated={done:,} fail={failed:,}"
            )
        if processed % CHECKPOINT_EVERY == 0:
            async with cp_lock:
                save_checkpoint(checkpoint_path, checkpoint)
                write_csv(csv_path, rows, fields)
            rate = processed / max(time.time() - start, 0.001)
            remaining = len(pending) - processed
            eta = remaining / rate / 60 if rate else 0
            log(
                f"  --- checkpoint [{processed:,}/{len(pending):,}] "
                f"ok={done:,} 404={not_found:,} fail={failed:,} | "
                f"{rate:.2f}/s | ETA {eta:.0f} min | saved ---"
            )

    sem = asyncio.Semaphore(concurrency)

    async def process_row(row: dict) -> None:
        async with sem:
            await process_one(session, row)

    async with aiohttp.ClientSession(
        connector=aiohttp.TCPConnector(limit=max(10, concurrency * 4))
    ) as session:
        await asyncio.gather(*(process_row(row) for row in pending))

    save_checkpoint(checkpoint_path, checkpoint)
    write_csv(csv_path, rows, fields)

    still_missing = sum(1 for r in rows if row_needs_update(r))
    print()
    if still_missing == 0:
        if checkpoint_path.exists():
            checkpoint_path.unlink()
        print(f"Done - all rows filled in {csv_path}")
    else:
        print(
            f"Finished - updated {done:,}, not found {not_found:,}, "
            f"failed {failed:,}, still missing {still_missing:,}."
        )
        if failed:
            print("Transient failures (502/rate limit) - re-run to retry failed rows.")
        print(f"Checkpoint: {checkpoint_path}")
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
    parser.add_argument(
        "--concurrency",
        type=int,
        default=MAX_CONCURRENT,
        help=f"Parallel workers (default: {MAX_CONCURRENT})",
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

    if args.concurrency < 1:
        print("ERROR: --concurrency must be >= 1", file=sys.stderr)
        sys.exit(1)

    code = asyncio.run(
        run(
            csv_path,
            checkpoint_path,
            dry_run=args.dry_run,
            only_line=args.line,
            only_username=args.username,
            concurrency=args.concurrency,
        )
    )
    sys.exit(code)


if __name__ == "__main__":
    main()
