"""
Rebalance dataset into three score bins: low (1-3), mid (4-6), high (7-10).

Usage example:
  python rebalance_dataset.py --input dataset/prompts_api_labeled.csv --output dataset/prompts_train_rebalanced.csv --score-column api_score
"""

import argparse
import csv
import os
import random


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="dataset/prompts_api_labeled.csv")
    parser.add_argument("--output", default="dataset/prompts_train_rebalanced.csv")
    parser.add_argument("--score-column", default="api_score")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--target-per-bin", type=int, default=0, help="0 means use max existing bin size")
    return parser.parse_args()


def to_score(value):
    try:
        s = float(value)
        return max(1.0, min(10.0, s))
    except Exception:
        return None


def score_bin(score):
    if score <= 3:
        return "low"
    if score <= 6:
        return "mid"
    return "high"


def sample_to_size(items, target):
    if not items:
        return []
    if len(items) == target:
        return list(items)
    if len(items) > target:
        return random.sample(items, target)
    out = list(items)
    while len(out) < target:
        out.append(random.choice(items))
    return out


def main():
    args = parse_args()
    random.seed(args.seed)

    with open(args.input, "r", newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        raise SystemExit("Input is empty.")

    bins = {"low": [], "mid": [], "high": []}
    skipped = 0

    for row in rows:
        raw = row.get(args.score_column)
        if (raw is None or str(raw).strip() == "") and args.score_column != "score":
            raw = row.get("score")

        score = to_score(raw)
        if score is None:
            skipped += 1
            continue

        row["_train_score"] = str(round(score, 1))
        bins[score_bin(score)].append(row)

    counts = {k: len(v) for k, v in bins.items()}
    if min(counts.values()) == 0:
        raise SystemExit(f"Cannot rebalance because one bin is empty: {counts}")

    target = args.target_per_bin if args.target_per_bin > 0 else max(counts.values())

    rebalanced = []
    for name in ["low", "mid", "high"]:
        rebalanced.extend(sample_to_size(bins[name], target))

    random.shuffle(rebalanced)

    fields = list(rebalanced[0].keys())
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rebalanced)

    print("Done")
    print(f"Input counts: {counts}")
    print(f"Target per bin: {target}")
    print(f"Skipped rows: {skipped}")
    print(f"Output rows: {len(rebalanced)}")
    print(f"Saved to: {args.output}")


if __name__ == "__main__":
    main()
