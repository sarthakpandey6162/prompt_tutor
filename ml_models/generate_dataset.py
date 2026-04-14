"""
Generate a labeled prompt dataset for training LSTM/CNN models.
Combines existing prompts from prompts.json with synthetic data.
Output: dataset/prompts_dataset.csv

SCORING: Uses an INDEPENDENT rubric-based system (not Groq scores).
This avoids circular training where the model just mimics the API.
The rubric scores prompts based on objective, measurable features:
  - Length & detail
  - Presence of key elements (role, format, constraints, examples, context)
  - Specificity (numbers, concrete terms)
  - Structural complexity (sentences, sections)
  - Action clarity (strong action verbs)
"""

import json
import csv
import os
import random
import re
import math

# ── Paths ──────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPTS_JSON = os.path.join(SCRIPT_DIR, '..', 'backend', 'prompts.json')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'dataset')
OUTPUT_CSV = os.path.join(OUTPUT_DIR, 'prompts_dataset.csv')

# ── Element Detection (mirrors backend logic) ─────────────────────
def detect_elements(text):
    t = str(text or '')
    return {
        'has_role': int(bool(re.search(
            r'act as|you are a?|persona|pretend|role|as a|expert|assistant|developer|scientist|writer|teacher|coach|mentor|analyst|engineer',
            t, re.IGNORECASE))),
        'has_format': int(bool(re.search(
            r'\b(json|markdown|table|csv|format|output|structure|code block|email|report|essay|html|xml|numbered list|bullet|step-by-step)\b',
            t, re.IGNORECASE))),
        'has_constraints': int(bool(re.search(
            r'\b(limit|max|must|exactly|no more|at least|words|under|avoid|don\'t|do not|never|only|restrict|constraint|edge case)\b',
            t, re.IGNORECASE))),
        'has_examples': int(bool(re.search(
            r'example|sample|for instance|input:|output:|e\.g\.|demonstrate|like this|such as',
            t, re.IGNORECASE))),
        'has_context': int(bool(re.search(
            r'context|background|situation|scenario|given that|assuming|based on|the goal|objective|purpose|audience|for (?:a|an)|target audience|beginner|non-technical',
            t, re.IGNORECASE))),
    }


def classify_tone(text):
    t = str(text).lower()
    if any(w in t for w in ['act as', 'you are', 'expert', 'professional', 'formal']):
        return 'Formal'
    if any(w in t for w in ['hey', 'hi', 'help me', 'can you', 'please', 'i want']):
        return 'Casual'
    if any(w in t for w in ['function', 'api', 'code', 'algorithm', 'debug', 'class', 'python', 'javascript']):
        return 'Technical'
    return 'Neutral'


# ══════════════════════════════════════════════════════════════════
#  INDEPENDENT RUBRIC-BASED SCORING SYSTEM
#  This replaces Groq-derived scores with objective measurements.
#  Each component measures a real, measurable aspect of prompt quality.
# ══════════════════════════════════════════════════════════════════

