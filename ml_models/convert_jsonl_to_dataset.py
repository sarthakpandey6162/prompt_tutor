"""
Convert data.jsonl → prompts_dataset.csv

The JSONL file has raw prompts with no labels.
This script auto-labels them using rule-based heuristics:
  - score (1-10): based on prompt length, structure, and element presence
  - category: Analytical, Creative, Technical, Directive, Casual, Formal
  - has_role, has_format, has_constraints, has_examples, has_context: 0/1
  - tone: Formal, Neutral, Casual, Technical

Usage:
    python convert_jsonl_to_dataset.py
"""

import json
import os
import re
import csv
import random

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_PATH = os.path.join(SCRIPT_DIR, 'dataset', 'data.jsonl')
OUTPUT_PATH = os.path.join(SCRIPT_DIR, 'dataset', 'prompts_dataset.csv')

# How many prompts to use (set to None for ALL)
MAX_PROMPTS = 10000


# ── Element Detection ─────────────────────────────────────────────
def has_role(text):
    patterns = [
        r'\bact\s+as\b', r'\byou\s+are\b', r'\bpretend\s+to\s+be\b',
        r'\bimagine\s+you\s+are\b', r'\bas\s+a\s+\w+', r'\brole\s*:\s*',
        r'\bpersona\b', r'\bexpert\b', r'\bspecialist\b',
        r'\bprofessional\b', r'\bconsultant\b', r'\bmentor\b',
        r'\bcoach\b', r'\banalyst\b', r'\bdesigner\b',
        r'\bdeveloper\b', r'\bengineer\b', r'\bscientist\b',
        r'\bteacher\b', r'\bprofessor\b', r'\beditor\b',
        r'\bwriter\b', r'\bjournalist\b', r'\badviser\b',
        r'\btherapist\b', r'\bdoctor\b', r'\blawyer\b',
    ]
    return int(any(re.search(p, text, re.IGNORECASE) for p in patterns))


def has_format(text):
    patterns = [
        r'\bjson\b', r'\bcsv\b', r'\bxml\b', r'\byaml\b',
        r'\btable\b', r'\blist\b', r'\bbullet\s*point', r'\bnumbered\s+list\b',
        r'\bmarkdown\b', r'\bformat\s*:', r'\boutput\s+format\b',
        r'\breturn\s+as\b', r'\bprovide\s+in\b', r'\bstructure\b',
        r'\bparagraph', r'\bcode\s+block\b', r'\bheadings?\b',
        r'\bstep[\s-]*by[\s-]*step\b', r'\bsections?\b',
    ]
    return int(any(re.search(p, text, re.IGNORECASE) for p in patterns))


def has_constraints(text):
    patterns = [
        r'\bunder\s+\d+\s+words\b', r'\bmax(imum)?\s+\d+\b',
        r'\bmin(imum)?\s+\d+\b', r'\blimit\b', r'\bno\s+more\s+than\b',
        r'\bno\s+less\s+than\b', r'\bexactly\s+\d+\b', r'\bkeep\s+it\b',
        r'\bconstraint', r'\bdo\s+not\b', r'\bdon\'t\b', r'\bavoid\b',
        r'\bmust\s+not\b', r'\bmust\s+be\b', r'\bshould\s+not\b',
        r'\bshould\s+be\b', r'\brequire', r'\bnot\s+allowed\b',
        r'\bonly\s+use\b', r'\bonly\s+include\b', r'\bbrief\b',
        r'\bconcise\b', r'\bshort\b', r'\b\d+\s+words?\b',
        r'\b\d+\s+sentence', r'\b\d+\s+paragraph',
    ]
    return int(any(re.search(p, text, re.IGNORECASE) for p in patterns))


def has_examples(text):
    patterns = [
        r'\bfor\s+example\b', r'\bexample\s*:', r'\be\.g\.\b',
        r'\bsuch\s+as\b', r'\binput\s*:', r'\boutput\s*:',
        r'\bsample\b', r'\blike\s+this\b', r'\binstance\b',
        r'\bdemonstrat', r'\bhere\s+is\b', r'\bfor\s+instance\b',
        r'\btemplate\b', r'→', r'->', r'\bcase\s+study\b',
    ]
    return int(any(re.search(p, text, re.IGNORECASE) for p in patterns))


