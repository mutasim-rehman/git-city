# Architecture Overview

## Goal

`git-city` visualizes GitHub user/location data in a browser-based city experience.

## Top-Level Structure

- `web/`: frontend application and static assets.
  - `web/src/`: React/TypeScript source code.
  - `web/public/data/`: runtime CSVs consumed by the app.
  - `web/public/models/`: 3D assets used by the city scene.
- `fetch_user_data.ipynb`: data collection and enrichment workflow.
- `docs/`: project docs and source datasets.

## Runtime Data Flow

1. Browser loads app assets from `web/public`.
2. City components load per-city CSV files from `web/public/data`.
3. Parsed records are transformed into scene entities (buildings, NPCs, or metadata-driven visuals).
4. UI layers render details and interactions tied to selected users/cities.

## Data Pipeline Flow

1. Collect user data in `fetch_user_data.ipynb`.
2. Enrich records with additional fields.
3. Export full source CSVs (now stored in `docs/`).
4. Derive and publish app-facing CSVs to `web/public/data/`.

## Design Principles

- Keep heavy/raw source data separate from runtime assets.
- Keep runtime data small and focused for faster client loading.
- Treat notebook output as generated artifacts; document expected paths.
