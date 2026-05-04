"""
Flask Prediction Server — Serves trained LSTM/CNN models (PyTorch).
Runs on port 5000 and provides a /predict endpoint.

The Node.js backend calls this to get model predictions,
then merges with Groq API text generation for the final response.
"""

import os
import pickle
import numpy as np
import json
import re
import math

import torch
import torch.nn as nn
from flask import Flask, request, jsonify
from flask_cors import CORS

# ── Config ────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(SCRIPT_DIR, 'saved_models')

SCORER_PATH = os.path.join(MODELS_DIR, 'scorer_lstm.pt')
CLASSIFIER_PATH = os.path.join(MODELS_DIR, 'classifier_cnn.pt')
ELEMENT_PATH = os.path.join(MODELS_DIR, 'element_detector.pt')
TOKENIZER_PATH = os.path.join(MODELS_DIR, 'tokenizer.pickle')
LABEL_ENCODER_PATH = os.path.join(MODELS_DIR, 'label_encoder.pickle')
CALIBRATION_PATH = os.path.join(MODELS_DIR, 'score_calibration.json')

CATEGORIES = ['Analytical', 'Creative', 'Technical', 'Directive', 'Casual', 'Formal']
ELEMENT_NAMES = ['role', 'format', 'constraints', 'examples', 'context']
MAX_LEN = 200
PORT = 5000

device = torch.device('cpu')


# ── Tokenizer (must match train_scorer.py for pickle compatibility) ─
class SimpleTokenizer:
    """Minimal text tokenizer (mirrors Keras Tokenizer behavior)."""
    def __init__(self, num_words=5000, oov_token='<OOV>'):
        self.num_words = num_words
        self.oov_token = oov_token
        self.word_index = {}
        self.oov_index = 1

    def fit_on_texts(self, texts):
        word_counts = {}
        for text in texts:
            for word in str(text).lower().split():
                word_counts[word] = word_counts.get(word, 0) + 1
        sorted_words = sorted(word_counts, key=word_counts.get, reverse=True)
        self.word_index = {self.oov_token: 1}
        for i, word in enumerate(sorted_words[:self.num_words - 2], start=2):
            self.word_index[word] = i

    def texts_to_sequences(self, texts):
        sequences = []
        for text in texts:
            seq = []
            for word in str(text).lower().split():
                idx = self.word_index.get(word, self.oov_index)
                if idx < self.num_words:
                    seq.append(idx)
            sequences.append(seq)
        return sequences


