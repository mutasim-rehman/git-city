# Git City

Git City is a data-driven 3D web experience that visualizes GitHub users as an explorable city world.
The project combines a frontend game-like renderer, runtime CSV datasets, and a notebook-based data pipeline.

## Vision

- Convert GitHub profile/activity data into city entities and interactive scene content.
- Keep runtime assets optimized for browser loading.
- Keep source data and generated app data clearly separated.

## System Architecture

### 1) Application Layer (`web/`)

The web application is built with Next.js + React + TypeScript and runs fully client-side for 3D rendering.

- `web/src/app/page.tsx` orchestrates the app lifecycle:
  - boot phase (load CSV + compute layout + preload assets)
  - car selection/showroom
  - transition and gameplay phase
- `web/src/components/CityCanvas.tsx` owns scene rendering and simulation coordination.
- `web/src/components/` contains rendering and UI pieces such as city scene, selectors, building primitives, loading UI, and showroom.

### 2) Simulation + Gameplay Layer (`web/src/game/`)

Core simulation modules live under `web/src/game/`:

- Input management (`input/`)
- Vehicle movement/physics (`physics/VehicleController.ts`)
- Road graph + routing (`world/RoadGraph.ts`, `routing/aStar.ts`)
- NPC traffic behavior (`ai/NpcTraffic.ts`)
- In-game state and game loop integration (`Game.ts`, `state.ts`)
- UI overlays like minimap (`ui/Minimap.tsx`)

### 3) Data Mapping + Layout Layer (`web/src/lib/`)

Data and procedural layout helpers convert CSV records to renderable city structures:

- CSV loading/parsing (`lib/data/csvClient.ts`)
- Building scaling/feature mapping (`lib/city/scaling.ts`)
- City layout generation (`lib/city/layout.ts`)
- Window/light texture atlas generation (`lib/city/windowAtlas.ts`)
- Asset preloading (`lib/loadAssets.ts`)

### 4) Real-time Multiplayer Layer (`web/server/`)

An optional WebSocket service (`web/server/multiplayer-server.mjs`) supports shared sessions:

- city-partitioned sessions
- join/welcome/state update message flow
- max player guardrails
- continuously simulated NPC per city

### 5) Data Pipeline Layer (Repository Root + `docs/`)

- `fetch_user_data.ipynb` gathers and enriches source GitHub data.
- source/full datasets are stored in `docs/*.csv`
- runtime/curated datasets consumed by the app are stored in `web/public/data/*.csv`

## End-to-End Workflows

## A) Runtime Startup Workflow

1. App starts in boot phase.
2. City CSV is loaded from `web/public/data`.
3. Rows are mapped to buildings/entities.
4. Road/building layout is computed.
5. 3D models/textures are preloaded.
6. User enters showroom, then gameplay scene mounts with loaded state.

## B) Data Update Workflow

1. Run `fetch_user_data.ipynb` to refresh source records.
2. Save full outputs into `docs/` (source-of-truth CSVs).
3. Generate/refresh app-facing curated files in `web/public/data/`.
4. Verify schema compatibility in app (no missing required columns).
5. Launch app and smoke test city load + navigation + rendering.

## C) Feature Development Workflow

1. Implement game/render logic in `web/src`.
2. If schema assumptions change, update mapping/layout logic in `web/src/lib`.
3. Validate in local runtime with `npm run dev`.
4. Run lint checks with `npm run lint`.
5. Commit code and dataset updates together when behavior depends on both.

## Repository Structure

```text
git-city/
  README.md
  docs/
    README.md
    architecture.md
    data-workflow.md
    github_users_islamabad_full.csv
    github_users_karachi_full.csv
    github_users_lahore_full.csv
    github_users_pakistan_full.csv
  fetch_user_data.ipynb
  web/
    package.json
    public/
      data/
      models/
      audios/
    server/
      multiplayer-server.mjs
    src/
      app/
      components/
      game/
      lib/
```

## Tech Stack

- Next.js 16
- React 19
- TypeScript 5
- Three.js + React Three Fiber + Drei
- WebSockets (`ws`) for multiplayer server
- ESLint

## Local Setup

### Prerequisites

- Node.js 20+ recommended
- npm 10+ recommended

### Install

```bash
cd web
npm install
```

### Run Frontend

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run Multiplayer Server (Optional)

From `web/`:

```bash
npm run multiplayer:server
```

Server default: `ws://localhost:8787`

## Scripts

From `web/`:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run multiplayer:server
```

## Data Contracts and Conventions

- Treat `docs/*.csv` as source/full datasets for analysis and regeneration.
- Treat `web/public/data/*.csv` as runtime-optimized datasets for the client.
- Keep column names/types stable for loader + mapper compatibility.
- If notebook paths still use root-level CSV locations, migrate them to `docs/<filename>.csv`.

## Documentation Index

- `docs/README.md` - docs folder scope and inventory
- `docs/architecture.md` - architecture summary
- `docs/data-workflow.md` - dataset lifecycle and update process

## Operational Notes

- Large model/data files can grow repository size; consider Git LFS if asset volume increases.
- Keep heavy source artifacts outside runtime paths to reduce client load costs.
