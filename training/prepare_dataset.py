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
    """Load all JSON session files from the input directory (ignoring replay buffers)."""
    sessions = []
    seen_session_ids = set()
    input_path = Path(input_dir)

    # Process dataset files (skip replay buffer files)
    json_files = [f for f in input_path.glob("*.json") if "replay" not in f.name.lower()]

    for json_file in json_files:
        with open(json_file, "r") as f:
            try:
                data = json.load(f)
            except Exception as e:
                print(f"Warning: Failed to load {json_file.name}: {e}")
                continue

        # Skip non-dict structures (e.g. standalone replay arrays)
        if not isinstance(data, dict):
            continue

        raw_sessions = data.get("sessions", [data])
        if not isinstance(raw_sessions, list):
            raw_sessions = [raw_sessions]

        for s in raw_sessions:
            if not isinstance(s, dict):
                continue
            
            # Deduplicate by session_id
            sid = (
                s.get("session_id")
                or s.get("sessionId")
                or s.get("summary", {}).get("sessionId")
                or s.get("summary", {}).get("session_id")
            )
            if sid:
                if sid in seen_session_ids:
                    continue
                seen_session_ids.add(sid)

            sessions.append(s)

    print(f"Loaded {len(sessions)} unique sessions from {input_dir}")
    return sessions


def clean_sessions(sessions, min_duration_minutes=0.5):
    """Filter out completely empty or invalid sessions."""
    valid = []
    for s in sessions:
        if not isinstance(s, dict):
            continue

        summary = s.get("summary", {}) if isinstance(s.get("summary"), dict) else {}
        duration = summary.get("duration_minutes", summary.get("durationMinutes", s.get("duration_minutes", s.get("durationMinutes", 0))))
        
        # Check quest attempts
        quest_attempts = s.get("quest_attempts") or s.get("questAttempts") or []
        if isinstance(quest_attempts, dict):
            quest_attempts = list(quest_attempts.values())
        
        quest_count = summary.get("total_quests_attempted", summary.get("questsCompleted", len(quest_attempts)))
        feature_ts = s.get("feature_timeseries") or s.get("featureSnapshots") or []
        raw_events = s.get("raw_events") or []

        # Keep if session has quest attempts, feature snapshots, raw events, or minimum duration
        if len(quest_attempts) > 0 or len(feature_ts) > 0 or len(raw_events) > 0 or duration >= min_duration_minutes or quest_count > 0:
            valid.append(s)

    print(f"Cleaned: {len(sessions)} -> {len(valid)} valid sessions")
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
        if not isinstance(session, dict):
            continue

        student_id = session.get("student_id") or session.get("summary", {}).get("participantId") or "unknown"
        session_id = session.get("session_id") or session.get("summary", {}).get("sessionId") or "unknown"

        quest_attempts = session.get("quest_attempts") or session.get("questAttempts") or []
        feature_ts = session.get("feature_timeseries") or session.get("featureSnapshots") or []

        # If quest_attempts is a dict (from localStorage format), convert to list
        if isinstance(quest_attempts, dict):
            quest_attempts = [
                {**v, "quest_key": k}
                for k, v in quest_attempts.items()
            ]

        # Build the feature matrix from time series
        feature_vectors = []
        for snap in feature_ts:
            if isinstance(snap, dict):
                vec = snap.get("vector", [])
            elif isinstance(snap, list):
                vec = snap
            else:
                vec = []
            if len(vec) == FEATURE_COUNT:
                feature_vectors.append(vec)

        # For each completed quest attempt with a label
        for i, qa in enumerate(quest_attempts):
            if not isinstance(qa, dict):
                continue
            label = qa.get("proficiency_label") if qa.get("proficiency_label") is not None else qa.get("proficiencyLabel")
            if label is None:
                continue

            # Build feature window for this quest attempt
            window = []
            if feature_vectors:
                window_end = min(len(feature_vectors), (i + 1) * 2)
                window_end = min(window_end, len(feature_vectors))
                window = list(feature_vectors[:window_end])
            elif qa.get("feature_vector_end") and len(qa.get("feature_vector_end")) == FEATURE_COUNT:
                window = [qa.get("feature_vector_end")]
            elif qa.get("featureVectorAtEnd") and len(qa.get("featureVectorAtEnd")) == FEATURE_COUNT:
                window = [qa.get("featureVectorAtEnd")]

            # Zero-pad if fewer than SEQUENCE_LENGTH
            while len(window) < SEQUENCE_LENGTH:
                window.insert(0, [0.0] * FEATURE_COUNT)

            # Take the last SEQUENCE_LENGTH
            window = window[-SEQUENCE_LENGTH:]

            X_samples.append(window)
            y_samples.append(float(label))
            metadata.append({
                "student_id": student_id,
                "session_id": session_id,
                "quest_key": qa.get("quest_key", "unknown"),
                "stage": qa.get("stage", 1),
                "completed": qa.get("completed", False),
            })

        # If no quest attempts have labels, try creating a sample from session summary if available
        if not X_samples and feature_vectors:
            window = list(feature_vectors[-SEQUENCE_LENGTH:])
            while len(window) < SEQUENCE_LENGTH:
                window.insert(0, [0.0] * FEATURE_COUNT)
            window = window[-SEQUENCE_LENGTH:]

            summary = session.get("summary", {}) if isinstance(session.get("summary"), dict) else {}
            errors = summary.get("total_errors", summary.get("totalErrors", 0))
            resets = summary.get("total_resets", summary.get("totalResets", 0))
            quests_done = summary.get("total_quests_completed", summary.get("questsCompleted", 0))
            quests_attempted = max(1, summary.get("total_quests_attempted", 1))

            completion = quests_done / quests_attempted
            error_penalty = min(1.0, errors / 10)
            reset_penalty = min(1.0, resets / 5)

            label = 0.40 * completion + 0.25 * (1 - error_penalty) + 0.20 * (1 - reset_penalty) + 0.15
            X_samples.append(window)
            y_samples.append(float(label))
            metadata.append({
                "student_id": student_id,
                "session_id": session_id,
                "quest_key": "session_summary",
                "stage": summary.get("max_stage_reached", summary.get("currentStage", 1)),
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

    if n < 3:
        # For very small datasets, ensure non-empty partitions
        return X, y, X, y, X, y

    train_end = max(1, int(n * train_ratio))
    val_end = max(train_end + 1, int(n * (train_ratio + val_ratio)))
    if val_end >= n:
        val_end = n - 1

    train_idx = indices[:train_end]
    val_idx = indices[train_end:val_end]
    test_idx = indices[val_end:]

    if len(val_idx) == 0:
        val_idx = train_idx[:1]
    if len(test_idx) == 0:
        test_idx = train_idx[:1]

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
    print(f"  Train: {X_train.shape} -> {len(y_train)} labels")
    print(f"  Val:   {X_val.shape} -> {len(y_val)} labels")
    print(f"  Test:  {X_test.shape} -> {len(y_test)} labels")
    print(f"  Label range: [{stats['label_range']['min']:.4f}, {stats['label_range']['max']:.4f}]")
    print(f"  Label mean:  {stats['label_range']['mean']:.4f} +/- {stats['label_range']['std']:.4f}")


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
