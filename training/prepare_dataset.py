"""
Algobot Dataset Preparation Pipeline
=====================================
Converts raw gameplay JSON exports into LSTM training data.

Pipeline:
1. Load all exported JSON session files from data/raw/
2. Merge multi-session students by student_id
3. Clean invalid entries (sessions < 1 minute, 0 events, etc.)
4. Extract feature sequences from feature_timeseries
5. Compute labels from quest_attempts proficiency_label
6. Create sliding windows of length 20
7. Normalize features (min-max per feature, save scaler params)
8. Split: 70% train, 15% validation, 15% test
9. Save as NumPy arrays (.npz) and metadata JSON

Usage:
    python prepare_dataset.py --input data/raw/ --output data/processed/
"""

import os
import json
import argparse
import numpy as np
from pathlib import Path
from datetime import datetime

# Constants (must match browser-side telemetry.js)
FEATURE_COUNT = 10
SEQUENCE_LENGTH = 20

FEATURE_NAMES = [
    "error_rate",
    "execution_speed",
    "iteration_usage",
    "condition_reactivity",
    "greedy_efficiency",
    "yield_quality",
    "frustration",
    "code_success_rate",
    "hint_consumption_rate",
    "normalized_completion_time",
]


def load_sessions(input_dir):
    """Load all JSON session files from the input directory."""
    sessions = []
    input_path = Path(input_dir)

    for json_file in input_path.glob("*.json"):
        with open(json_file, "r") as f:
            data = json.load(f)

        # Handle both single-session and multi-session exports
        if "sessions" in data:
            for session in data["sessions"]:
                sessions.append(session)
        else:
            sessions.append(data)

    print(f"Loaded {len(sessions)} sessions from {input_dir}")
    return sessions


def clean_sessions(sessions, min_duration_minutes=1.0, min_events=5):
    """Remove invalid sessions."""
    valid = []
    for s in sessions:
        summary = s.get("summary", {})
        duration = summary.get("duration_minutes", s.get("duration_minutes", 0))
        quest_count = summary.get("total_quests_attempted", 0)

        if duration < min_duration_minutes:
            continue
        if quest_count < 1:
            continue
        valid.append(s)

    print(f"Cleaned: {len(sessions)} → {len(valid)} valid sessions")
    return valid


def extract_training_samples(sessions):
    """
    Extract (sequence, label) pairs from sessions.

    For each quest attempt with a proficiency label, we pair it with
    the feature time series window that preceded it.
    """
    X_samples = []  # [N, SEQUENCE_LENGTH, FEATURE_COUNT]
    y_samples = []  # [N]
    metadata = []   # session/quest metadata for traceability

    for session in sessions:
        quest_attempts = session.get("quest_attempts", [])
        feature_ts = session.get("feature_timeseries", [])

        # If quest_attempts is a dict (from localStorage format), convert to list
        if isinstance(quest_attempts, dict):
            quest_attempts = [
                {**v, "quest_key": k}
                for k, v in quest_attempts.items()
            ]

        # Build the feature matrix from time series
        feature_vectors = []
        for snap in feature_ts:
            vec = snap.get("vector", [])
            if len(vec) == FEATURE_COUNT:
                feature_vectors.append(vec)

        # For each completed quest attempt with a label
        for i, qa in enumerate(quest_attempts):
            label = qa.get("proficiency_label") or qa.get("proficiencyLabel")
            if label is None:
                continue

            # Use the feature window up to this quest attempt
            # Take the last SEQUENCE_LENGTH vectors available
            window_end = min(len(feature_vectors), (i + 1) * 2)  # approximate
            window_end = min(window_end, len(feature_vectors))
            window = feature_vectors[:window_end]

            # Zero-pad if fewer than SEQUENCE_LENGTH
            while len(window) < SEQUENCE_LENGTH:
                window.insert(0, [0.0] * FEATURE_COUNT)

            # Take the last SEQUENCE_LENGTH
            window = window[-SEQUENCE_LENGTH:]

            X_samples.append(window)
            y_samples.append(float(label))
            metadata.append({
                "student_id": session.get("student_id", "unknown"),
                "session_id": session.get("session_id", "unknown"),
                "quest_key": qa.get("quest_key", "unknown"),
                "stage": qa.get("stage", 1),
                "completed": qa.get("completed", False),
            })

        # If no quest attempts have labels, use the feature_vector_end from stored format
        if not quest_attempts and feature_vectors:
            # Create a sample from the overall session
            window = feature_vectors[-SEQUENCE_LENGTH:]
            while len(window) < SEQUENCE_LENGTH:
                window.insert(0, [0.0] * FEATURE_COUNT)
            window = window[-SEQUENCE_LENGTH:]

            summary = session.get("summary", {})
            # Compute a simple label from summary stats
            errors = summary.get("total_errors", 0)
            resets = summary.get("total_resets", 0)
            quests_done = summary.get("total_quests_completed", 0)
            quests_attempted = max(1, summary.get("total_quests_attempted", 1))

            completion = quests_done / quests_attempted
            error_penalty = min(1.0, errors / 10)
            reset_penalty = min(1.0, resets / 5)

            label = 0.40 * completion + 0.25 * (1 - error_penalty) + 0.20 * (1 - reset_penalty) + 0.15
            X_samples.append(window)
            y_samples.append(float(label))
            metadata.append({
                "student_id": session.get("student_id", "unknown"),
                "session_id": session.get("session_id", "unknown"),
                "quest_key": "session_summary",
                "stage": summary.get("max_stage_reached", 1),
                "completed": True,
            })

    print(f"Extracted {len(X_samples)} training samples")
    return np.array(X_samples, dtype=np.float32), np.array(y_samples, dtype=np.float32), metadata


