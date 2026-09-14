"""Create traceable student-disjoint data in a NEW directory; preserve old model inputs.

Untimed legacy snapshots cannot be aligned to quests. Recorded quest-end vectors
provide conservative chronological sequences instead of invented snapshot indices.
"""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import numpy as np

FEATURE_COUNT = 10
SEQUENCE_LENGTH = 20
FEATURE_NAMES = [
    'error_rate', 'execution_speed', 'iteration_usage', 'condition_reactivity',
    'greedy_efficiency', 'yield_quality', 'frustration', 'code_success_rate',
    'hint_consumption_rate', 'normalized_completion_time',
]


def summary_of(session):
    return session.get('summary') if isinstance(session.get('summary'), dict) else {}


def session_id_of(session):
    summary = summary_of(session)
    return (session.get('session_id') or session.get('sessionId')
            or summary.get('sessionId') or summary.get('session_id'))


def student_id_of(session):
    summary = summary_of(session)
    return (session.get('student_id') or session.get('participantId')
            or summary.get('participantId') or summary.get('student_id') or 'unknown')


def quest_attempts_of(session):
    attempts = session.get('quest_attempts') or session.get('questAttempts') or []
    if isinstance(attempts, dict):
        return [{**v, 'quest_key': k} for k, v in attempts.items() if isinstance(v, dict)]
    return [v for v in attempts if isinstance(v, dict)] if isinstance(attempts, list) else []


def label_of(attempt):
    value = attempt.get('proficiency_label')
    return attempt.get('proficiencyLabel') if value is None else value


def snapshots_of(session):
    values = session.get('feature_timeseries') or session.get('featureSnapshots') or []
    return values if isinstance(values, list) else []


def load_sessions(input_dir):
    """Deduplicate repeated exports, keeping the most complete session version."""
    sessions = {}
    for source in sorted(Path(input_dir).glob('*.json')):
        if 'replay' in source.name.lower():
            continue
        try:
            data = json.loads(source.read_text(encoding='utf-8-sig'))
        except (ValueError, OSError) as exc:
            print(f'Warning: cannot read {source.name}: {exc}')
            continue
        if not isinstance(data, dict):
            continue
        records = data.get('sessions', [data])
        for session in records if isinstance(records, list) else [records]:
            if not isinstance(session, dict):
                continue
            sid = session_id_of(session)
            key = str(sid) if sid else 'missing:' + hashlib.sha256(
                json.dumps(session, sort_keys=True).encode('utf-8')).hexdigest()
            attempts = quest_attempts_of(session)
            quality = (sum(label_of(q) is not None for q in attempts), len(attempts),
                       len(snapshots_of(session)), len(session.get('raw_events') or []))
            if key not in sessions or quality >= sessions[key][0]:
                sessions[key] = (quality, session)
    result = [sessions[key][1] for key in sorted(sessions)]
    print(f'Loaded {len(result)} unique sessions from {input_dir}')
    return result


def clean_sessions(sessions, min_duration_minutes=0.5):
    return [s for s in sessions if isinstance(s, dict)
            and (quest_attempts_of(s) or snapshots_of(s))]


def _vector(value):
    if not isinstance(value, (list, tuple)) or len(value) != FEATURE_COUNT:
        return None
    try:
        vector = np.asarray(value, dtype=np.float32)
    except (ValueError, TypeError, OverflowError):
        return None
    return vector.tolist() if np.isfinite(vector).all() else None


def _epoch_ms(value):
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) if np.isfinite(value) else None
    try:
        parsed = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return parsed.timestamp() * 1000 if parsed.tzinfo is not None else None
    except (TypeError, ValueError, OverflowError):
        return None


def _snapshot_time(snapshot, session_start):
    if 'timestamp_ms' in snapshot:
        return _epoch_ms(snapshot['timestamp_ms'])
    relative = snapshot.get('t', snapshot.get('timestamp'))
    if isinstance(relative, (int, float)) and session_start is not None:
        return session_start + relative if np.isfinite(relative) else None
    return _epoch_ms(snapshot.get('time'))


def extract_training_samples(sessions):
    """Pair existing proxy labels with contemporaneous/past recorded features.

    Do not synthesize labels from unlabelled session summaries. These labels
    estimate gameplay performance at quest completion, not future independent skill.
    """
    samples, labels, metadata = [], [], []
    for session in sessions:
        summary = summary_of(session)
        session_start = _epoch_ms(session.get('start_time', summary.get('startTime')))
        timed_snapshots = []
        for snap in snapshots_of(session):
            if isinstance(snap, dict):
                time = _snapshot_time(snap, session_start)
                vector = _vector(snap.get('vector'))
                if time is not None and vector is not None:
                    timed_snapshots.append((time, vector))
        timed_snapshots.sort(key=lambda item: item[0])
        attempts = quest_attempts_of(session)
        endpoints = []
        for attempt in attempts:
            time = _epoch_ms(attempt.get('end_time', attempt.get('endTime')))
            vector = _vector(attempt.get('feature_vector_end', attempt.get('featureVectorAtEnd')))
            if time is not None and vector is not None:
                endpoints.append((time, vector))
        endpoints.sort(key=lambda item: item[0])
        for attempt in attempts:
            try:
                label = float(label_of(attempt))
            except (ValueError, TypeError):
                continue
            if not np.isfinite(label) or not 0 <= label <= 1:
                continue
            end = _epoch_ms(attempt.get('end_time', attempt.get('endTime')))
            end_vector = _vector(attempt.get('feature_vector_end', attempt.get('featureVectorAtEnd')))
            window = [v for t, v in timed_snapshots if end is not None and t <= end]
            source = 'timestamped_snapshots'
            if not window:
                window = [v for t, v in endpoints if end is not None and t <= end]
                source = 'legacy_quest_end_vectors'
            if not window and end_vector is not None:
                window = [end_vector]
                source = 'single_quest_end_vector'
            if not window:
                continue
            real_steps = min(len(window), SEQUENCE_LENGTH)
            window = [[0.0] * FEATURE_COUNT] * (SEQUENCE_LENGTH - real_steps) + window[-SEQUENCE_LENGTH:]
            samples.append(window)
            labels.append(label)
            metadata.append({
                'student_id': student_id_of(session), 'session_id': session_id_of(session) or 'unknown',
                'quest_key': attempt.get('quest_key', 'unknown'), 'stage': attempt.get('stage', 1),
                'completed': bool(attempt.get('completed', False)), 'sequence_source': source,
                'real_timesteps': real_steps, 'quest_end_ms': end, 'label_source': 'recorded_gameplay_formula',
            })
    print(f'Extracted {len(samples)} labelled quest samples')
    return (np.asarray(samples, dtype=np.float32).reshape(-1, SEQUENCE_LENGTH, FEATURE_COUNT),
            np.asarray(labels, dtype=np.float32), metadata)


