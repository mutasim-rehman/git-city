# Data Workflow

## Purpose

This document explains how raw GitHub user datasets are produced and how they become app-consumable files.

## Source of Truth

- Notebook: `fetch_user_data.ipynb`
- Source datasets:
  - `docs/github_users_islamabad_full.csv`
  - `docs/github_users_karachi_full.csv`
  - `docs/github_users_lahore_full.csv`
  - `docs/github_users_pakistan_full.csv`

## Runtime Datasets

The app should consume curated files from:

- `web/public/data/islamabad.csv`
- `web/public/data/karachi.csv`
- `web/public/data/lahore.csv`

## Recommended Update Process

1. Run notebook cells to refresh source datasets in `docs/`.
2. Validate schema and row counts.
3. Generate/refresh city-level runtime CSVs under `web/public/data/`.
4. Smoke test the web app locally to confirm parsing and rendering.
5. Commit source and runtime data updates together when they are logically related.

## Path Migration Note

If the notebook still reads/writes root-level CSV paths, switch those to `docs/...` so future runs stay consistent with this layout.
