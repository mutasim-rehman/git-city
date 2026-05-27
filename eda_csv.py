#!/usr/bin/env python3
"""
Exploratory Data Analysis for any CSV file.

Usage:
    python eda_csv.py path/to/data.csv
    python eda_csv.py path/to/data.csv --output reports/my_eda --sample 5000

Writes a text summary plus PNG plots under the output directory.
"""

from __future__ import annotations

import argparse
import json
import sys
import textwrap
import warnings
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from matplotlib.figure import Figure

warnings.filterwarnings("ignore", category=FutureWarning)

NA_VALUES = ("", "N/A", "n/a", "NA", "null", "NULL", "None", "none", "-", "nan", "NaN")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Run EDA and save plots for a CSV file.")
    p.add_argument("csv_path", type=Path, help="Path to the input CSV")
    p.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Output directory (default: eda_output/<csv_stem>)",
    )
    p.add_argument(
        "--sample",
        type=int,
        default=10_000,
        help="Max rows for heavy plots (pairplot, scatter matrix). 0 = use all rows.",
    )
    p.add_argument(
        "--top-categories",
        type=int,
        default=20,
        help="Max categories to show in bar charts",
    )
    p.add_argument("--dpi", type=int, default=120, help="Figure DPI for saved PNGs")
    p.add_argument("--no-show", action="store_true", help="Do not open plot windows")
    return p.parse_args()


def load_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, na_values=list(NA_VALUES), keep_default_na=True, low_memory=False)
    for col in df.select_dtypes(include="object").columns:
        df[col] = df[col].replace({v: np.nan for v in NA_VALUES if v not in ("",)})
    return df


def coerce_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for col in out.columns:
        if out[col].dtype == object:
            stripped = out[col].astype(str).str.strip()
            numeric = pd.to_numeric(stripped, errors="coerce")
            if numeric.notna().sum() >= 0.5 * out[col].notna().sum():
                out[col] = numeric
    return out


def sample_df(df: pd.DataFrame, n: int, random_state: int = 42) -> pd.DataFrame:
    if n <= 0 or len(df) <= n:
        return df
    return df.sample(n=n, random_state=random_state)