def compute_rubric_score(text):
    """
    Score a prompt from 1-10 using a purely rule-based rubric.
    No LLM involved — scoring is based on measurable text features.
    
    Rubric breakdown (max ~10 points):
      1. Length & Detail          (0 - 1.5 pts)
      2. Role Definition          (0 - 2.0 pts)
      3. Output Format Specified  (0 - 1.5 pts)
      4. Constraints Present      (0 - 1.5 pts)
      5. Examples / Context       (0 - 1.5 pts)
      6. Specificity              (0 - 1.0 pts)
      7. Structural Complexity    (0 - 1.0 pts)
    """
    t = str(text or '').strip()
    if not t:
        return 1
    
    score = 0.0
    words = t.split()
    word_count = len(words)
    sentences = [s.strip() for s in re.split(r'[.!?]+', t) if s.strip()]
    
    # ── 1. Length & Detail (0-1.5) ────────────────────────────────
    # Very short prompts (1-3 words) are almost always weak.
    # Good prompts tend to be 15-80 words. Excessive length is diminishing returns.
    if word_count <= 3:
        score += 0.0
    elif word_count <= 7:
        score += 0.3
    elif word_count <= 15:
        score += 0.7
    elif word_count <= 40:
        score += 1.1
    elif word_count <= 80:
        score += 1.5
    elif word_count <= 150:
        score += 1.3  # slight penalty for verbose
    else:
        score += 1.0  # significant length may indicate rambling
    
    # ── 2. Role Definition (0-2.0) ───────────────────────────────
    # A defined role is one of the strongest prompt engineering signals.
    has_strong_role = bool(re.search(
        r'\b(act as|you are|pretend you are|role:)\b', t, re.IGNORECASE))
    has_weak_role = bool(re.search(
        r'\b(as a|expert|specialist|professional|senior)\b', t, re.IGNORECASE))
    has_specific_role = bool(re.search(
        r'\b(data scientist|software engineer|ux designer|marketing expert|'
        r'financial advisor|career coach|teacher|researcher|product manager|'
        r'technical writer|business analyst|cybersecurity expert|devops engineer|'
        r'project manager|content strategist|startup mentor)\b', t, re.IGNORECASE))
    
    if has_strong_role and has_specific_role:
        score += 2.0
    elif has_strong_role:
        score += 1.5
    elif has_weak_role and has_specific_role:
        score += 1.2
    elif has_weak_role:
        score += 0.6
    
    # ── 3. Output Format Specified (0-1.5) ───────────────────────
    # Telling the AI what format to use dramatically improves output.
    format_patterns = [
        (r'\b(json|xml|html|csv|yaml)\b', 1.5),             # Structured data format
        (r'\b(table|markdown table|comparison table)\b', 1.5),
        (r'\b(numbered list|bullet points|step-by-step)\b', 1.2),
        (r'\b(code block|code)\b', 1.3),
        (r'\b(email|report|essay|blog post)\b', 1.0),
        (r'\b(format|output format|structure)\b', 0.8),
        (r'\b(outline|summary|guide)\b', 0.6),
    ]
    format_score = 0.0
    for pattern, pts in format_patterns:
        if re.search(pattern, t, re.IGNORECASE):
            format_score = max(format_score, pts)
    score += format_score
    
    # ── 4. Constraints Present (0-1.5) ───────────────────────────
    # Constraints show the user knows what they want.
    constraint_count = 0
    constraint_checks = [
        r'\b\d+\s*words?\b',                    # Word limit
        r'\bunder\s+\d+\b',                     # "under 200"
        r'\b(exactly|at least|no more than)\b',  # Precise requirements
        r'\b(avoid|don\'t|do not|never)\b',      # Negative constraints
        r'\b(must|should|require|ensure)\b',     # Positive constraints
        r'\b(limit|max|restrict|only)\b',        # Boundaries
        r'\b(concise|brief|short|keep it)\b',    # Brevity signals
        r'\b(tone|professional|casual|formal)\b', # Tone constraints
    ]
    for pattern in constraint_checks:
        if re.search(pattern, t, re.IGNORECASE):
            constraint_count += 1
    
    if constraint_count >= 4:
        score += 1.5
    elif constraint_count >= 3:
        score += 1.2
    elif constraint_count >= 2:
        score += 0.8
    elif constraint_count >= 1:
        score += 0.4
    
    # ── 5. Examples / Context (0-1.5) ────────────────────────────
    # Providing context and examples grounds the AI's response.
    context_score = 0.0
    
    has_examples = bool(re.search(
        r'example|sample|for instance|e\.g\.|demonstrate|such as|like this|input:|output:',
        t, re.IGNORECASE))
    has_audience = bool(re.search(
        r'audience|beginner|non-technical|developer|student|executive|general public|target',
        t, re.IGNORECASE))
    has_context = bool(re.search(
        r'context|background|scenario|goal|objective|purpose|situation|given that|assuming',
        t, re.IGNORECASE))
    
    if has_examples:
        context_score += 0.6
    if has_audience:
        context_score += 0.5
    if has_context:
        context_score += 0.4
    
    score += min(1.5, context_score)
    
    # ── 6. Specificity (0-1.0) ───────────────────────────────────
    # Specific prompts with numbers, named concepts, and concrete terms.
    specificity = 0.0
    
    # Has specific numbers (not just "some" or "a few")
    if re.search(r'\b\d+\b', t):
        specificity += 0.3
    
    # Has multiple distinct topic/concept words (not just "AI" or "code")
    topic_words = re.findall(
        r'\b(machine learning|deep learning|neural network|quantum|blockchain|'
        r'cybersecurity|renewable energy|data science|natural language|'
        r'artificial intelligence|cloud computing|web development|mobile app|'
        r'database|API|algorithm|framework|architecture)\b', t, re.IGNORECASE)
    if len(set(w.lower() for w in topic_words)) >= 2:
        specificity += 0.4
    elif len(topic_words) >= 1:
        specificity += 0.2
    
    # Has action-oriented structure (numbered steps, requirements)
    if re.search(r'\d\)', t) or re.search(r'\d\.\s', t):
        specificity += 0.3
    
    score += min(1.0, specificity)
    
    # ── 7. Structural Complexity (0-1.0) ─────────────────────────
    # Multi-sentence, well-organized prompts with clear structure.
    structure = 0.0
    
    if len(sentences) >= 4:
        structure += 0.5
    elif len(sentences) >= 2:
        structure += 0.3
    
    # Has punctuation variety (colons, semicolons indicate structure)
    if ':' in t:
        structure += 0.2
    if any(c in t for c in [';', '—', '–']):
        structure += 0.1
    
    # Has logical connectors
    if re.search(r'\b(however|therefore|additionally|furthermore|also|then)\b', t, re.IGNORECASE):
        structure += 0.2
    
    score += min(1.0, structure)
    
    # ── Final: clamp to 1-10 ─────────────────────────────────────
    # Add a base score of 1 (minimum) and clamp
    final = max(1, min(10, round(score + 1)))
    return final