def normalize_features(X_train, X_val, X_test):
    """Min-max normalize each feature across the training set."""
    # Reshape to [N * SEQUENCE_LENGTH, FEATURE_COUNT] for per-feature stats
    flat = X_train.reshape(-1, FEATURE_COUNT)

    feature_min = flat.min(axis=0)
    feature_max = flat.max(axis=0)

    # Avoid division by zero
    feature_range = feature_max - feature_min
    feature_range[feature_range == 0] = 1.0

    def normalize(X):
        shape = X.shape
        flat = X.reshape(-1, FEATURE_COUNT)
        normalized = (flat - feature_min) / feature_range
        return normalized.reshape(shape)

    scaler_params = {
        "feature_min": feature_min.tolist(),
        "feature_max": feature_max.tolist(),
        "feature_range": feature_range.tolist(),
        "feature_names": FEATURE_NAMES,
    }

    return normalize(X_train), normalize(X_val), normalize(X_test), scaler_params


def split_data(X, y, train_ratio=0.70, val_ratio=0.15):
    """Split data into train/val/test sets."""
    n = len(X)
    indices = np.random.permutation(n)

    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))

    train_idx = indices[:train_end]
    val_idx = indices[train_end:val_end]
    test_idx = indices[val_end:]

    return (
        X[train_idx], y[train_idx],
        X[val_idx], y[val_idx],
        X[test_idx], y[test_idx],
    )


def save_dataset(output_dir, X_train, y_train, X_val, y_val, X_test, y_test,
                 scaler_params, metadata, dataset_version="v1"):
    """Save processed dataset as NumPy arrays and metadata JSON."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    np.save(output_path / "X_train.npy", X_train)
    np.save(output_path / "y_train.npy", y_train)
    np.save(output_path / "X_val.npy", X_val)
    np.save(output_path / "y_val.npy", y_val)
    np.save(output_path / "X_test.npy", X_test)
    np.save(output_path / "y_test.npy", y_test)

    with open(output_path / "scaler_params.json", "w") as f:
        json.dump(scaler_params, f, indent=2)

    stats = {
        "dataset_version": dataset_version,
        "created_at": datetime.now().isoformat(),
        "total_samples": len(X_train) + len(X_val) + len(X_test),
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "test_samples": len(X_test),
        "sequence_length": SEQUENCE_LENGTH,
        "feature_count": FEATURE_COUNT,
        "feature_names": FEATURE_NAMES,
        "label_formula": "0.40*completion + 0.25*(1-errors) + 0.20*(1-resets) + 0.15*(1-hints)",
        "label_range": {
            "min": float(np.concatenate([y_train, y_val, y_test]).min()),
            "max": float(np.concatenate([y_train, y_val, y_test]).max()),
            "mean": float(np.concatenate([y_train, y_val, y_test]).mean()),
            "std": float(np.concatenate([y_train, y_val, y_test]).std()),
        },
        "unique_students": len(set(m["student_id"] for m in metadata)),
    }

    with open(output_path / "dataset_stats.json", "w") as f:
        json.dump(stats, f, indent=2)

    print(f"\nDataset saved to {output_path}/")
    print(f"  Train: {X_train.shape} → {len(y_train)} labels")
    print(f"  Val:   {X_val.shape} → {len(y_val)} labels")
    print(f"  Test:  {X_test.shape} → {len(y_test)} labels")
    print(f"  Label range: [{stats['label_range']['min']:.4f}, {stats['label_range']['max']:.4f}]")
    print(f"  Label mean:  {stats['label_range']['mean']:.4f} ± {stats['label_range']['std']:.4f}")


def main():
    parser = argparse.ArgumentParser(description="Prepare Algobot gameplay data for LSTM training")
    parser.add_argument("--input", default="data/raw/", help="Input directory with JSON exports")
    parser.add_argument("--output", default="data/processed/", help="Output directory for processed data")
    parser.add_argument("--version", default="v1", help="Dataset version identifier")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = parser.parse_args()

    np.random.seed(args.seed)

    # 1. Load
    sessions = load_sessions(args.input)
    if not sessions:
        print("No session files found. Export gameplay data from the game first.")
        return

    # 2. Clean
    sessions = clean_sessions(sessions)
    if not sessions:
        print("No valid sessions after cleaning.")
        return

    # 3. Extract
    X, y, metadata = extract_training_samples(sessions)
    if len(X) == 0:
        print("No training samples extracted.")
        return

    # 4. Split
    X_train, y_train, X_val, y_val, X_test, y_test = split_data(X, y)

    # 5. Normalize
    X_train, X_val, X_test, scaler_params = normalize_features(X_train, X_val, X_test)

    # 6. Save
    save_dataset(args.output, X_train, y_train, X_val, y_val, X_test, y_test,
                 scaler_params, metadata, args.version)


if __name__ == "__main__":
    main()