def has_context(text):
    patterns = [
        r'\baudience\b', r'\btarget\b', r'\bbackground\b',
        r'\bcontext\s*:', r'\bscenario\b', r'\bsituation\b',
        r'\bgiven\s+that\b', r'\bassuming\b', r'\bgoal\b',
        r'\bobjective\b', r'\bpurpose\b', r'\bintended\s+for\b',
        r'\bbeginners?\b', r'\bexperts?\b', r'\bstudents?\b',
        r'\bclients?\b', r'\bcustomers?\b', r'\busers?\b',
        r'\bteam\b', r'\bstakeholders?\b', r'\breaders?\b',
    ]
    return int(any(re.search(p, text, re.IGNORECASE) for p in patterns))


# ── Category Classification ───────────────────────────────────────
def classify_category(text):
    t = text.lower()

    technical_score = sum(1 for p in [
        r'\bcode\b', r'\bfunction\b', r'\bapi\b', r'\bdatabase\b',
        r'\balgorithm\b', r'\bpython\b', r'\bjavascript\b', r'\bsql\b',
        r'\bdeploy\b', r'\bsyntax\b', r'\bvariable\b', r'\bclass\b',
        r'\bprogram', r'\bdebug\b', r'\bframework\b', r'\blibrary\b',
        r'\bgit\b', r'\bdocker\b', r'\blinux\b', r'\bserver\b',
    ] if re.search(p, t))

    creative_score = sum(1 for p in [
        r'\bimagine\b', r'\bcreative\b', r'\bstory\b', r'\bnarrative\b',
        r'\bpoem\b', r'\bfiction\b', r'\bbrand\b', r'\bdesign\b',
        r'\binnovati', r'\bbrainstorm\b', r'\bunique\b', r'\bartistic\b',
        r'\binspir', r'\bwrite\s+a\s+story\b', r'\bcharacter\b',
    ] if re.search(p, t))

    analytical_score = sum(1 for p in [
        r'\banalyze\b', r'\bcompare\b', r'\bevaluate\b', r'\basses\b',
        r'\bresearch\b', r'\bstudy\b', r'\bdata\b', r'\bstatistic',
        r'\btrend\b', r'\binsight\b', r'\bmetric\b', r'\breport\b',
        r'\bfinding\b', r'\bexplain\b', r'\breview\b', r'\bsummar',
    ] if re.search(p, t))

    directive_score = sum(1 for p in [
        r'\bcreate\b', r'\bgenerate\b', r'\bwrite\b', r'\blist\b',
        r'\bprovide\b', r'\bmake\b', r'\bbuild\b', r'\bdevelop\b',
        r'\bhelp\s+me\b', r'\bgive\s+me\b', r'\btell\s+me\b',
        r'\bshow\s+me\b', r'\bfind\b', r'\bsuggest\b',
    ] if re.search(p, t))

    casual_indicators = sum(1 for p in [
        r'\bhey\b', r'\bhi\b', r'\byo\b', r'\bbro\b', r'\bcool\b',
        r'\bawesome\b', r'\blol\b', r'\bwhat\'s\b', r'\bwanna\b',
        r'\bgonna\b', r'\bstuff\b', r'\bkinda\b',
    ] if re.search(p, t))

    formal_indicators = sum(1 for p in [
        r'\bplease\b', r'\bkindly\b', r'\bwould\s+you\b', r'\bappreciate\b',
        r'\bthank\s+you\b', r'\bregards\b', r'\brespectfully\b',
        r'\bhereby\b', r'\bfurthermore\b', r'\bin\s+accordance\b',
    ] if re.search(p, t))

    scores = {
        'Technical': technical_score,
        'Creative': creative_score,
        'Analytical': analytical_score,
        'Directive': directive_score,
        'Casual': casual_indicators,
        'Formal': formal_indicators,
    }

    best = max(scores, key=scores.get)
    if scores[best] == 0:
        # Default assignment based on simple heuristics
        if len(t) < 20:
            return 'Casual'
        if '?' in t:
            return 'Analytical'
        return 'Directive'
    return best


