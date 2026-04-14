"""
Train a BiLSTM model for multi-label element detection.
Input:  text prompt
Output: which elements are present (Role, Format, Constraints, Examples, Context)

Architecture: Embedding → BiLSTM → BiLSTM → Dense → Sigmoid (multi-label)
Framework:    PyTorch
"""

import os
import pickle
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

# ── Config ────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(SCRIPT_DIR, 'dataset', 'prompts_dataset.csv')
MODEL_PATH = os.path.join(SCRIPT_DIR, 'saved_models', 'element_detector.pt')
TOKENIZER_PATH = os.path.join(SCRIPT_DIR, 'saved_models', 'tokenizer.pickle')

ELEMENT_COLS = ['has_role', 'has_format', 'has_constraints', 'has_examples', 'has_context']
ELEMENT_NAMES = ['Role', 'Format', 'Constraints', 'Examples', 'Context']

VOCAB_SIZE = 5000
MAX_LEN = 200
EMBEDDING_DIM = 64
HIDDEN_DIM = 64
EPOCHS = 30
BATCH_SIZE = 16
LEARNING_RATE = 0.001
PATIENCE = 5

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


def load_tokenizer():
    if os.path.exists(TOKENIZER_PATH):
        with open(TOKENIZER_PATH, 'rb') as f:
            return pickle.load(f)
    return None


def pad_sequences(sequences, maxlen):
    result = np.zeros((len(sequences), maxlen), dtype=np.int64)
    for i, seq in enumerate(sequences):
        if len(seq) > maxlen:
            seq = seq[:maxlen]
        if len(seq) > 0:
            result[i, -len(seq):] = seq
    return result


# ── Model ─────────────────────────────────────────────────────────
class LSTMElementDetector(nn.Module):
    """Bidirectional LSTM for multi-label prompt element detection."""
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
        x = x[:, -1, :]  # Last hidden state
        x = self.relu(self.fc1(x))
        x = self.dropout3(x)
        x = self.fc2(x)  # Raw logits
        return x


def main():
    print("=" * 50)
    print("  BiLSTM Element Detector - Training (PyTorch)")
    print("=" * 50)

    # ── 1. Load Data ──────────────────────────────────────────────
    df = pd.read_csv(DATASET_PATH)
    print(f"\n[1/5] Loaded {len(df)} prompts from dataset")

    texts = df['prompt_text'].astype(str).values
    labels = df[ELEMENT_COLS].values.astype(np.float32)

    print(f"       Element coverage in dataset:")
    for i, name in enumerate(ELEMENT_NAMES):
        count = int(labels[:, i].sum())
        pct = count / len(labels) * 100
        print(f"         {name}: {count} ({pct:.0f}%)")

    # ── 2. Tokenize ──────────────────────────────────────────────
    print("\n[2/5] Tokenizing text...")
    tokenizer = load_tokenizer()
    if tokenizer is None:
        print("       ERROR: Tokenizer not found. Run train_scorer.py first!")
        return

    print("       Loaded existing tokenizer")
    sequences = tokenizer.texts_to_sequences(texts)
    padded = pad_sequences(sequences, maxlen=MAX_LEN)

    # ── 3. Split ──────────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        padded, labels, test_size=0.2, random_state=42
    )
    print(f"[3/5] Train: {len(X_train)} samples | Test: {len(X_test)} samples")

    train_dataset = TensorDataset(
        torch.LongTensor(X_train), torch.FloatTensor(y_train)
    )
    test_dataset = TensorDataset(
        torch.LongTensor(X_test), torch.FloatTensor(y_test)
    )
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE)

    # ── 4. Build Model ────────────────────────────────────────────
    print("[4/5] Building BiLSTM element detector...")
    model = LSTMElementDetector(VOCAB_SIZE, EMBEDDING_DIM, HIDDEN_DIM, len(ELEMENT_COLS)).to(device)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"       Total params: {total_params:,}")

    criterion = nn.BCEWithLogitsLoss()  # Multi-label: binary cross-entropy
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=3, min_lr=1e-6
    )

    # ── 5. Train ──────────────────────────────────────────────────
    print("\n[5/5] Training element detector...")
    best_val_loss = float('inf')
    patience_counter = 0
    best_state = None

    for epoch in range(EPOCHS):
        # Training
        model.train()
        train_loss = 0
        for batch_X, batch_y in train_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            optimizer.zero_grad()
            logits = model(batch_X)
            loss = criterion(logits, batch_y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
        train_loss /= len(train_loader)

        # Validation
        model.eval()
        val_loss = 0
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for batch_X, batch_y in test_loader:
                batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                logits = model(batch_X)
                val_loss += criterion(logits, batch_y).item()
                preds = (torch.sigmoid(logits) > 0.5).float()
                val_correct += (preds == batch_y).sum().item()
                val_total += batch_y.numel()
        val_loss /= len(test_loader)
        val_acc = val_correct / val_total

        scheduler.step(val_loss)

        print(f"  Epoch {epoch+1:2d}/{EPOCHS} | "
              f"Train Loss: {train_loss:.4f} | "
              f"Val Loss: {val_loss:.4f} | "
              f"Val Acc: {val_acc:.1%}")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            patience_counter += 1
            if patience_counter >= PATIENCE:
                print(f"  Early stopping at epoch {epoch+1}")
                break

    if best_state:
        model.load_state_dict(best_state)

    # ── Evaluate ──────────────────────────────────────────────────
    model.eval()
    all_preds = []
    all_actuals = []
    with torch.no_grad():
        for batch_X, batch_y in test_loader:
            batch_X = batch_X.to(device)
            logits = model(batch_X)
            preds = (torch.sigmoid(logits) > 0.5).float()
            all_preds.extend(preds.cpu().numpy())
            all_actuals.extend(batch_y.numpy())

    all_preds = np.array(all_preds)
    all_actuals = np.array(all_actuals)

    print(f"\n{'=' * 50}")
    print(f"  Per-element accuracy:")
    for i, name in enumerate(ELEMENT_NAMES):
        correct = (all_preds[:, i] == all_actuals[:, i]).sum()
        acc = correct / len(all_actuals) * 100
        print(f"    {name:12s}: {acc:.1f}%")
    print(f"{'=' * 50}")

    # ── Sample Predictions ────────────────────────────────────────
    print("\n  Sample predictions (threshold=0.5):")
    for i in range(min(3, len(all_preds))):
        pred_elems = [ELEMENT_NAMES[j] for j in range(5) if all_preds[i][j] > 0.5]
        actual_elems = [ELEMENT_NAMES[j] for j in range(5) if all_actuals[i][j] > 0.5]
        print(f"    Predicted: {pred_elems or ['None']}")
        print(f"    Actual:    {actual_elems or ['None']}")
        print()

    # ── Save ──────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)

    torch.save({
        'model_state_dict': model.state_dict(),
        'vocab_size': VOCAB_SIZE,
        'embed_dim': EMBEDDING_DIM,
        'hidden_dim': HIDDEN_DIM,
        'num_elements': len(ELEMENT_COLS),
        'element_names': ELEMENT_NAMES,
    }, MODEL_PATH)
    print(f"\n  ✅ Model saved to: {MODEL_PATH}")


if __name__ == '__main__':
    main()
