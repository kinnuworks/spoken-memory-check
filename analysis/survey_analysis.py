"""Probe: do fixed cutoffs on spoken cognitive tasks misfire by schooling in real data?

NHANES 2011-2014 (public domain), adults 60+. Tasks are spoken: animal fluency and
CERAD word-list delayed recall. Outcomes kept apart from the test scores:
  - MCQ084: memory loss / confusion getting worse in the past 12 months (self-report)
  - PFQ061A: difficulty managing money
Usage: python nhanes_probe.py <data-dir>
"""
import sys
import pathlib

import numpy as np
import pandas as pd

data = pathlib.Path(sys.argv[1])


def load(stem):
    parts = [pd.read_sas(data / f"{stem}_{c}.xpt", format="xport") for c in "GH"]
    return pd.concat(parts, ignore_index=True)


cfq, demo, mcq, pfq = load("CFQ"), load("DEMO"), load("MCQ"), load("PFQ")
df = (
    cfq.merge(demo, on="SEQN", how="left")
    .merge(mcq[["SEQN", "MCQ084"]], on="SEQN", how="left")
    .merge(pfq[["SEQN", "PFQ061A"]], on="SEQN", how="left")
)
df["imm"] = df[["CFDCST1", "CFDCST2", "CFDCST3"]].sum(axis=1, min_count=3)
df["delay"] = df["CFDCSR"]
df["fluency"] = df["CFDAST"]
edu_names = {1: "<9th grade", 2: "9-11th", 3: "High school", 4: "Some college", 5: "College+"}
df["edu"] = df["DMDEDUC2"].where(df["DMDEDUC2"].isin(edu_names)).map(edu_names)
eth_names = {1: "Mexican American", 2: "Other Hispanic", 3: "White", 4: "Black", 6: "Asian", 7: "Other"}
df["eth"] = df["RIDRETH3"].map(eth_names)
df["memory_worse"] = df["MCQ084"].map({1: 1, 2: 0})
df["money_diff"] = df["PFQ061A"].map({1: 0, 2: 1, 3: 1, 4: 1})
df["no_complaint"] = (df["memory_worse"] == 0) & (df["money_diff"] == 0)

print("rows", len(df), "| with fluency", df.fluency.notna().sum(), "| with delayed recall", df.delay.notna().sum())
print("age range", df.RIDAGEYR.min(), df.RIDAGEYR.max())
print("interview language codes (CFALANG):", df.CFALANG.value_counts(dropna=False).to_dict())
print("memory worse (yes share):", round(df.memory_worse.mean(), 3), "| money difficulty:", round(df.money_diff.mean(), 3))
print("no complaint on either:", int(df.no_complaint.sum()))

order = list(edu_names.values())
print("\n== Scores by schooling (all adults 60+) ==")
print(df.groupby("edu")[["fluency", "delay", "imm"]].agg(["mean", "std", "count"]).round(2).reindex(order))

FLU_CUT, DEL_CUT = 14, 5  # fixed cutoffs often used in clinics: <14 animals, <5 words recalled
well = df[df.no_complaint].copy()
print(f"\n== Adults reporting NO worsening memory and NO money difficulty: share below a fixed cutoff ==")
for name, col, cut in [("fluency <14", "fluency", FLU_CUT), ("delayed recall <5", "delay", DEL_CUT)]:
    t = well.dropna(subset=[col, "edu"]).groupby("edu")[col].agg(share=lambda s: (s < cut).mean(), n="count")
    print(name)
    print(t.reindex(order).round(3))
    t2 = well.dropna(subset=[col, "eth"]).groupby("eth")[col].agg(share=lambda s: (s < cut).mean(), n="count")
    print(t2.round(3))


def design(d):
    age = d["RIDAGEYR"].to_numpy(float)
    cols = [np.ones(len(d)), age - 70, (age - 70) ** 2, (d["RIAGENDR"] == 2).to_numpy(float)]
    for e in order[1:]:
        cols.append((d["edu"] == e).to_numpy(float))
    return np.column_stack(cols)


def auc(score, y):
    """Probability a random case scores lower than a random non-case."""
    s, y = np.asarray(score, float), np.asarray(y, int)
    ranks = pd.Series(s).rank().to_numpy()
    n1, n0 = y.sum(), (1 - y).sum()
    return 1 - (ranks[y == 1].sum() - n1 * (n1 + 1) / 2) / (n1 * n0)


rng = np.random.default_rng(20261110)
print("\n== Norms adjusted for age, sex and schooling, fitted out-of-fold on the no-complaint group ==")
for col, cut in [("fluency", FLU_CUT), ("delay", DEL_CUT)]:
    d = df.dropna(subset=[col, "edu", "RIDAGEYR", "RIAGENDR"]).copy().reset_index(drop=True)
    fold = rng.integers(0, 5, len(d))
    z = np.full(len(d), np.nan)
    for k in range(5):
        train = d[(fold != k) & d.no_complaint]
        beta, *_ = np.linalg.lstsq(design(train), train[col].to_numpy(float), rcond=None)
        sd = np.std(train[col].to_numpy(float) - design(train) @ beta, ddof=design(train).shape[1])
        test = d[fold == k]
        z[fold == k] = (test[col].to_numpy(float) - design(test) @ beta) / sd
    d["z"] = z
    d["fixed_flag"] = d[col] < cut
    rate = d.fixed_flag.mean()
    d["adj_flag"] = d.z < np.quantile(d.z, rate)  # same overall flag rate as the fixed cutoff
    print(f"\n-- {col}: n={len(d)}, overall flag rate matched at {rate:.3f}")
    w = d[d.no_complaint]
    tab = w.groupby("edu")[["fixed_flag", "adj_flag"]].mean().reindex(order).round(3)
    tab["n"] = w.groupby("edu").size().reindex(order)
    print("False flags among adults with no complaint, by schooling:")
    print(tab)
    for out in ["memory_worse", "money_diff"]:
        dd = d.dropna(subset=[out])
        y = dd[out].astype(int)
        line = f"{out}: cases={int(y.sum())}/{len(dd)}  AUC raw={auc(dd[col], y):.3f}  AUC adjusted={auc(dd.z, y):.3f}"
        sens_f, sens_a = dd.fixed_flag[y == 1].mean(), dd.adj_flag[y == 1].mean()
        spec_f, spec_a = 1 - dd.fixed_flag[y == 0].mean(), 1 - dd.adj_flag[y == 0].mean()
        print(line + f" | fixed sens {sens_f:.3f} spec {spec_f:.3f} | adjusted sens {sens_a:.3f} spec {spec_a:.3f}")
        low = dd[dd.edu == "<9th grade"]
        yl = low[out].astype(int)
        if yl.sum() >= 20:
            print(f"   <9th grade only (n={len(low)}): fixed sens {low.fixed_flag[yl == 1].mean():.3f} spec {1 - low.fixed_flag[yl == 0].mean():.3f}"
                  f" | adjusted sens {low.adj_flag[yl == 1].mean():.3f} spec {1 - low.adj_flag[yl == 0].mean():.3f}")
