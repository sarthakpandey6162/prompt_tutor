"""
Evaluate alignment between local ML model and Groq API.

Usage example:
  python evaluate_alignment.py --input dataset/prompts_api_labeled.csv --output dataset/alignment_results.csv --limit 200

Notes:
  - Requires local ML server running at http://localhost:5000/predict
  - Requires GROQ_API_KEY if api_score/api_category are not already in input
"""

import argparse
import csv
import json
import os
import statistics
import time
from urllib import request


GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.1-8b-instant"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="dataset/prompts_api_labeled.csv")
    parser.add_argument("--output", default="dataset/alignment_results.csv")
    parser.add_argument("--api-key", default=os.getenv("GROQ_API_KEY", "").strip())
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--ml-url", default="http://localhost:5000/predict")
    parser.add_argument("--limit", type=int, default=200)
    parser.add_argument("--delay", type=float, default=0.5)
    return parser.parse_args()


def clean_json_text(text):
    t = (text or "").strip()
    if t.startswith("```"):
        t = t.replace("```json", "", 1).replace("```", "").strip()
    return t


def post_json(url, payload, headers, timeout=45):
    req = request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def call_ml(prompt_text, ml_url):
    body = post_json(
        ml_url,
        {"prompt": prompt_text},
        {"Content-Type": "application/json"},
    )
    return float(body.get("score", 0.0)), str(body.get("category", ""))


def call_groq(prompt_text, api_key, model):
    system_prompt = (
        "Analyze the user's prompt and respond ONLY with valid JSON.\n"
        "{\n"
        '  "score": <1-10>,\n'
        '  "category": "<Analytical|Creative|Technical|Directive|Casual|Formal>"\n'
        "}"
    )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": str(prompt_text).strip()},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    body = post_json(
        GROQ_API_URL,
        payload,
        {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    content = body["choices"][0]["message"]["content"]
    parsed = json.loads(clean_json_text(content))
    score = max(1.0, min(10.0, float(parsed.get("score"))))
    category = str(parsed.get("category", "")).strip()
    return round(score, 1), category


def parse_float(value):
    try:
        return float(value)
    except Exception:
        return None


def main():
    args = parse_args()

    with open(args.input, "r", newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if args.limit > 0:
        rows = rows[: args.limit]

    if not rows:
        raise SystemExit("Input has no rows.")

    results = []
    diffs = []
    cat_hits = 0
    cat_total = 0

    for i, row in enumerate(rows, start=1):
        prompt_text = str(row.get("prompt_text", "")).strip()
        if not prompt_text:
            continue

        local_score = None
        local_category = ""
        api_score = parse_float(row.get("api_score"))
        api_category = str(row.get("api_category", "")).strip()
        error_msg = ""

        try:
            local_score, local_category = call_ml(prompt_text, args.ml_url)
        except Exception as e:
            error_msg = f"ml_error:{str(e)[:80]}"

        if api_score is None or not api_category:
            if not args.api_key:
                error_msg = (error_msg + " | " if error_msg else "") + "missing_api_key"
            else:
                try:
                    api_score, api_category = call_groq(prompt_text, args.api_key, args.model)
                except Exception as e:
                    error_msg = (error_msg + " | " if error_msg else "") + f"api_error:{str(e)[:80]}"

        diff = None
        if local_score is not None and api_score is not None:
            diff = abs(local_score - api_score)
            diffs.append(diff)

        if local_category and api_category:
            cat_total += 1
            if local_category == api_category:
                cat_hits += 1

        results.append({
            "prompt_text": prompt_text,
            "local_score": "" if local_score is None else round(local_score, 2),
            "api_score": "" if api_score is None else round(api_score, 2),
            "abs_diff": "" if diff is None else round(diff, 2),
            "local_category": local_category,
            "api_category": api_category,
            "error": error_msg,
        })

        if i % 20 == 0 or i == len(rows):
            print(f"Processed {i}/{len(rows)}")

        time.sleep(max(0.0, args.delay))

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    fields = [
        "prompt_text",
        "local_score",
        "api_score",
        "abs_diff",
        "local_category",
        "api_category",
        "error",
    ]
    with open(args.output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(results)

    mae = statistics.mean(diffs) if diffs else None
    cat_acc = (cat_hits / cat_total) if cat_total else None

    print("\nAlignment Summary")
    print(f"Rows evaluated: {len(results)}")
    print(f"Rows with score diff: {len(diffs)}")
    print(f"MAE: {round(mae, 3) if mae is not None else 'N/A'}")
    print(f"Category accuracy: {round(cat_acc * 100, 2) if cat_acc is not None else 'N/A'}%")
    print(f"Saved: {args.output}")


if __name__ == "__main__":
    main()