def split_indices(metadata, train_ratio=0.70, val_ratio=0.15, seed=42):
    """Student-disjoint split, failing rather than copying rows across partitions."""
    if not (0 < train_ratio < 1 and 0 < val_ratio < 1 and train_ratio + val_ratio < 1):
        raise ValueError('Ratios must leave nonempty train, validation, and test partitions')
    groups = sorted({str(m['student_id']) for m in metadata})
    if any(g.strip().lower() in {'', 'unknown', 'anonymous', 'none'} for g in groups):
        raise ValueError('Student IDs are required for a student-disjoint split')
    if len(groups) < 3:
        raise ValueError('At least three distinct students are needed for three disjoint partitions')
    shuffled = np.random.default_rng(seed).permutation(groups)
    train_count = min(max(1, int(len(groups) * train_ratio)), len(groups) - 2)
    val_count = min(max(1, int(len(groups) * val_ratio)), len(groups) - train_count - 1)
    groups_by_split = {'train': shuffled[:train_count].tolist(),
                      'val': shuffled[train_count:train_count + val_count].tolist(),
                      'test': shuffled[train_count + val_count:].tolist()}
    return {name: np.asarray([i for i, m in enumerate(metadata)
                             if str(m['student_id']) in members], dtype=np.int64)
            for name, members in groups_by_split.items()}


def normalize_features(X_train, X_val, X_test):
    """Fit training-only scaling, matching the browser's unclipped transform."""
    if not len(X_train):
        raise ValueError('Training partition must not be empty')
    flat = X_train.reshape(-1, FEATURE_COUNT)
    feature_min, feature_max = flat.min(axis=0), flat.max(axis=0)
    feature_range = feature_max - feature_min
    feature_range[feature_range == 0] = 1.0
    scaler = {'feature_min': feature_min.tolist(), 'feature_max': feature_max.tolist(),
              'feature_range': feature_range.tolist(), 'feature_names': FEATURE_NAMES}
    return (*[(X - feature_min) / feature_range for X in (X_train, X_val, X_test)], scaler)


def main():
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=root / 'data/raw')
    parser.add_argument('--output', type=Path, default=root / 'data/processed_v2')
    parser.add_argument('--version', default='v2')
    parser.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()
    if args.output.exists() and (not args.output.is_dir() or any(args.output.iterdir())):
        parser.error('Output directory is not empty. Choose a new directory to preserve existing evidence.')
    X, y, metadata = extract_training_samples(clean_sessions(load_sessions(args.input)))
    if not len(X):
        parser.error('No usable labelled quest samples found')
    try:
        indices = split_indices(metadata, seed=args.seed)
    except ValueError as exc:
        parser.error(str(exc))
    normalized = normalize_features(*(X[indices[k]] for k in ('train', 'val', 'test')))
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = {'split_unit': 'student_id', 'seed': args.seed, 'partitions': {}}
    for split, features in zip(('train', 'val', 'test'), normalized[:3]):
        idx = indices[split]
        np.save(args.output / f'X_{split}.npy', features)
        np.save(args.output / f'y_{split}.npy', y[idx])
        manifest['partitions'][split] = [metadata[i] for i in idx]
    sources = {path.name: hashlib.sha256(path.read_bytes()).hexdigest()
               for path in sorted(args.input.glob('*.json')) if 'replay' not in path.name.lower()}
    stats = {
        'dataset_version': args.version, 'created_at': datetime.now(timezone.utc).isoformat(),
        'total_samples': len(y), **{f'{k}_samples': len(v) for k, v in indices.items()},
        'sequence_length': SEQUENCE_LENGTH, 'feature_count': FEATURE_COUNT,
        'feature_names': FEATURE_NAMES, 'unique_students': len({m['student_id'] for m in metadata}),
        'label_source': 'recorded_gameplay_formula', 'learning_improvement': 'unevaluated',
        'label_range': {'min': float(y.min()), 'max': float(y.max()), 'mean': float(y.mean())},
        'source_sha256': sources,
        'limitations': ['Legacy untimed snapshots are replaced by recorded quest-end vectors.',
                        'Gameplay labels are proxy outcomes, not independent proficiency assessments.',
                        'Student IDs define groups; participant identity/provenance requires researcher verification.'],
    }
    for name, content in (('scaler_params.json', normalized[3]), ('split_manifest.json', manifest),
                          ('dataset_stats.json', stats)):
        (args.output / name).write_text(json.dumps(content, indent=2, allow_nan=False), encoding='utf-8')
    print(f'Saved {len(y)} samples with student-disjoint partitions to {args.output}')


if __name__ == '__main__':
    main()