# ── Tone Detection ─────────────────────────────────────────────────
def detect_tone(text):
    t = text.lower()
    if re.search(r'\bplease\b|\bkindly\b|\bwould\s+you\b|\bappreciate\b|\bthank\s+you\b', t):
        return 'Formal'
    if re.search(r'\balgorithm\b|\bfunction\b|\bapi\b|\bdatabase\b|\bdeploy\b|\bsyntax\b|\bvariable\b|\bcode\b', t):
        return 'Technical'
    if re.search(r'\bhey\b|\bhi\b|\byo\b|\bbro\b|\bcool\b|\bawesome\b|\blol\b', t):
        return 'Casual'
    return 'Neutral'


# ── Score Estimation ───────────────────────────────────────────────
def estimate_score(text, r, f, c, e, ctx):
    """Estimate prompt quality score (1-10) from heuristics."""
    score = 1  # base

    # Length contribution (0-2 points)
    length = len(text.split())
    if length >= 50:
        score += 2
    elif length >= 25:
        score += 1.5
    elif length >= 10:
        score += 1
    elif length >= 5:
        score += 0.5

    # Element presence (0-5 points, 1 per element)
    score += r + f + c + e + ctx

    # Structure bonus (0-2 points)
    if re.search(r'\d+\)', text) or re.search(r'\d+\.', text):
        score += 0.5  # numbered items
    if '\n' in text:
        score += 0.5  # multi-line = more structured
    if re.search(r'step[\s-]*by[\s-]*step', text, re.IGNORECASE):
        score += 0.5
    if len(text.split('.')) >= 3:
        score += 0.5  # multiple sentences

    # Clamp to 1-10
    score = max(1, min(10, round(score)))

    # Add small randomness for variety (±1)
    score = max(1, min(10, score + random.choice([-1, 0, 0, 0, 1])))

    return score


# ── Main Conversion ────────────────────────────────────────────────
def main():
    print("=" * 55)
    print("  JSONL -> CSV Dataset Converter")
    print("=" * 55)

    if not os.path.exists(INPUT_PATH):
        print(f"ERROR: {INPUT_PATH} not found!")
        return

    # Read JSONL
    print(f"\n[1/3] Reading {INPUT_PATH}...")
    prompts = []
    with open(INPUT_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                text = obj.get('response', '').strip()
                if text and len(text) >= 3 and len(text) <= 2000:
                    prompts.append(text)
            except json.JSONDecodeError:
                continue

    print(f"       Found {len(prompts)} valid prompts")

    # Limit
    if MAX_PROMPTS and len(prompts) > MAX_PROMPTS:
        random.seed(42)
        prompts = random.sample(prompts, MAX_PROMPTS)
        print(f"       Sampled {MAX_PROMPTS} prompts")

    # Label each prompt
    print("[2/3] Auto-labeling prompts...")
    rows = []
    for i, text in enumerate(prompts):
        r = has_role(text)
        f = has_format(text)
        c = has_constraints(text)
        e = has_examples(text)
        ctx = has_context(text)
        category = classify_category(text)
        tone = detect_tone(text)
        score = estimate_score(text, r, f, c, e, ctx)

        rows.append({
            'prompt_text': text,
            'score': score,
            'category': category,
            'has_role': r,
            'has_format': f,
            'has_constraints': c,
            'has_examples': e,
            'has_context': ctx,
            'tone': tone,
        })

        if (i + 1) % 2000 == 0:
            print(f"       Processed {i + 1}/{len(prompts)}...")

    # Write CSV
    print(f"[3/3] Writing {OUTPUT_PATH}...")
    fieldnames = ['prompt_text', 'score', 'category', 'has_role', 'has_format',
                  'has_constraints', 'has_examples', 'has_context', 'tone']

    with open(OUTPUT_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    # Stats
    from collections import Counter
    scores = [r['score'] for r in rows]
    cats = Counter(r['category'] for r in rows)
    tones = Counter(r['tone'] for r in rows)

    print(f"\n{'=' * 55}")
    print(f"  DONE! Dataset created: {len(rows)} rows")
    print(f"  Score range: {min(scores)} - {max(scores)}")
    print(f"  Avg score: {sum(scores)/len(scores):.1f}")
    print(f"\n  Categories:")
    for cat, count in cats.most_common():
        print(f"    {cat:12s}: {count:5d} ({count/len(rows)*100:.1f}%)")
    print(f"\n  Tones:")
    for tone, count in tones.most_common():
        print(f"    {tone:12s}: {count:5d} ({count/len(rows)*100:.1f}%)")
    print(f"{'=' * 55}")


if __name__ == '__main__':
    main()
