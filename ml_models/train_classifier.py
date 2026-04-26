"""
Train a 1D CNN model to classify prompt category.
Input:  text prompt
Output: category (Analytical, Creative, Technical, Directive, Casual, Formal)

Architecture: Embedding → Conv1D → Conv1D → GlobalMaxPool → Dense → Softmax
Framework:    PyTorch
"""

import os
import pickle
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

# ── Config ────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(SCRIPT_DIR, 'dataset', 'prompts_dataset.csv')
MODEL_PATH = os.path.join(SCRIPT_DIR, 'saved_models', 'classifier_cnn.pt')
LABEL_ENCODER_PATH = os.path.join(SCRIPT_DIR, 'saved_models', 'label_encoder.pickle')
TOKENIZER_PATH = os.path.join(SCRIPT_DIR, 'saved_models', 'tokenizer.pickle')

CATEGORIES = ['Analytical', 'Creative', 'Technical', 'Directive', 'Casual', 'Formal']
VOCAB_SIZE = 5000
MAX_LEN = 200
EMBEDDING_DIM = 64
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


# ── Helper: load shared tokenizer ─────────────────────────────────
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
class TextCNN(nn.Module):
    """1D Convolutional Neural Network for text classification."""
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
        x = self.embedding(x)          # (batch, seq_len, embed_dim)
        x = x.permute(0, 2, 1)         # (batch, embed_dim, seq_len) for Conv1d
        x = self.relu(self.conv1(x))
        x = self.dropout1(x)
        x = self.relu(self.conv2(x))
        x = self.global_pool(x)        # (batch, 64, 1)
        x = x.squeeze(2)               # (batch, 64)
        x = self.relu(self.fc1(x))
        x = self.dropout2(x)
        x = self.relu(self.fc2(x))
        x = self.fc3(x)                # raw logits (batch, num_classes)
        return x


def main():
    print("=" * 50)
    print("  CNN Prompt Classifier - Training (PyTorch)")
    print("=" * 50)

    # ── 1. Load Data ──────────────────────────────────────────────
    df = pd.read_csv(DATASET_PATH)
    print(f"\n[1/5] Loaded {len(df)} prompts from dataset")

    # Filter to valid categories
    df = df[df['category'].isin(CATEGORIES)].copy()
    print(f"       After filtering: {len(df)} prompts with valid categories")

    texts = df['prompt_text'].astype(str).values
    categories = df['category'].values

    # ── 2. Encode Labels ──────────────────────────────────────────
    label_encoder = LabelEncoder()
    label_encoder.fit(CATEGORIES)
    y_encoded = label_encoder.transform(categories)

    print(f"[2/5] Categories: {list(label_encoder.classes_)}")

    # ── 3. Tokenize ──────────────────────────────────────────────
    print("[3/5] Tokenizing text...")
    tokenizer = load_tokenizer()
    if tokenizer is None:
        print("       ERROR: Tokenizer not found. Run train_scorer.py first!")
        return

    sequences = tokenizer.texts_to_sequences(texts)
    padded = pad_sequences(sequences, maxlen=MAX_LEN)

    # ── 4. Split ──────────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        padded, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
    )
    print(f"[4/5] Train: {len(X_train)} samples | Test: {len(X_test)} samples")

    train_dataset = TensorDataset(
        torch.LongTensor(X_train), torch.LongTensor(y_train)
    )
    test_dataset = TensorDataset(
        torch.LongTensor(X_test), torch.LongTensor(y_test)
    )
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE)

    # ── 5. Build CNN Model ────────────────────────────────────────
    print("[5/5] Building CNN model...")
    model = TextCNN(VOCAB_SIZE, EMBEDDING_DIM, len(CATEGORIES)).to(device)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"       Total params: {total_params:,}")

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=3, min_lr=1e-6
    )

    # ── Train ─────────────────────────────────────────────────────
    print("\nTraining CNN classifier...")
    best_val_loss = float('inf')
    patience_counter = 0
    best_state = None

    for epoch in range(EPOCHS):
        # Training
        model.train()
        train_loss = 0
        train_correct = 0
        train_total = 0
        for batch_X, batch_y in train_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            optimizer.zero_grad()
            logits = model(batch_X)
            loss = criterion(logits, batch_y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
            train_correct += (logits.argmax(1) == batch_y).sum().item()
            train_total += len(batch_y)
        train_loss /= len(train_loader)
        train_acc = train_correct / train_total

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
                val_correct += (logits.argmax(1) == batch_y).sum().item()
                val_total += len(batch_y)
        val_loss /= len(test_loader)
        val_acc = val_correct / val_total

        scheduler.step(val_loss)

        print(f"  Epoch {epoch+1:2d}/{EPOCHS} | "
              f"Train Loss: {train_loss:.4f} Acc: {train_acc:.1%} | "
              f"Val Loss: {val_loss:.4f} Acc: {val_acc:.1%}")

        # Early stopping
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            patience_counter += 1
            if patience_counter >= PATIENCE:
                print(f"  Early stopping at epoch {epoch+1}")
                break

    # Restore best weights
    if best_state:
        model.load_state_dict(best_state)

    # ── Evaluate ──────────────────────────────────────────────────
    model.eval()
    all_preds = []
    all_actuals = []
    all_probs = []
    with torch.no_grad():
        for batch_X, batch_y in test_loader:
            batch_X = batch_X.to(device)
            logits = model(batch_X)
            probs = torch.softmax(logits, dim=1)
            all_preds.extend(logits.argmax(1).cpu().numpy())
            all_actuals.extend(batch_y.numpy())
            all_probs.extend(probs.cpu().numpy())

    accuracy = np.mean(np.array(all_preds) == np.array(all_actuals))
    print(f"\n{'=' * 50}")
    print(f"  Results:")
    print(f"  Test Accuracy: {accuracy * 100:.1f}%")
    print(f"{'=' * 50}")

    # ── Sample Predictions ────────────────────────────────────────
    print("\n  Sample predictions vs actual:")
    for i in range(min(5, len(all_preds))):
        pred_cat = label_encoder.inverse_transform([all_preds[i]])[0]
        actual_cat = label_encoder.inverse_transform([all_actuals[i]])[0]
        confidence = all_probs[i][all_preds[i]] * 100
        print(f"    Predicted: {pred_cat} ({confidence:.0f}%) | Actual: {actual_cat}")

    # ── Save ──────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)

    torch.save({
        'model_state_dict': model.state_dict(),
        'vocab_size': VOCAB_SIZE,
        'embed_dim': EMBEDDING_DIM,
        'num_classes': len(CATEGORIES),
        'categories': CATEGORIES,
    }, MODEL_PATH)
    print(f"\n  [OK] Model saved to: {MODEL_PATH}")

    with open(LABEL_ENCODER_PATH, 'wb') as f:
        pickle.dump(label_encoder, f)
    print(f"  [OK] Label encoder saved to: {LABEL_ENCODER_PATH}")


if __name__ == '__main__':
    main()