# ── Load existing prompts.json ────────────────────────────────────
def load_existing_prompts():
    """Load prompts from prompts.json and re-score them with the rubric."""
    if not os.path.exists(PROMPTS_JSON):
        print(f"[WARN] {PROMPTS_JSON} not found, skipping existing data.")
        return []

    with open(PROMPTS_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)

    rows = []
    for entry in data:
        text = entry.get('prompt_text', '').strip()
        if not text or len(text) < 3:
            continue

        # INDEPENDENT SCORING: Use rubric instead of Groq's score
        rubric_score = compute_rubric_score(text)
        
        elements = detect_elements(text)

        rows.append({
            'prompt_text': text,
            'score': rubric_score,                # <-- RUBRIC score, NOT Groq
            'category': infer_category(text),     # <-- rule-based, NOT Groq
            **elements,
            'tone': classify_tone(text),
        })

    print(f"[INFO] Loaded {len(rows)} prompts from prompts.json (rubric-scored)")
    return rows


# ── Synthetic Data ────────────────────────────────────────────────
CATEGORIES = ['Analytical', 'Creative', 'Technical', 'Directive', 'Casual', 'Formal']

# Templates for different quality levels
WEAK_TEMPLATES = [
    "Tell me about {topic}",
    "{topic}",
    "Explain {topic}",
    "Write something about {topic}",
    "Help me with {topic}",
    "I need {topic}",
    "Give me {topic}",
    "What is {topic}",
    "hi",
    "hello",
    "do my homework",
    "write code",
    "make a website",
    "fix this",
    "help",
    "idk what to write",
    "something about {topic}",
    "just {topic}",
    "{topic} please",
    "can you do {topic}",
]

MEDIUM_TEMPLATES = [
    "Explain {topic} in simple terms for beginners",
    "Write a short paragraph about {topic}",
    "Summarize the key points of {topic}",
    "List 5 facts about {topic}",
    "Compare {topic} with {topic2}",
    "Give me a brief overview of {topic}",
    "What are the pros and cons of {topic}?",
    "Help me understand {topic} better. I'm a student.",
    "Write a {format} about {topic}",
    "Describe {topic} for someone who knows nothing about it",
    "Can you explain the main concepts of {topic}? Keep it under 200 words.",
    "Create a list of {topic} ideas for my project",
    "Write about {topic}. Target audience: {audience}.",
    "Generate a summary of {topic} using bullet points",
    "Analyze {topic} and provide 3 key takeaways",
    "I'm working on a project about {topic}. Give me some guidance.",
    "What should I know about {topic} before starting?",
    "Break down {topic} into easy steps",
    "Draft an email about {topic}",
    "Write a blog post introduction about {topic}",
]

