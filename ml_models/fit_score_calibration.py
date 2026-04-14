"""
Fit a simple linear calibration from local_score to api_score.

Usage example:
  python fit_score_calibration.py --input dataset/alignment_results.csv --output saved_models/score_calibration.json
"""

import argparse
import csv
import json
import os
import numpy as np


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="dataset/alignment_results.csv")
    parser.add_argument("--output", default="saved_models/score_calibration.json")
    return parser.parse_args()


def safe_float(v):
    try:
        return float(v)
    except Exception:
        return None


def clamp_score(x):
    return max(1.0, min(10.0, x))


def mae(a, b):
    return float(np.mean(np.abs(np.array(a) - np.array(b))))


def main():
    args = parse_args()

    with open(args.input, "r", newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    xs = []
    ys = []
    for row in rows:
        x = safe_float(row.get("local_score"))
        y = safe_float(row.get("api_score"))
        if x is None or y is None:
            continue
        xs.append(x)
        ys.append(y)

    if len(xs) < 20:
        raise SystemExit("Need at least 20 valid rows in alignment file.")

    slope, intercept = np.polyfit(np.array(xs), np.array(ys), 1)

    raw_mae = mae(xs, ys)
    cal_preds = [clamp_score(slope * x + intercept) for x in xs]
    cal_mae = mae(cal_preds, ys)

    result = {
        "slope": float(slope),
        "intercept": float(intercept),
        "count": len(xs),
        "raw_mae": round(raw_mae, 4),
        "calibrated_mae": round(cal_mae, 4),
    }

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print("Calibration fitted")
    print(f"Count: {result['count']}")
    print(f"Raw MAE: {result['raw_mae']}")
    print(f"Calibrated MAE: {result['calibrated_mae']}")
    print(f"Saved: {args.output}")


if __name__ == "__main__":
    main()