# ── Model Definitions (must match training scripts) ───────────────
class LSTMScorer(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.lstm1 = nn.LSTM(embed_dim, hidden_dim, batch_first=True, bidirectional=True)
        self.dropout1 = nn.Dropout(0.3)
        self.lstm2 = nn.LSTM(hidden_dim * 2, 32, batch_first=True, bidirectional=True)
        self.dropout2 = nn.Dropout(0.3)
        self.fc1 = nn.Linear(32 * 2, 32)
        self.dropout3 = nn.Dropout(0.2)
        self.fc2 = nn.Linear(32, 16)
        self.fc3 = nn.Linear(16, 1)
        self.sigmoid = nn.Sigmoid()
        self.relu = nn.ReLU()

    def forward(self, x):
        x = self.embedding(x)
        x, _ = self.lstm1(x)
        x = self.dropout1(x)
        x, _ = self.lstm2(x)
        x = self.dropout2(x)
        x = x[:, -1, :]
        x = self.relu(self.fc1(x))
        x = self.dropout3(x)
        x = self.relu(self.fc2(x))
        x = self.sigmoid(self.fc3(x))
        return x.squeeze(1)


class TextCNN(nn.Module):
    def __init__(self, vocab_size, embed_dim, num_classes):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.conv1 = nn.Conv1d(embed_dim, 128, kernel_size=5, padding=2)
        self.dropout1 = nn.Dropout(0.3)
        self.conv2 = nn.Conv1d(128, 64, kernel_size=3, padding=1)
        self.global_pool = nn.AdaptiveMaxPool1d(1)
        self.fc1 = nn.Linear(64, 64)
        self.dropout2 = nn.Dropout(0.3)
        self.fc2 = nn.Linear(64, 32)
        self.fc3 = nn.Linear(32, num_classes)
        self.relu = nn.ReLU()

    def forward(self, x):
        x = self.embedding(x)
        x = x.permute(0, 2, 1)
        x = self.relu(self.conv1(x))
        x = self.dropout1(x)
        x = self.relu(self.conv2(x))
        x = self.global_pool(x)
        x = x.squeeze(2)
        x = self.relu(self.fc1(x))
        x = self.dropout2(x)
        x = self.relu(self.fc2(x))
        x = self.fc3(x)
        return x


class LSTMElementDetector(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, num_elements):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.lstm1 = nn.LSTM(embed_dim, hidden_dim, batch_first=True, bidirectional=True)
        self.dropout1 = nn.Dropout(0.3)
        self.lstm2 = nn.LSTM(hidden_dim * 2, 32, batch_first=True, bidirectional=True)
        self.dropout2 = nn.Dropout(0.3)
        self.fc1 = nn.Linear(32 * 2, 32)
        self.dropout3 = nn.Dropout(0.2)
        self.fc2 = nn.Linear(32, num_elements)
        self.relu = nn.ReLU()

    def forward(self, x):
        x = self.embedding(x)
        x, _ = self.lstm1(x)
        x = self.dropout1(x)
        x, _ = self.lstm2(x)
        x = self.dropout2(x)
        x = x[:, -1, :]
        x = self.relu(self.fc1(x))
        x = self.dropout3(x)
        x = self.fc2(x)
        return x


# ── Load Models ───────────────────────────────────────────────────
print("Loading models...")

scorer_model = None
classifier_model = None
element_model = None
tokenizer = None
label_encoder = None
score_calibration = None

try:
    with open(TOKENIZER_PATH, 'rb') as f:
        tokenizer = pickle.load(f)
    print("  [OK] Tokenizer loaded")
except Exception as e:
    print(f"  ❌ Tokenizer: {e}")

try:
    checkpoint = torch.load(SCORER_PATH, map_location=device, weights_only=False)
    scorer_model = LSTMScorer(
        checkpoint['vocab_size'],
        checkpoint['embed_dim'],
        checkpoint['hidden_dim']
    ).to(device)
    scorer_model.load_state_dict(checkpoint['model_state_dict'])
    scorer_model.eval()
    print("  [OK] Scorer BiLSTM loaded")
except Exception as e:
    print(f"  ❌ Scorer: {e}")

try:
    checkpoint = torch.load(CLASSIFIER_PATH, map_location=device, weights_only=False)
    classifier_model = TextCNN(
        checkpoint['vocab_size'],
        checkpoint['embed_dim'],
        checkpoint['num_classes']
    ).to(device)
    classifier_model.load_state_dict(checkpoint['model_state_dict'])
    classifier_model.eval()
    print("  [OK] Classifier CNN loaded")
except Exception as e:
    print(f"  ❌ Classifier: {e}")

try:
    checkpoint = torch.load(ELEMENT_PATH, map_location=device, weights_only=False)
    element_model = LSTMElementDetector(
        checkpoint['vocab_size'],
        checkpoint['embed_dim'],
        checkpoint['hidden_dim'],
        checkpoint['num_elements']
    ).to(device)
    element_model.load_state_dict(checkpoint['model_state_dict'])
    element_model.eval()
    print("  [OK] Element Detector BiLSTM loaded")
except Exception as e:
    print(f"  ❌ Element Detector: {e}")

try:
    with open(LABEL_ENCODER_PATH, 'rb') as f:
        label_encoder = pickle.load(f)
    print("  [OK] Label encoder loaded")
except Exception as e:
    print(f"  ❌ Label encoder: {e}")

try:
    if os.path.exists(CALIBRATION_PATH):
        with open(CALIBRATION_PATH, 'r', encoding='utf-8') as f:
            score_calibration = json.load(f)
        print("  [OK] Score calibration loaded")
    else:
        print("  ℹ️  Score calibration not found (using raw score)")
except Exception as e:
    print(f"  ❌ Score calibration: {e}")


# ── Helper ────────────────────────────────────────────────────────
def preprocess(text):
    """Tokenize and pad a single text string."""
    if tokenizer is None:
        return None
    seq = tokenizer.texts_to_sequences([text])
    # Pad
    result = np.zeros((1, MAX_LEN), dtype=np.int64)
    s = seq[0][:MAX_LEN]
    if len(s) > 0:
        result[0, -len(s):] = s
    return torch.LongTensor(result).to(device)


def apply_score_calibration(raw_score):
    """Apply optional linear score calibration if available."""
    if not score_calibration:
        return raw_score, False

    slope = float(score_calibration.get('slope', 1.0))
    intercept = float(score_calibration.get('intercept', 0.0))
    adjusted = slope * float(raw_score) + intercept
    adjusted = round(max(1.0, min(10.0, adjusted)), 1)
    return adjusted, True


# ══════════════════════════════════════════════════════════════════
#  HEURISTIC ENGINE — Augments weak model predictions
# ══════════════════════════════════════════════════════════════════

def heuristic_detect_elements(text):
    """
    Regex-based element detection — mirrors the Node.js backend's
    detectPromptElements for consistency. Used as fallback / override
    when the LSTM element detector misses obvious signals.
    """
    t = str(text or '')
    return {
        'role': bool(re.search(
            r'\b(act as|you are a?|persona|pretend|role|as a|expert|'
            r'assistant|developer|scientist|writer|teacher|coach|analyst|'
            r'consultant|advisor|engineer|designer|specialist|professional)\b',
            t, re.IGNORECASE
        )),
        'format': bool(re.search(
            r'\b(json|markdown|table|csv|format|output|structure|code block|'
            r'email|report|essay|html|xml|numbered list|bullet\s*points?|'
            r'step-by-step|steps|list|paragraph|summary|outline)\b|'
            r'(?:return|respond|output|provide|give)\s+(?:in|as)\s+(?:a|an)?\s*'
            r'(?:json|table|list|markdown|csv|format)',
            t, re.IGNORECASE
        )),
        'constraints': bool(re.search(
            r'\b(limit|max|must|exactly|no more|at least|words|under|avoid|'
            r"don'?t|do not|never|only|restrict|constraint|edge case|"
            r'including edge|requirements?|ensure|make sure|important|'
            r'keep it|be concise|be specific|be brief)\b',
            t, re.IGNORECASE
        )),
        'examples': bool(re.search(
            r'\b(example|sample|for instance|input:|output:|e\.g\.|'
            r'demonstrate|like this|such as|illustration|here is|'
            r'for example|consider this|given this)\b',
            t, re.IGNORECASE
        )),
        'context': bool(re.search(
            r'\b(context|background|situation|scenario|given that|assuming|'
            r'based on|the goal|objective|purpose|audience|for\s+(?:a|an)\s+'
            r'[\w\s-]+\s+(?:student|beginner)|target audience|use case|'
            r'project|working on|building|creating|developing|'
            r'dataset|data|following|analyze|analysis)\b',
            t, re.IGNORECASE
        ))
    }


def merge_elements(model_elements, heuristic_elements):
    """
    Merge model predictions with heuristic detections.
    If EITHER source says an element is present, it's present.
    This prevents false negatives from the weak LSTM.
    """
    merged = {}
    for key in ELEMENT_NAMES:
        model_val = model_elements.get(key, False) if model_elements else False
        heur_val = heuristic_elements.get(key, False)
        merged[key] = bool(model_val or heur_val)
    return merged


def heuristic_score(text, elements):
    """
    Calculate a heuristic quality score based on structural signals.
    Returns a score from 1-10.
    """
    t = str(text or '')
    score = 3.0  # Base score for any prompt

    # ── Length scoring ─────────────────────────────────────────────
    word_count = len(t.split())
    if word_count >= 10:
        score += 0.5
    if word_count >= 25:
        score += 0.5
    if word_count >= 50:
        score += 0.5
    if word_count >= 80:
        score += 0.3
    if word_count < 5:
        score -= 1.0

    # ── Element-based scoring ─────────────────────────────────────
    elem_count = sum(1 for v in elements.values() if v)
    score += elem_count * 0.8  # Each element adds ~0.8 pts

    # ── Structural quality signals ────────────────────────────────
    # Multi-sentence / well-structured
    sentence_count = len(re.findall(r'[.!?]+', t))
    if sentence_count >= 2:
        score += 0.3
    if sentence_count >= 3:
        score += 0.2

    # Has numbered instructions or bullet points
    if re.search(r'(?:\d+[.)]\s|\*\s|-\s|•)', t):
        score += 0.5

    # Has question marks (shows inquiry / analytical thinking)
    if '?' in t:
        score += 0.2

    # Uses quotation marks or code blocks
    if re.search(r'["\'`]', t):
        score += 0.2

    # Penalize very vague / generic prompts
    if re.search(r'^(help|tell me|what is|how to|explain)\b', t.strip(), re.IGNORECASE) and word_count < 10:
        score -= 1.0

    return round(max(1.0, min(10.0, score)), 1)


def blend_scores(model_score, heuristic_score_val):
    """
    Blend model and heuristic scores.
    We weight heuristic higher because the model is undertrained.
    """
    if model_score is None:
        return heuristic_score_val

    # 40% model, 60% heuristic — gives model some influence but
    # heuristic prevents obviously wrong scores
    blended = (model_score * 0.4) + (heuristic_score_val * 0.6)
    return round(max(1.0, min(10.0, blended)), 1)


def detect_category_signals(text):
    """Lexical signals used to stabilize category predictions."""
    t = str(text or '').lower()
    scores = {}

    # Each category gets a weighted score based on keyword matches
    scores['Technical'] = 0
    if re.search(r'\b(api|sql|python|javascript|java|code|debug|stack trace|'
                 r'algorithm|function|database|server|deploy|docker|git|'
                 r'framework|library|compile|runtime|backend|frontend|'
                 r'css|html|programming|software|bug|error|implement|'
                 r'json|xml|http|endpoint|query|schema|migration)\b', t):
        scores['Technical'] = 3

    scores['Analytical'] = 0
    if re.search(r'\b(analy[sz]e|assessment|root cause|evaluate|compare|'
                 r'failure|diagnose|findings?|research|investigate|'
                 r'metrics|statistics|data|trends?|insights?|'
                 r'examine|review|study|audit|benchmark|performance|'
                 r'report|summary|assessment|conclusions?)\b', t):
        scores['Analytical'] = 3

    scores['Creative'] = 0
    if re.search(r'\b(story|poem|creative|brainstorm|slogan|script|'
                 r'imagine|lyrics|fiction|narrative|character|plot|'
                 r'artistic|design|innovative|novel|metaphor|'
                 r'compose|write a story|creative writing)\b', t):
        scores['Creative'] = 3

    scores['Directive'] = 0
    if re.search(r'\b(must|exactly|strict|only|do not|don\'t|no more than|'
                 r'under\s+\d+|list|bullet\s*points?|step-by-step|'
                 r'constraints?|requirements?|rules?|ensure|'
                 r'specific|precisely|mandatory)\b', t):
        scores['Directive'] = 3

    scores['Formal'] = 0
    if re.search(r'\b(formal|professional|report|business|official|'
                 r'executive summary|memorandum|proposal|corporate|'
                 r'stakeholder|presentation|documentation)\b', t):
        scores['Formal'] = 3

    scores['Casual'] = 0
    if re.search(r'\b(casual|friendly|chat|hey|hi |lol|gonna|wanna|'
                 r'cool|awesome|dude|btw|imo)\b', t):
        scores['Casual'] = 3

    # Bonus: if prompt has role + format + constraints, it's likely Directive
    if re.search(r'\b(you are|act as)\b', t) and re.search(r'\b(format|json|list|table|step)\b', t):
        scores['Directive'] = max(scores['Directive'], 2)

    # Bonus: if prompt mentions data/analysis/summary, boost Analytical
    if re.search(r'\b(dataset|data\s+(?:set|analysis)|provide.*summary|key\s+insights)\b', t):
        scores['Analytical'] = max(scores['Analytical'], 4)

    return scores


def maybe_adjust_category(prompt_text, model_category, model_confidence):
    """Apply heavyweight rule assist — corrects model when signals are strong."""
    signal_scores = detect_category_signals(prompt_text)
    best_signal_category = max(signal_scores, key=signal_scores.get)
    best_signal_score = signal_scores[best_signal_category]

    # If we have a strong signal and model is wrong or uncertain
    should_adjust = (
        best_signal_score >= 3 and (
            model_confidence < 0.85 or
            model_category != best_signal_category
        )
    )

    # Also adjust if model says "Casual" but prompt is clearly structured
    if model_category == 'Casual' and best_signal_score >= 2 and best_signal_category != 'Casual':
        should_adjust = True

    if should_adjust and best_signal_score >= 2:
        return best_signal_category, True
    return model_category, False


# ── Flask App ─────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)


@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict score, category, and elements for a given prompt.
    Uses ML model predictions blended with heuristic analysis
    for robust, accurate results.
    
    Request body: { "prompt": "your prompt text here" }
    Response: {
        "score": 7.2,
        "category": "Technical",
        "category_confidence": 0.85,
        "elements": { "role": true, "format": false, ... },
        "model_used": true
    }
    """
    data = request.get_json()
    if not data or not data.get('prompt'):
        return jsonify({'error': 'Missing "prompt" field'}), 400

    prompt_text = str(data['prompt']).strip()
    if len(prompt_text) < 2:
        return jsonify({'error': 'Prompt too short'}), 400

    padded = preprocess(prompt_text)
    if padded is None:
        return jsonify({'error': 'Tokenizer not loaded'}), 500

    result = {'model_used': True}

    # ── Heuristic Element Detection (always run) ──────────────────
    heur_elements = heuristic_detect_elements(prompt_text)

    # ── Elements (LSTM + Heuristic merge) ─────────────────────────
    model_elements = None
    if element_model is not None:
        with torch.no_grad():
            logits = element_model(padded)
            preds = torch.sigmoid(logits)[0]
        model_elements = {}
        for i, name in enumerate(ELEMENT_NAMES):
            model_elements[name] = bool(preds[i] > 0.5)

    # Merge: union of model + heuristic (prevents false negatives)
    final_elements = merge_elements(model_elements, heur_elements)
    result['elements'] = final_elements

    # ── Score (LSTM + Heuristic blend) ────────────────────────────
    model_raw_score = None
    if scorer_model is not None:
        with torch.no_grad():
            score_pred = scorer_model(padded).item()
        model_raw_score = score_pred * 9 + 1  # Convert 0-1 back to 1-10
        model_raw_score = round(max(1, min(10, model_raw_score)), 1)

        # Apply calibration to model score
        calibrated_model_score, was_calibrated = apply_score_calibration(model_raw_score)
    else:
        calibrated_model_score = None
        was_calibrated = False

    # Compute heuristic score based on prompt structure
    heur_score = heuristic_score(prompt_text, final_elements)

    # Blend model + heuristic
    final_score = blend_scores(calibrated_model_score, heur_score)
    
    result['score'] = final_score
    result['raw_score'] = model_raw_score
    result['heuristic_score'] = heur_score
    result['score_calibrated'] = was_calibrated

    # ── Category (CNN + Rules) ────────────────────────────────────
    if classifier_model is not None:
        with torch.no_grad():
            logits = classifier_model(padded)
            probs = torch.softmax(logits, dim=1)[0]
        cat_idx = int(probs.argmax())
        confidence = float(probs[cat_idx])

        if label_encoder is not None:
            category = label_encoder.inverse_transform([cat_idx])[0]
        else:
            category = CATEGORIES[cat_idx] if cat_idx < len(CATEGORIES) else 'Unknown'

        adjusted_category, was_adjusted = maybe_adjust_category(prompt_text, category, confidence)

        result['category'] = adjusted_category
        result['category_confidence'] = round(max(confidence, 0.75) if was_adjusted else confidence, 3)
        result['category_source'] = 'cnn+rules' if was_adjusted else 'cnn'
        if was_adjusted:
            result['category_model_raw'] = category
    else:
        # Pure heuristic fallback
        signal_scores = detect_category_signals(prompt_text)
        best_cat = max(signal_scores, key=signal_scores.get)
        if signal_scores[best_cat] > 0:
            result['category'] = best_cat
            result['category_confidence'] = 0.7
        else:
            result['category'] = 'Casual'
            result['category_confidence'] = 0.5
        result['category_source'] = 'rules'

    return jsonify(result)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'framework': 'PyTorch',
        'models': {
            'scorer': scorer_model is not None,
            'classifier': classifier_model is not None,
            'element_detector': element_model is not None,
            'tokenizer': tokenizer is not None,
        }
    })


@app.route('/info', methods=['GET'])
def info():
    """Model information endpoint."""
    return jsonify({
        'name': 'Prompt Tutor ML Service',
        'framework': 'PyTorch',
        'models': {
            'scorer': {
                'type': 'Bidirectional LSTM (PyTorch)',
                'task': 'Prompt quality score prediction (1-10)',
                'loaded': scorer_model is not None,
            },
            'classifier': {
                'type': '1D CNN / Conv1D (PyTorch)',
                'task': 'Prompt category classification',
                'categories': CATEGORIES,
                'loaded': classifier_model is not None,
            },
            'element_detector': {
                'type': 'Bidirectional LSTM Multi-label (PyTorch)',
                'task': 'Prompt element detection',
                'elements': ELEMENT_NAMES,
                'loaded': element_model is not None,
            },
        },
        'preprocessing': {
            'vocab_size': 5000,
            'max_sequence_length': MAX_LEN,
            'tokenizer_loaded': tokenizer is not None,
        },
        'score_calibration_loaded': score_calibration is not None,
    })


# ── Run ───────────────────────────────────────────────────────────
if __name__ == '__main__':
    print(f"\n{'=' * 50}")
    print(f"  🧠 ML Prediction Server (PyTorch)")
    print(f"  Running on http://localhost:{PORT}")
    print(f"  Endpoints:")
    print(f"    POST /predict  — Get predictions")
    print(f"    GET  /health   — Health check")
    print(f"    GET  /info     — Model info")
    print(f"{'=' * 50}\n")
    app.run(host='0.0.0.0', port=PORT, debug=False)