STRONG_TEMPLATES = [
    "Act as a {role}. Explain {topic} to {audience}. Use {format}. Keep it under {limit} words.",
    "You are a {role}. Goal: {goal} about {topic}. Output format: {format}. Constraints: {constraint}. Context: for {audience}.",
    "Act as a {role}. Create a comprehensive guide on {topic} for {audience}. Format the output as {format}. Include at least one example. Limit to {limit} words.",
    "Pretend you are a {role}. I need you to analyze {topic}. Provide your response in {format}. Make sure to address edge cases and include specific examples. Target audience: {audience}.",
    "As a {role}, design a {goal} for {topic}. Requirements: 1) Use {format}, 2) Include {constraint}, 3) Target {audience}. Provide step-by-step reasoning.",
    "You are a senior {role}. Task: Evaluate {topic} and recommend improvements. Output: {format}. Constraints: Be concise, use professional language, address both strengths and weaknesses. Context: {audience} needs actionable feedback.",
    "Act as a {role} with expertise in {topic}. Create a detailed {format} that covers: 1) Introduction 2) Key concepts 3) Practical examples 4) Common mistakes to avoid. Target audience: {audience}. Word limit: {limit}.",
    "Role: {role}. Objective: {goal} on {topic}. Format: structured {format} with headers. Constraints: exactly {num} points, under {limit} words. Include one real-world example. Audience: {audience}.",
    "As a {role}, write a professional {format} about {topic}. Context: This is for {audience} who need clear, actionable guidance. Constraints: Avoid jargon, include examples, keep under {limit} words. Don't use passive voice.",
    "Act as an expert {role}. Analyze the following: {topic}. Provide output in {format} format. Include: strengths, weaknesses, and 3 specific recommendations. Target: {audience}. Tone: professional but accessible.",
]

TOPICS = [
    "artificial intelligence", "machine learning", "deep learning", "natural language processing",
    "climate change", "renewable energy", "sustainable development", "electric vehicles",
    "blockchain", "cryptocurrency", "web development", "mobile app development",
    "data science", "cybersecurity", "cloud computing", "quantum computing",
    "Python programming", "JavaScript frameworks", "database optimization", "API design",
    "startup strategy", "product management", "user experience design", "digital marketing",
    "remote work productivity", "team leadership", "project management", "agile methodology",
    "mental health awareness", "fitness planning", "nutrition science", "meditation techniques",
    "space exploration", "biotechnology", "genetic engineering", "robotics",
    "e-commerce trends", "social media marketing", "content creation", "brand strategy",
    "financial planning", "investment strategies", "personal budgeting", "stock market analysis",
    "education technology", "online learning", "study techniques", "career development",
    "creative writing", "public speaking", "critical thinking", "problem solving",
]

TOPICS2 = [
    "traditional methods", "modern approaches", "open source alternatives",
    "industry standards", "competitor solutions", "legacy systems",
]

ROLES = [
    "software engineer", "data scientist", "product manager", "UX designer",
    "marketing expert", "financial advisor", "career coach", "startup mentor",
    "teacher", "researcher", "technical writer", "business analyst",
    "cybersecurity expert", "DevOps engineer", "project manager", "content strategist",
]

FORMATS = [
    "bullet points", "numbered list", "JSON", "markdown table",
    "step-by-step guide", "report", "email", "code block",
    "structured outline", "comparison table",
]

AUDIENCES = [
    "beginners", "non-technical audience", "college students",
    "business executives", "developers", "high school students",
    "startup founders", "general public", "technical team",
    "class presentation", "job interview", "academic paper",
]

GOALS = [
    "create a study plan", "write a summary", "generate interview questions",
    "build a tutorial", "analyze feedback", "design a workflow",
    "draft an email", "explain a concept", "create a comparison",
    "develop a strategy", "outline a proposal", "review performance",
]

CONSTRAINTS = [
    "under 120 words", "exactly 5 points", "simple language only",
    "include one example", "avoid technical jargon", "use professional tone",
    "include pros and cons", "keep it concise", "provide actionable steps",
]


def infer_category(text):
    t = text.lower()
    if any(w in t for w in ['code', 'function', 'api', 'debug', 'python', 'javascript', 'algorithm', 'database']):
        return 'Technical'
    if any(w in t for w in ['brainstorm', 'creative', 'story', 'poem', 'imagine', 'design', 'invent']):
        return 'Creative'
    if any(w in t for w in ['analyze', 'compare', 'evaluate', 'explain', 'research', 'study', 'investigate']):
        return 'Analytical'
    if any(w in t for w in ['create', 'generate', 'write', 'make', 'build', 'develop', 'draft', 'act as']):
        return 'Directive'
    if any(w in t for w in ['hi', 'hello', 'hey', 'help me', 'can you', 'what is', 'please', 'i want']):
        return 'Casual'
    return random.choice(CATEGORIES)


