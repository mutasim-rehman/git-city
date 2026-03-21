# Docs

This folder contains project documentation and source datasets that are not required at runtime by the web app.

## Contents

- `architecture.md`: high-level system structure, data flow, and key components.
- `data-workflow.md`: how dataset generation and publishing works.
- `github_users_islamabad_full.csv`: full source dataset for Islamabad users.
- `github_users_karachi_full.csv`: full source dataset for Karachi users.
- `github_users_lahore_full.csv`: full source dataset for Lahore users.
- `github_users_pakistan_full.csv`: combined source dataset for Pakistan users.

## Notes

- The production web app reads city data from `web/public/data/*.csv`.
- The CSV files in this folder are source/working data used for analysis and preprocessing.
- If paths in `fetch_user_data.ipynb` assume CSV files are in the repository root, update those paths to `docs/<filename>.csv`.