def save_fig(fig: Figure, path: Path, dpi: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(path, dpi=dpi, bbox_inches="tight")
    plt.close(fig)


def write_summary(df: pd.DataFrame, path: Path, csv_path: Path) -> None:
    lines: list[str] = []
    lines.append(f"EDA summary for: {csv_path.resolve()}")
    lines.append("=" * 72)
    lines.append(f"Shape: {df.shape[0]:,} rows × {df.shape[1]} columns")
    lines.append("")
    lines.append("--- dtypes ---")
    lines.append(df.dtypes.to_string())
    lines.append("")
    lines.append("--- missing (count / %) ---")
    miss = df.isna().sum()
    miss_pct = (100 * miss / len(df)).round(2)
    miss_df = pd.DataFrame({"missing": miss, "pct": miss_pct})
    lines.append(miss_df[miss_df["missing"] > 0].to_string() if miss.any() else "No missing values")
    lines.append("")
    lines.append("--- numeric describe ---")
    num = df.select_dtypes(include=np.number)
    if num.empty:
        lines.append("(no numeric columns)")
    else:
        lines.append(num.describe().T.to_string())
    lines.append("")
    lines.append("--- object describe (top values) ---")
    obj = df.select_dtypes(include=["object", "string"])
    for col in obj.columns[:15]:
        lines.append(f"\n[{col}] unique={obj[col].nunique(dropna=True)}")
        lines.append(obj[col].value_counts(dropna=True).head(10).to_string())
    if len(obj.columns) > 15:
        lines.append(f"\n... and {len(obj.columns) - 15} more object columns")
    lines.append("")
    lines.append(f"--- duplicate rows: {df.duplicated().sum():,} ---")
    path.write_text("\n".join(lines), encoding="utf-8")


def plot_missing(df: pd.DataFrame, out: Path, dpi: int) -> None:
    miss = df.isna().sum().sort_values(ascending=False)
    miss = miss[miss > 0]
    if miss.empty:
        return
    fig, ax = plt.subplots(figsize=(10, max(4, 0.35 * len(miss))))
    miss.plot(kind="barh", ax=ax, color="steelblue")
    ax.set_xlabel("Missing count")
    ax.set_title("Missing values per column")
    save_fig(fig, out / "01_missing_counts.png", dpi)


def plot_dtypes(df: pd.DataFrame, out: Path, dpi: int) -> None:
    counts = df.dtypes.astype(str).value_counts()
    fig, ax = plt.subplots(figsize=(6, 4))
    counts.plot(kind="bar", ax=ax, color="teal", rot=45)
    ax.set_ylabel("Column count")
    ax.set_title("Columns by dtype")
    save_fig(fig, out / "02_dtype_counts.png", dpi)


def plot_numeric_distributions(df: pd.DataFrame, out: Path, dpi: int) -> None:
    num = df.select_dtypes(include=np.number).columns.tolist()
    if not num:
        return
    for i, col in enumerate(num):
        series = df[col].dropna()
        if series.empty:
            continue
        fig, axes = plt.subplots(1, 3, figsize=(14, 4))
        axes[0].hist(series, bins=min(50, max(10, int(np.sqrt(len(series))))), color="cornflowerblue", edgecolor="white")
        axes[0].set_title(f"{col} — histogram")
        axes[1].boxplot(series, vert=True)
        axes[1].set_title(f"{col} — boxplot")
        sns.kdeplot(series, ax=axes[2], fill=True, color="darkorange")
        axes[2].set_title(f"{col} — KDE")
        save_fig(fig, out / f"03_numeric_{i:02d}_{_safe_name(col)}.png", dpi)


def plot_categorical_bars(df: pd.DataFrame, out: Path, dpi: int, top_n: int) -> None:
    obj = df.select_dtypes(include=["object", "string"]).columns.tolist()
    for i, col in enumerate(obj):
        vc = df[col].value_counts(dropna=True).head(top_n)
        if vc.empty or len(vc) == 1 and vc.index[0] == "":
            continue
        fig, ax = plt.subplots(figsize=(10, max(4, 0.3 * len(vc))))
        vc.sort_values().plot(kind="barh", ax=ax, color="mediumpurple")
        ax.set_title(f"{col} — top {top_n} values")
        save_fig(fig, out / f"04_categorical_{i:02d}_{_safe_name(col)}.png", dpi)


def plot_correlation_heatmap(df: pd.DataFrame, out: Path, dpi: int) -> None:
    num = df.select_dtypes(include=np.number)
    if num.shape[1] < 2:
        return
    corr = num.corr(numeric_only=True)
    size = max(6, 0.6 * len(corr))
    fig, ax = plt.subplots(figsize=(size, size))
    sns.heatmap(corr, annot=len(corr) <= 12, fmt=".2f", cmap="RdBu_r", center=0, ax=ax, square=True)
    ax.set_title("Correlation heatmap (numeric columns)")
    save_fig(fig, out / "05_correlation_heatmap.png", dpi)


def plot_pairplot(sample: pd.DataFrame, out: Path, dpi: int) -> None:
    num = sample.select_dtypes(include=np.number)
    if num.shape[1] < 2:
        return
    cols = num.columns.tolist()[:6]
    sub = num[cols].dropna(how="all")
    if len(sub) < 3:
        return
    g = sns.pairplot(sub, diag_kind="hist", corner=False, plot_kws={"alpha": 0.4, "s": 12})
    g.fig.suptitle("Pairplot (numeric, up to 6 columns)", y=1.02)
    save_fig(g.fig, out / "06_pairplot.png", dpi)


def plot_scatter_matrix(sample: pd.DataFrame, out: Path, dpi: int) -> None:
    num = sample.select_dtypes(include=np.number)
    cols = num.columns.tolist()[:5]
    if len(cols) < 2:
        return
    from pandas.plotting import scatter_matrix

    fig, _ = plt.subplots(figsize=(3 * len(cols), 3 * len(cols)))
    scatter_matrix(num[cols], alpha=0.35, figsize=(3 * len(cols), 3 * len(cols)), diagonal="hist")
    fig.suptitle("Scatter matrix")
    save_fig(fig, out / "07_scatter_matrix.png", dpi)


def plot_violin_box(sample: pd.DataFrame, out: Path, dpi: int) -> None:
    num = sample.select_dtypes(include=np.number)
    cols = num.columns.tolist()[:8]
    if not cols:
        return
    melted = num[cols].melt(var_name="column", value_name="value").dropna()
    fig, axes = plt.subplots(2, 1, figsize=(12, 8))
    sns.boxplot(data=melted, x="column", y="value", ax=axes[0])
    axes[0].tick_params(axis="x", rotation=45)
    axes[0].set_title("Boxplot — numeric columns")
    sns.violinplot(data=melted, x="column", y="value", ax=axes[1], inner="quart")
    axes[1].tick_params(axis="x", rotation=45)
    axes[1].set_title("Violin plot — numeric columns")
    save_fig(fig, out / "08_violin_box_numeric.png", dpi)


def plot_datetime_series(df: pd.DataFrame, out: Path, dpi: int) -> None:
    dt_cols = []
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            dt_cols.append(col)
            continue
        if df[col].dtype == object:
            parsed = pd.to_datetime(df[col], errors="coerce", utc=True)
            if parsed.notna().sum() >= 0.3 * df[col].notna().sum():
                df[col] = parsed
                dt_cols.append(col)
    for i, col in enumerate(dt_cols[:5]):
        counts = df[col].dropna().dt.floor("D").value_counts().sort_index()
        if counts.empty:
            continue
        fig, ax = plt.subplots(figsize=(12, 4))
        counts.plot(ax=ax, color="seagreen")
        ax.set_title(f"{col} — records over time")
        ax.set_ylabel("Count")
        save_fig(fig, out / f"09_timeseries_{i:02d}_{_safe_name(col)}.png", dpi)


def plot_text_lengths(df: pd.DataFrame, out: Path, dpi: int) -> None:
    obj = df.select_dtypes(include=["object", "string"]).columns.tolist()
    lengths = {}
    for col in obj[:10]:
        lens = df[col].dropna().astype(str).str.len()
        if lens.notna().sum() > 0:
            lengths[col] = lens
    if not lengths:
        return
    fig, ax = plt.subplots(figsize=(10, 5))
    data = pd.DataFrame(lengths)
    data.boxplot(ax=ax, rot=45)
    ax.set_ylabel("Character length")
    ax.set_title("Text column lengths")
    save_fig(fig, out / "10_text_lengths.png", dpi)


def plot_outliers_iqr(df: pd.DataFrame, out: Path, dpi: int) -> None:
    num = df.select_dtypes(include=np.number)
    if num.empty:
        return
    rows = []
    for col in num.columns:
        s = num[col].dropna()
        if s.empty:
            continue
        q1, q3 = s.quantile(0.25), s.quantile(0.75)
        iqr = q3 - q1
        low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        outliers = ((s < low) | (s > high)).sum()
        rows.append({"column": col, "outliers_iqr": outliers, "pct": 100 * outliers / len(s)})
    summary = pd.DataFrame(rows)
    fig, ax = plt.subplots(figsize=(10, max(4, 0.35 * len(summary))))
    summary.set_index("column")["outliers_iqr"].sort_values().plot(kind="barh", ax=ax, color="indianred")
    ax.set_xlabel("Outlier count (1.5×IQR rule)")
    ax.set_title("Outliers per numeric column")
    save_fig(fig, out / "11_outliers_iqr.png", dpi)
    summary.to_csv(out / "outliers_iqr.csv", index=False)


def plot_crosstab_heatmaps(df: pd.DataFrame, out: Path, dpi: int, top_n: int) -> None:
    cat = df.select_dtypes(include=["object", "string"]).columns.tolist()
    low_card = [c for c in cat if 2 <= df[c].nunique(dropna=True) <= top_n]
    if len(low_card) < 2:
        return
    a, b = low_card[0], low_card[1]
    ct = pd.crosstab(df[a], df[b])
    if ct.size > 400:
        return
    fig, ax = plt.subplots(figsize=(max(6, 0.4 * ct.shape[1]), max(5, 0.4 * ct.shape[0])))
    sns.heatmap(ct, annot=ct.size <= 100, fmt="d", cmap="YlOrRd", ax=ax)
    ax.set_title(f"Crosstab: {a} × {b}")
    save_fig(fig, out / "12_crosstab_heatmap.png", dpi)


def plot_github_extras(df: pd.DataFrame, out: Path, dpi: int) -> None:
    """Optional plots when GitHub-user CSV columns are present."""
    if "Year_Group" in df.columns:
        yg = df["Year_Group"].value_counts().sort_index()
        fig, ax = plt.subplots(figsize=(12, 4))
        yg.plot(kind="bar", ax=ax, color="slateblue")
        ax.set_title("Users by Year_Group (join cohort)")
        ax.tick_params(axis="x", rotation=90)
        save_fig(fig, out / "20_year_group_counts.png", dpi)

    if "Repo_Metadata" in df.columns:
        langs: list[str] = []
        for raw in df["Repo_Metadata"].dropna().head(5000):
            try:
                repos = json.loads(raw) if isinstance(raw, str) else raw
            except (json.JSONDecodeError, TypeError):
                continue
            if not isinstance(repos, list):
                continue
            for r in repos:
                if isinstance(r, dict) and r.get("language"):
                    langs.append(r["language"])
        if langs:
            vc = pd.Series(langs).value_counts().head(25)
            fig, ax = plt.subplots(figsize=(10, 6))
            vc.sort_values().plot(kind="barh", ax=ax, color="coral")
            ax.set_title("Top repo languages (from Repo_Metadata, sample)")
            save_fig(fig, out / "21_repo_languages.png", dpi)


def _safe_name(name: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in str(name))[:40]


def run_eda(csv_path: Path, output_dir: Path, sample_n: int, top_categories: int, dpi: int) -> Path:
    if not csv_path.is_file():
        raise FileNotFoundError(csv_path)

    output_dir.mkdir(parents=True, exist_ok=True)
    sns.set_theme(style="whitegrid", context="notebook")

    print(f"Loading {csv_path} ...")
    df = load_csv(csv_path)
    df = coerce_numeric_columns(df)
    sample = sample_df(df, sample_n)

    print(f"Rows: {len(df):,} | Columns: {df.shape[1]} | Sample for heavy plots: {len(sample):,}")
    write_summary(df, output_dir / "summary.txt", csv_path)

    print("Generating plots ...")
    plot_missing(df, output_dir, dpi)
    plot_dtypes(df, output_dir, dpi)
    plot_numeric_distributions(df, output_dir, dpi)
    plot_categorical_bars(df, output_dir, dpi, top_categories)
    plot_correlation_heatmap(df, output_dir, dpi)
    plot_pairplot(sample, output_dir, dpi)
    plot_scatter_matrix(sample, output_dir, dpi)
    plot_violin_box(sample, output_dir, dpi)
    plot_datetime_series(df.copy(), output_dir, dpi)
    plot_text_lengths(df, output_dir, dpi)
    plot_outliers_iqr(df, output_dir, dpi)
    plot_crosstab_heatmaps(df, output_dir, dpi, top_categories)
    plot_github_extras(df, output_dir, dpi)

    manifest = {
        "input": str(csv_path.resolve()),
        "rows": len(df),
        "columns": list(df.columns),
        "output_dir": str(output_dir.resolve()),
        "sample_rows": len(sample),
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Done. Reports saved to: {output_dir.resolve()}")
    return output_dir


def main() -> int:
    args = parse_args()
    if args.no_show:
        plt.ioff()

    out = args.output or Path("eda_output") / args.csv_path.stem
    try:
        run_eda(args.csv_path, out, args.sample, args.top_categories, args.dpi)
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        return 1
    except Exception as e:
        print(f"EDA failed: {e}", file=sys.stderr)
        raise
    return 0


if __name__ == "__main__":
    sys.exit(main())
