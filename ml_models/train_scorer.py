"""
Train a BiLSTM model to predict prompt quality score (1-10).
Input:  text prompt
Output: quality score (regression)

Architecture: Embedding → BiLSTM → BiLSTM → Dense → Score
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
MODEL_PATH = os.path.join(SCRIPT_DIR, 'saved_models', 'scorer_lstm.pt')
TOKENIZER_PATH = os.path.join(SCRIPT_DIR, 'saved_models', 'tokenizer.pickle')

VOCAB_SIZE = 5000
MAX_LEN = 200
EMBEDDING_DIM = 64
HIDDEN_DIM = 64
EPOCHS = 60
BATCH_SIZE = 8
LEARNING_RATE = 0.002
PATIENCE = 8

device = torch.device('cpu')


# ── Tokenizer ─────────────────────────────────────────────────────
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


def pad_sequences(sequences, maxlen, padding='pre'):
    result = np.zeros((len(sequences), maxlen), dtype=np.int64)
    for i, seq in enumerate(sequences):
        if len(seq) > maxlen:
            seq = seq[:maxlen]
        if len(seq) > 0:
            if padding == 'post':
                result[i, :len(seq)] = seq
            else:
                result[i, -len(seq):] = seq
    return result


# ── Model ─────────────────────────────────────────────────────────
class LSTMScorer(nn.Module):
    """Bidirectional LSTM for prompt quality score prediction."""
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
        # Take the last hidden state
        x = x[:, -1, :]
        x = self.relu(self.fc1(x))
        x = self.dropout3(x)
        x = self.relu(self.fc2(x))
        x = self.sigmoid(self.fc3(x))
        return x.squeeze(1)


def main():
    print("=" * 50)
    print("  BiLSTM Prompt Scorer - Training (PyTorch)")
    print("=" * 50)

    # ── 1. Load Data ──────────────────────────────────────────────
    df = pd.read_csv(DATASET_PATH)
    print(f"\n[1/5] Loaded {len(df)} prompts from dataset")

    texts = df['prompt_text'].astype(str).values
    scores = df['score'].astype(float).values

    # Normalize scores to 0-1 range (1-10 → 0-1)
    scores_normalized = (scores - 1) / 9.0

    # ── 2. Tokenize ──────────────────────────────────────────────
    print("[2/5] Tokenizing text...")
    tokenizer = SimpleTokenizer(num_words=VOCAB_SIZE, oov_token='<OOV>')
    tokenizer.fit_on_texts(texts)

    sequences = tokenizer.texts_to_sequences(texts)
    padded = pad_sequences(sequences, maxlen=MAX_LEN)

    print(f"       Vocabulary size: {min(len(tokenizer.word_index), VOCAB_SIZE)}")
    print(f"       Max sequence length: {MAX_LEN}")

    # ── 3. Split Data ─────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        padded, scores_normalized, test_size=0.2, random_state=42
    )
    print(f"[3/5] Train: {len(X_train)} samples | Test: {len(X_test)} samples")

    # Convert to PyTorch tensors
    train_dataset = TensorDataset(
        torch.LongTensor(X_train), torch.FloatTensor(y_train)
    )
    test_dataset = TensorDataset(
        torch.LongTensor(X_test), torch.FloatTensor(y_test)
    )
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE)

    # ── 4. Build Model ────────────────────────────────────────────
    print("[4/5] Building BiLSTM model...")
    model = LSTMScorer(VOCAB_SIZE, EMBEDDING_DIM, HIDDEN_DIM).to(device)

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"       Total params: {total_params:,}")
    print(f"       Trainable params: {trainable_params:,}")

    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=3, min_lr=1e-6
    )

    # ── 5. Train ──────────────────────────────────────────────────
    print("\n[5/5] Training...")
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
            preds = model(batch_X)
            loss = criterion(preds, batch_y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
        train_loss /= len(train_loader)

        # Validation
        model.eval()
        val_loss = 0
        val_mae = 0
        with torch.no_grad():
            for batch_X, batch_y in test_loader:
                batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                preds = model(batch_X)
                val_loss += criterion(preds, batch_y).item()
                val_mae += torch.mean(torch.abs(preds - batch_y)).item()
        val_loss /= len(test_loader)
        val_mae /= len(test_loader)

        scheduler.step(val_loss)
        current_lr = optimizer.param_groups[0]['lr']

        print(f"  Epoch {epoch+1:2d}/{EPOCHS} | "
              f"Train Loss: {train_loss:.4f} | "
              f"Val Loss: {val_loss:.4f} | "
              f"Val MAE: {val_mae*9:.2f} pts | "
              f"LR: {current_lr:.6f}")

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
    with torch.no_grad():
        for batch_X, batch_y in test_loader:
            batch_X = batch_X.to(device)
            preds = model(batch_X)
            all_preds.extend(preds.cpu().numpy())
            all_actuals.extend(batch_y.numpy())

    all_preds = np.array(all_preds)
    all_actuals = np.array(all_actuals)
    mae = np.mean(np.abs(all_preds - all_actuals)) * 9
    mse = np.mean((all_preds - all_actuals) ** 2)

    print(f"\n{'=' * 50}")
    print(f"  Results:")
    print(f"  Test MAE: {mae:.2f} points (on 1-10 scale)")
    print(f"  Test MSE: {mse:.4f}")
    print(f"{'=' * 50}")

    # ── Sample Predictions ────────────────────────────────────────
    print("\n  Sample predictions vs actual:")
    for i in range(min(5, len(all_preds))):
        pred_score = all_preds[i] * 9 + 1
        actual_score = all_actuals[i] * 9 + 1
        print(f"    Predicted: {pred_score:.1f} | Actual: {actual_score:.1f}")

    # ── Save ──────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)

    torch.save({
        'model_state_dict': model.state_dict(),
        'vocab_size': VOCAB_SIZE,
        'embed_dim': EMBEDDING_DIM,
        'hidden_dim': HIDDEN_DIM,
        'max_len': MAX_LEN,
    }, MODEL_PATH)
    print(f"\n  [OK] Model saved to: {MODEL_PATH}")

    with open(TOKENIZER_PATH, 'wb') as f:
        pickle.dump(tokenizer, f)
    print(f"  [OK] Tokenizer saved to: {TOKENIZER_PATH}")


if __name__ == '__main__':
    main()