def generate_synthetic_prompts(count=500):
    rows = []
    
    # ~30% weak (templates that will score low on rubric)
    for _ in range(int(count * 0.3)):
        tpl = random.choice(WEAK_TEMPLATES)
        topic = random.choice(TOPICS)
        text = tpl.format(topic=topic, topic2=random.choice(TOPICS2))
        elements = detect_elements(text)
        # RUBRIC SCORE — computed from text features, not random
        rubric_score = compute_rubric_score(text)
        rows.append({
            'prompt_text': text,
            'score': rubric_score,
            'category': infer_category(text),
            **elements,
            'tone': classify_tone(text),
        })

    # ~35% medium
    for _ in range(int(count * 0.35)):
        tpl = random.choice(MEDIUM_TEMPLATES)
        topic = random.choice(TOPICS)
        text = tpl.format(
            topic=topic, topic2=random.choice(TOPICS2),
            format=random.choice(FORMATS), audience=random.choice(AUDIENCES)
        )
        elements = detect_elements(text)
        rubric_score = compute_rubric_score(text)
        rows.append({
            'prompt_text': text,
            'score': rubric_score,
            'category': infer_category(text),
            **elements,
            'tone': classify_tone(text),
        })

    # ~35% strong
    for _ in range(int(count * 0.35)):
        tpl = random.choice(STRONG_TEMPLATES)
        topic = random.choice(TOPICS)
        text = tpl.format(
            topic=topic, topic2=random.choice(TOPICS2),
            role=random.choice(ROLES), format=random.choice(FORMATS),
            audience=random.choice(AUDIENCES), goal=random.choice(GOALS),
            constraint=random.choice(CONSTRAINTS), limit=random.choice([100, 120, 150, 200, 250, 300]),
            num=random.choice([3, 5, 7, 10]),
        )
        elements = detect_elements(text)
        rubric_score = compute_rubric_score(text)
        rows.append({
            'prompt_text': text,
            'score': rubric_score,
            'category': infer_category(text),
            **elements,
            'tone': classify_tone(text),
        })

    print(f"[INFO] Generated {len(rows)} synthetic prompts (rubric-scored)")
    return rows


# ── Main ──────────────────────────────────────────────────────────
def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    existing = load_existing_prompts()
    synthetic = generate_synthetic_prompts(5000)
    
    all_data = existing + synthetic
    random.shuffle(all_data)

    # Remove duplicates by prompt_text
    seen = set()
    unique = []
    for row in all_data:
        key = row['prompt_text'].strip().lower()
        if key not in seen:
            seen.add(key)
            unique.append(row)

    fieldnames = ['prompt_text', 'score', 'category', 'has_role', 'has_format',
                  'has_constraints', 'has_examples', 'has_context', 'tone']

    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(unique)

    print(f"\n--- Dataset saved to: {OUTPUT_CSV} ---")
    print(f"   Total prompts: {len(unique)}")
    print(f"   From existing: {len(existing)}")
    print(f"   Synthetic:     {len(synthetic)}")

    # Score distribution
    from collections import Counter
    score_dist = Counter(r['score'] for r in unique)
    print(f"\n   Score distribution (RUBRIC-BASED):")
    for s in sorted(score_dist.keys()):
        bar = '#' * score_dist[s]
        print(f"     Score {s:2d}: {score_dist[s]:3d} {bar}")

    cat_dist = Counter(r['category'] for r in unique)
    print(f"\n   Category distribution:")
    for c in sorted(cat_dist.keys()):
        print(f"     {c}: {cat_dist[c]}")

    # Show rubric examples
    print(f"\n   Sample rubric scores:")
    samples = random.sample(unique, min(8, len(unique)))
    for s in sorted(samples, key=lambda x: x['score']):
        text_preview = s['prompt_text'][:80] + ('...' if len(s['prompt_text']) > 80 else '')
        print(f"     [{s['score']:2d}] {text_preview}")


if __name__ == '__main__':
    main()
