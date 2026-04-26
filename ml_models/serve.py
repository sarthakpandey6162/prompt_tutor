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


# ── Flask App ─────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)


@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict score, category, and elements for a given prompt.
    
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

    # ── Score (LSTM) ──────────────────────────────────────────────
    if scorer_model is not None:
        with torch.no_grad():
            score_pred = scorer_model(padded).item()
        raw_score = score_pred * 9 + 1  # Convert 0-1 back to 1-10
        raw_score = round(max(1, min(10, raw_score)), 1)
        score, calibrated = apply_score_calibration(raw_score)
        result['score'] = score
        result['raw_score'] = raw_score
        result['score_calibrated'] = calibrated
    else:
        result['score'] = None
        result['score_error'] = 'Scorer model not loaded'

    # ── Category (CNN) ────────────────────────────────────────────
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

        result['category'] = category
        result['category_confidence'] = round(confidence, 3)
    else:
        result['category'] = None
        result['category_error'] = 'Classifier model not loaded'

    # ── Elements (LSTM) ───────────────────────────────────────────
    if element_model is not None:
        with torch.no_grad():
            logits = element_model(padded)
            preds = torch.sigmoid(logits)[0]
        elements = {}
        for i, name in enumerate(ELEMENT_NAMES):
            elements[name] = bool(preds[i] > 0.5)
        result['elements'] = elements
    else:
        result['elements'] = None
        result['elements_error'] = 'Element detector not loaded'

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
