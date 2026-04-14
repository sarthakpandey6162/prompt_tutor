"""
Train All Models — Run this single script to:
1. Generate dataset from prompts.json + synthetic data
2. Train LSTM scorer
3. Train CNN classifier  
4. Train LSTM element detector

Usage: python train_all.py
"""

import subprocess
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def run_script(name, script):
    print(f"\n{'#' * 60}")
    print(f"  STEP: {name}")
    print(f"{'#' * 60}\n")
    
    path = os.path.join(SCRIPT_DIR, script)
    result = subprocess.run([sys.executable, path], cwd=SCRIPT_DIR)
    
    if result.returncode != 0:
        print(f"\n❌ {name} failed with code {result.returncode}")
        sys.exit(1)
    
    print(f"\n✅ {name} completed successfully")


def main():
    print("=" * 60)
    print("  🧠 Prompt Tutor — Full Model Training Pipeline")
    print("=" * 60)

    # Step 1: Generate dataset
    run_script("Generate Dataset", "generate_dataset.py")

    # Step 2: Train LSTM scorer
    run_script("Train LSTM Scorer (RNN)", "train_scorer.py")

    # Step 3: Train CNN classifier
    run_script("Train CNN Classifier", "train_classifier.py")

    # Step 4: Train LSTM element detector
    run_script("Train LSTM Element Detector", "train_element_detector.py")

    print(f"\n{'=' * 60}")
    print("  🎉 All models trained successfully!")
    print(f"  Models saved in: {os.path.join(SCRIPT_DIR, 'saved_models')}")
    print(f"\n  Next step: Run the prediction server:")
    print(f"    python serve.py")
    print(f"{'=' * 60}")


if __name__ == '__main__':
    main()
