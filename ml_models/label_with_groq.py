"""
Label prompts with Groq score/category using the same simple schema as the app.

Usage example:
  python label_with_groq.py --input dataset/prompts_dataset.csv --output dataset/prompts_api_labeled.csv --limit 600

Requires:
  - GROQ_API_KEY in environment (or --api-key)
"""

import argparse
import csv
import json
import os
import time
from urllib import request, error


GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.1-8b-instant"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="dataset/prompts_dataset.csv")
    parser.add_argument("--output", default="dataset/prompts_api_labeled.csv")
    parser.add_argument("--api-key", default=os.getenv("GROQ_API_KEY", "").strip())
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--limit", type=int, default=0, help="0 means all rows")
    parser.add_argument("--delay", type=float, default=0.7, help="seconds between requests")
    return parser.parse_args()


def clean_json_text(text):
    t = (text or "").strip()
    if t.startswith("```"):
        t = t.replace("```json", "", 1).replace("```", "").strip()
    return t


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

    req = request.Request(
        GROQ_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    with request.urlopen(req, timeout=45) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    content = body["choices"][0]["message"]["content"]
    parsed = json.loads(clean_json_text(content))

    score = float(parsed.get("score"))
    category = str(parsed.get("category", "")).strip()
    score = max(1.0, min(10.0, score))
    return round(score, 1), category


def main():
    args = parse_args()

    if not args.api_key:
        raise SystemExit("Missing API key. Set GROQ_API_KEY or pass --api-key.")

    with open(args.input, "r", newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if args.limit and args.limit > 0:
        rows = rows[: args.limit]

    if not rows:
        raise SystemExit("No rows found in input file.")

    fields = list(rows[0].keys())
    if "api_score" not in fields:
        fields.append("api_score")
    if "api_category" not in fields:
        fields.append("api_category")
    if "api_label_error" not in fields:
        fields.append("api_label_error")

    success = 0
    failures = 0

    for i, row in enumerate(rows, start=1):
        prompt_text = str(row.get("prompt_text", "")).strip()
        if not prompt_text:
            row["api_score"] = ""
            row["api_category"] = ""
            row["api_label_error"] = "empty_prompt"
            failures += 1
            continue

        try:
            api_score, api_category = call_groq(prompt_text, args.api_key, args.model)
            row["api_score"] = api_score
            row["api_category"] = api_category
            row["api_label_error"] = ""
            success += 1
        except error.HTTPError as e:
            msg = f"http_{e.code}"
            row["api_score"] = ""
            row["api_category"] = ""
            row["api_label_error"] = msg
            failures += 1
        except Exception as e:
            row["api_score"] = ""
            row["api_category"] = ""
            row["api_label_error"] = str(e)[:120]
            failures += 1

        if i % 20 == 0 or i == len(rows):
            print(f"Processed {i}/{len(rows)} | success={success} | failed={failures}")

        time.sleep(max(0.0, args.delay))

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    print("\nDone")
    print(f"Output: {args.output}")
    print(f"Rows: {len(rows)} | success: {success} | failed: {failures}")


if __name__ == "__main__":
    main()
